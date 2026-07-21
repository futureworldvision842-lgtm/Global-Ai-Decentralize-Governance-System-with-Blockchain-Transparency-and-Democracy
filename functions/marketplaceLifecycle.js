const functions=require('firebase-functions/v1');
const {getApps,initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
if(!getApps().length)initializeApp();
const db=getFirestore();

exports.createServiceOrder=functions.firestore.document('serviceRequests/{requestId}').onUpdate(async(change,context)=>{
  const before=change.before.data(),request=change.after.data();
  if(before.status===request.status||request.status!=='offer_selected'||!request.selectedOfferId)return null;
  const offerRef=change.after.ref.collection('offers').doc(request.selectedOfferId),offerSnap=await offerRef.get();if(!offerSnap.exists)throw new Error('Selected offer not found');const offer=offerSnap.data(),orderRef=db.collection('serviceOrders').doc(`order_${context.params.requestId}`),batch=db.batch();
  batch.set(orderRef,{requestId:context.params.requestId,title:request.title,requesterId:request.createdBy,requesterName:request.requesterName||'Member',providerId:offer.providerId,providerName:offer.providerName||'Member',participants:[request.createdBy,offer.providerId].sort(),amountMinor:offer.amountMinor,currency:offer.currency||'PKR',estimatedDays:offer.estimatedDays,status:'selected',settlementStatus:'not_connected',createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
  batch.update(offerRef,{status:'accepted',acceptedAt:FieldValue.serverTimestamp()});
  batch.update(change.after.ref,{orderId:orderRef.id});
  return batch.commit();
});
