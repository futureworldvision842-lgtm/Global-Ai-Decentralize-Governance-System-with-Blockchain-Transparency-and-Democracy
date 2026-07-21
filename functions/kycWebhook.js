const functions=require('firebase-functions/v1');
const {getApps,initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const crypto=require('crypto');
if(!getApps().length)initializeApp();
const db=getFirestore();

exports.kycProviderWebhook=functions.https.onRequest(async(req,res)=>{
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const secret=process.env.GAIGS_KYC_WEBHOOK_SECRET||'';if(!secret)return res.status(503).json({error:'KYC webhook is not configured'});
  const supplied=String(req.headers['x-gaigs-signature']||''),expected=crypto.createHmac('sha256',secret).update(req.rawBody||Buffer.from(JSON.stringify(req.body||{}))).digest('hex');
  if(!supplied||supplied.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return res.status(401).json({error:'Invalid signature'});
  const {eventId,uid,status,providerReference,reviewedAt}=req.body||{},allowed=['verified','rejected','needs_review'];if(!eventId||!uid||!allowed.includes(status)||!providerReference)return res.status(400).json({error:'Invalid minimal KYC event'});
  const eventRef=db.collection('kycEvents').doc(String(eventId)),userRef=db.collection('users').doc(String(uid));
  try{await db.runTransaction(async transaction=>{const [existing,user]=await Promise.all([transaction.get(eventRef),transaction.get(userRef)]);if(existing.exists)return;if(!user.exists)throw new Error('User not found');transaction.create(eventRef,{uid:String(uid),status,providerReference:String(providerReference).slice(0,240),reviewedAt:reviewedAt||null,receivedAt:FieldValue.serverTimestamp()});transaction.update(userRef,{kycStatus:status,kycProviderReference:String(providerReference).slice(0,240),kycUpdatedAt:FieldValue.serverTimestamp()});});return res.status(200).json({ok:true,eventId});}
  catch(error){return res.status(400).json({error:String(error.message||error).slice(0,160)});}
});
