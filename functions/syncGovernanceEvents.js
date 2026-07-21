// Firebase/Node Script: syncGovernanceEvents.js
// Continuously monitors the EVM/Polygon RPC node for Governor contract events
// and synchronizes the state to Firestore, implementing the Dual-Write validation loop.

const {getApps, initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const { ethers } = require('ethers');

if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

// ABI snippet for SocietyGovernor events
const GOVERNOR_ABI = [
  "event ProposalCreated(uint256 indexed proposalId, string title, uint256 budget, uint256 deadline)",
  "event VoteCast(uint256 indexed proposalId, address indexed voter, uint8 choice, uint256 weight)",
  "event ProposalExecuted(uint256 indexed proposalId, address recipient, uint256 amount)",
  "event ProposalVetoed(uint256 indexed proposalId)"
];

const GOVERNOR_ADDRESS = process.env.GOVERNOR_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000";
const RPC_URL = process.env.RPC_URL || "https://polygon-rpc.com";

async function startSync() {
  console.log(`[SYNC] Connecting to EVM RPC Node: ${RPC_URL}`);
  console.log(`[SYNC] Monitoring SocietyGovernor at: ${GOVERNOR_ADDRESS}`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(GOVERNOR_ADDRESS, GOVERNOR_ABI, provider);

  // 1. Listen for ProposalCreated
  contract.on("ProposalCreated", async (proposalId, title, budget, deadline, event) => {
    console.log(`[EVENT] ProposalCreated detected: ID ${proposalId}, Title: ${title}`);
    try {
      const pIdStr = proposalId.toString();
      await db.collection("proposals").doc(pIdStr).set({
        id: pIdStr,
        title: title,
        budget: Number(budget),
        deadline: Number(deadline) * 1000, // Unix milliseconds
        yes: 0,
        no: 0,
        veto: 0,
        status: "Voting",
        txHash: event.log.transactionHash,
        lastUpdated: FieldValue.serverTimestamp()
      }, { merge: true });
      console.log(`[DB] Firestore proposal ${pIdStr} created/updated.`);
    } catch (err) {
      console.error("[DB ERROR] Error syncing proposal creation:", err);
    }
  });

  // 2. Listen for VoteCast
  contract.on("VoteCast", async (proposalId, voter, choice, weight, event) => {
    console.log(`[EVENT] VoteCast detected: Proposal ID ${proposalId}, Choice: ${choice} by ${voter}`);
    try {
      const pIdStr = proposalId.toString();
      const proposalRef = db.collection("proposals").doc(pIdStr);

      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(proposalRef);
        if (!doc.exists) {
          console.log(`[SYNC] Proposal doc ${pIdStr} not found in database, creating placeholder.`);
          transaction.set(proposalRef, {
            id: pIdStr,
            yes: choice === 0 ? Number(weight) : 0,
            no: choice === 1 ? Number(weight) : 0,
            veto: choice === 2 ? Number(weight) : 0,
            status: "Voting"
          });
        } else {
          const data = doc.data();
          let yesCount = data.yes || 0;
          let noCount = data.no || 0;
          let vetoCount = data.veto || 0;

          if (choice === 0) yesCount += Number(weight);
          else if (choice === 1) noCount += Number(weight);
          else if (choice === 2) vetoCount += Number(weight);

          transaction.update(proposalRef, {
            yes: yesCount,
            no: noCount,
            veto: vetoCount,
            lastUpdated: FieldValue.serverTimestamp()
          });
        }
      });
      console.log(`[DB] Firestore vote synced successfully for proposal ${pIdStr}.`);
    } catch (err) {
      console.error("[DB ERROR] Error syncing vote:", err);
    }
  });

  // 3. Listen for ProposalExecuted
  contract.on("ProposalExecuted", async (proposalId, recipient, amount, event) => {
    console.log(`[EVENT] ProposalExecuted detected: ID ${proposalId}`);
    try {
      const pIdStr = proposalId.toString();
      await db.collection("proposals").doc(pIdStr).update({
        status: "Executed",
        releasedTo: recipient,
        releasedAmount: Number(amount),
        executionTx: event.log.transactionHash,
        lastUpdated: FieldValue.serverTimestamp()
      });
      console.log(`[DB] Firestore proposal ${pIdStr} marked as Executed.`);
    } catch (err) {
      console.error("[DB ERROR] Error syncing execution:", err);
    }
  });

  // 4. Listen for ProposalVetoed
  contract.on("ProposalVetoed", async (proposalId, event) => {
    console.log(`[EVENT] ProposalVetoed detected: ID ${proposalId}`);
    try {
      const pIdStr = proposalId.toString();
      await db.collection("proposals").doc(pIdStr).update({
        status: "Vetoed",
        vetoTx: event.log.transactionHash,
        lastUpdated: FieldValue.serverTimestamp()
      });
      console.log(`[DB] Firestore proposal ${pIdStr} marked as Vetoed.`);
    } catch (err) {
      console.error("[DB ERROR] Error syncing veto:", err);
    }
  });
}

// Start listener loop if executed directly
if (require.main === module) {
  startSync().catch(console.error);
}

module.exports = { startSync };
