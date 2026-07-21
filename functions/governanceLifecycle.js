const functions=require('firebase-functions/v1');
const {getApps,initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue,Timestamp}=require('firebase-admin/firestore');
if(!getApps().length)initializeApp();
const db=getFirestore();

const RULES={
  standard:{discussionHours:72,votingHours:72,quorumPercent:40,approvalPercent:50,minEvidence:1},
  constitutional:{discussionHours:168,votingHours:120,quorumPercent:60,approvalPercent:66.67,minEvidence:2},
  emergency:{discussionHours:1,votingHours:6,quorumPercent:20,approvalPercent:60,minEvidence:2}
};
const ruleFor=key=>RULES[key]||RULES.standard;
const percent=(part,total)=>total>0?Math.round((part/total)*10000)/100:0;

async function eligibleCount(proposal){
  if(proposal.decisionType==='society_formation'&&proposal.societyPetitionId){
    const founders=await db.collection('societyPetitions').doc(proposal.societyPetitionId).collection('founders').where('residenceVerified','==',true).where('inBoundary','==',true).count().get();
    return founders.data().count;
  }
  let query;
  if(proposal.scope==='society')query=db.collection('communities').doc(proposal.scopeId).collection('members').where('status','==','active');
  else {
    query=db.collection('users').where('kycStatus','==','verified');
    if(proposal.scope==='city')query=query.where('city','==',proposal.scopeId);
    if(proposal.scope==='country')query=query.where('country','==',proposal.scopeId);
  }
  const result=await query.count().get();return result.data().count;
}

exports.initializeProposal=functions.firestore.document('proposals/{proposalId}').onCreate(async(snap)=>{
  const proposal=snap.data(),rule=ruleFor(proposal.ruleKey),count=await eligibleCount(proposal);
  const discussionClosesAt=Timestamp.fromMillis(Date.now()+rule.discussionHours*3600000);
  return snap.ref.update({eligibleCount:count,evidenceCount:Number(proposal.evidenceCount||1),discussionClosesAt,serverInitializedAt:FieldValue.serverTimestamp(),tally:{yes:0,no:0,abstain:0,cast:0}});
});

exports.aggregatePrivateBallot=functions.firestore.document('proposals/{proposalId}/votes/{uid}').onCreate(async(snap,context)=>{
  const ballot=snap.data(),choice=ballot.choice;
  if(!['yes','no','abstain'].includes(choice))throw new functions.https.HttpsError('invalid-argument','Invalid ballot choice');
  const proposalRef=db.collection('proposals').doc(context.params.proposalId),receiptRef=db.collection('users').doc(context.params.uid).collection('ballotReceipts').doc(context.params.proposalId),auditRef=proposalRef.collection('audit').doc(context.eventId);
  return db.runTransaction(async transaction=>{
    const proposalSnap=await transaction.get(proposalRef);if(!proposalSnap.exists)throw new Error('Proposal not found');
    const proposal=proposalSnap.data();if(proposal.status!=='voting')throw new Error('Proposal is not open for voting');
    const current=proposal.tally||{yes:0,no:0,abstain:0,cast:0},next={...current,[choice]:Number(current[choice]||0)+1,cast:Number(current.cast||0)+1};
    transaction.update(proposalRef,{tally:next,lastBallotAt:FieldValue.serverTimestamp()});
    transaction.set(receiptRef,{proposalId:context.params.proposalId,ballotId:context.params.uid,rulesVersion:ballot.rulesVersion,status:'accepted',createdAt:FieldValue.serverTimestamp()});
    transaction.set(auditRef,{type:'ballot_aggregated',proposalId:context.params.proposalId,rulesVersion:ballot.rulesVersion,createdAt:FieldValue.serverTimestamp()});
  });
});

exports.advanceGovernanceLifecycle=functions.pubsub.schedule('every 15 minutes').onRun(async()=>{
  const now=Timestamp.now();
  const [discussion,voting]=await Promise.all([
    db.collection('proposals').where('status','==','discussion').where('discussionClosesAt','<=',now).limit(200).get(),
    db.collection('proposals').where('status','==','voting').where('votingClosesAt','<=',now).limit(200).get()
  ]);
  const batch=db.batch();
  discussion.forEach(doc=>{
    const proposal=doc.data(),rule=ruleFor(proposal.ruleKey);
    if(Number(proposal.evidenceCount||0)<rule.minEvidence)batch.update(doc.ref,{blockedReason:'Minimum evidence not met',discussionClosesAt:Timestamp.fromMillis(now.toMillis()+24*3600000)});
    else batch.update(doc.ref,{status:'voting',votingOpenedAt:now,votingClosesAt:Timestamp.fromMillis(now.toMillis()+rule.votingHours*3600000),blockedReason:FieldValue.delete()});
  });
  voting.forEach(doc=>{
    const proposal=doc.data(),rule=ruleFor(proposal.ruleKey),tally=proposal.tally||{yes:0,no:0,abstain:0,cast:0},turnout=percent(Number(tally.cast||0),Number(proposal.eligibleCount||0)),decisive=Number(tally.yes||0)+Number(tally.no||0),approval=percent(Number(tally.yes||0),decisive);
    const status=turnout<rule.quorumPercent?'no_quorum':(decisive>0&&approval>=rule.approvalPercent?'approved':'rejected');
    batch.update(doc.ref,{status,turnoutPercent:turnout,approvalPercent:approval,finalizedAt:now,finalizedBy:'gaigs-governance-1.0'});
  });
  return batch.commit();
});
