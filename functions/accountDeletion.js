const functions=require('firebase-functions/v1');
const {getApps,initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const crypto=require('node:crypto');
if(!getApps().length)initializeApp();
const db=getFirestore();

exports.requestAccountDeletion=functions.https.onCall(async(_data,context)=>{
  if(!context.auth)throw new functions.https.HttpsError('unauthenticated','Sign in required');
  const authTime=Number(context.auth.token.auth_time||0)*1000;
  if(!authTime||Date.now()-authTime>10*60*1000)throw new functions.https.HttpsError('failed-precondition','Please sign in again before requesting deletion');
  const uid=context.auth.uid;
  await db.collection('accountDeletionRequests').doc(uid).set({uid,status:'pending',requestedAt:FieldValue.serverTimestamp(),policyVersion:'GAIGS-PRIVACY-1.0'});
  await getAuth().updateUser(uid,{disabled:true});
  return {status:'pending',message:'Account access is disabled and deletion has entered the purge queue.'};
});

async function deleteOwned(collection,field,uid){
  const snapshot=await db.collection(collection).where(field,'==',uid).limit(201).get(),batch=db.batch();
  snapshot.docs.slice(0,200).forEach(doc=>batch.delete(doc.ref));if(snapshot.size)await batch.commit();return snapshot.size>200;
}
async function purge(uid){
  const targets=[['posts','authorId'],['companies','ownerId'],['projects','createdBy'],['serviceRequests','createdBy'],['connections','ownerId'],['messages','senderId'],['messages','ownerId'],['challengeSubmissions','ownerId'],['membershipRequests','uid']];
  let hasMore=false;for(const [collection,field] of targets)hasMore=(await deleteOwned(collection,field,uid))||hasMore;
  const ballots=await db.collectionGroup('votes').where('voterId','==',uid).limit(201).get(),ballotBatch=db.batch();ballots.docs.slice(0,200).forEach(doc=>ballotBatch.delete(doc.ref));if(ballots.size)await ballotBatch.commit();hasMore=ballots.size>200||hasMore;
  if(hasMore)return false;
  for(const ref of [db.collection('users').doc(uid),db.collection('publicProfiles').doc(uid),db.collection('walletAccounts').doc(uid),db.collection('notifications').doc(uid)])await db.recursiveDelete(ref).catch(()=>{});
  await getAuth().deleteUser(uid).catch(error=>{if(error.code!=='auth/user-not-found')throw error;});
  const receiptId=crypto.randomUUID();await db.collection('accountDeletionReceipts').doc(receiptId).set({status:'completed',completedAt:FieldValue.serverTimestamp(),policyVersion:'GAIGS-PRIVACY-1.0'});await db.collection('accountDeletionRequests').doc(uid).delete();return true;
}
exports.purgeDeletedAccounts=functions.pubsub.schedule('every 15 minutes').onRun(async()=>{
  const requests=await db.collection('accountDeletionRequests').where('status','==','pending').limit(10).get();
  for(const doc of requests.docs)await purge(doc.id);
  return null;
});
