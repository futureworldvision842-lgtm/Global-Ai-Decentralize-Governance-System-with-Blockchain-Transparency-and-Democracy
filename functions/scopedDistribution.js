const functions = require('firebase-functions/v1');
const {getApps, initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
if (!getApps().length) initializeApp();
const db = getFirestore();

// Fans an event out only to users whose verified profile matches its scope.
// Client code cannot create notification documents under firestore.rules.
exports.distributeScopedEvent = functions.firestore.document('events/{eventId}').onCreate(async (snap, context) => {
  const event = snap.data();
  const allowed = ['society', 'city', 'country', 'global'];
  if (!allowed.includes(event.scope)) return null;
  let query = db.collection('publicProfiles');
  if (event.scope === 'society') query = query.where('communityIds', 'array-contains', event.scopeId);
  if (event.scope === 'city') query = query.where('city', '==', event.scopeId);
  if (event.scope === 'country') query = query.where('country', '==', event.scopeId);
  const users = await query.limit(1000).get();
  const chunks=[];for(let i=0;i<users.docs.length;i+=400)chunks.push(users.docs.slice(i,i+400));
  return Promise.all(chunks.map(chunk=>{const batch=db.batch();chunk.forEach(user=>{const ref=db.collection('notifications').doc(user.id).collection('items').doc(context.params.eventId);batch.set(ref,{title:event.title,body:event.body,type:event.type,scope:event.scope,sourceId:event.sourceId,read:false,createdAt:FieldValue.serverTimestamp()});});return batch.commit();}));
});

exports.verifyEmergencyReport = functions.firestore.document('emergencies/{emergencyId}/verifications/{uid}').onCreate(async (snap, context) => {
  const emergencyRef=db.collection('emergencies').doc(context.params.emergencyId);
  return db.runTransaction(async transaction=>{const doc=await transaction.get(emergencyRef);if(!doc.exists)throw new Error('Emergency not found');const emergency=doc.data();if(emergency.status!=='reported')return;const count=Number(emergency.verificationCount||0)+1;transaction.update(emergencyRef,{verificationCount:count,status:count>=2?'verified':'reported',verifiedAt:count>=2?FieldValue.serverTimestamp():null});});
});

exports.openEmergencyWallet = functions.firestore.document('emergencies/{emergencyId}').onUpdate(async (change, context) => {
  const before=change.before.data(),emergency=change.after.data();
  if(before.status===emergency.status||emergency.status!=='verified')return null;
  const walletRef = db.collection('emergencyWallets').doc(context.params.emergencyId);
  const ledgerRef = db.collection('ledgerEntries').doc();
  const eventRef=db.collection('events').doc(`emergency-${context.params.emergencyId}`);
  const batch = db.batch();
  batch.set(walletRef, {emergencyId: context.params.emergencyId, currency: 'PKR', balanceMinor: 0, status: 'open', createdAt: FieldValue.serverTimestamp()});
  batch.set(ledgerRef, {walletId: walletRef.id, type: 'wallet_opened', amountMinor: 0, description: emergency.title || 'Emergency relief wallet opened', immutable: true, createdAt: FieldValue.serverTimestamp()});
  batch.set(eventRef,{title:`Verified emergency: ${emergency.title||'Incident'}`,body:`${emergency.locationLabel||emergency.scopeId||''}. Relief ledger opened with zero balance; donations require provider confirmation.`,type:'emergency_verified',scope:emergency.scope||'city',scopeId:emergency.scopeId||'',sourceId:context.params.emergencyId,createdAt:FieldValue.serverTimestamp()});
  return batch.commit();
});

exports.publishPostEvent=functions.firestore.document('posts/{postId}').onCreate(async(snap,context)=>{
  const post=snap.data();if(!['society','city','country','global'].includes(post.scope))return null;
  return db.collection('events').doc(`post-${context.params.postId}`).set({title:`${post.type||'Community'} update`,body:String(post.text||'').slice(0,220),type:'post',scope:post.scope,scopeId:post.scopeId||'',sourceId:context.params.postId,createdAt:FieldValue.serverTimestamp()});
});

exports.publishProposalEvent=functions.firestore.document('proposals/{proposalId}').onCreate(async(snap,context)=>{
  const proposal=snap.data();if(!['society','city','country','global'].includes(proposal.scope))return null;
  return db.collection('events').doc(`proposal-${context.params.proposalId}`).set({title:`New governed discussion: ${proposal.title||'Proposal'}`,body:String(proposal.summary||'').slice(0,220),type:'proposal',scope:proposal.scope,scopeId:proposal.scopeId||'',sourceId:context.params.proposalId,createdAt:FieldValue.serverTimestamp()});
});

// Keeps a user's public community list in sync only after an authorized reviewer
// changes the membership from pending to active. Private residence fields stay in
// the member document and are never copied into the public profile.
exports.syncApprovedMembership = functions.firestore.document('communities/{communityId}/members/{uid}').onUpdate(async (change, context) => {
  const before = change.before.data();
  const after = change.after.data();
  if (before.status === after.status || after.status !== 'active') return null;
  return db.collection('publicProfiles').doc(context.params.uid).set({
    communityIds: FieldValue.arrayUnion(context.params.communityId),
    updatedAt: FieldValue.serverTimestamp()
  }, {merge: true});
});
