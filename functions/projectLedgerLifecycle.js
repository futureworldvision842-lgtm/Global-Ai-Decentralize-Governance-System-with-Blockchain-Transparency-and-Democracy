const functions=require('firebase-functions/v1');
const {getApps,initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
if(!getApps().length)initializeApp();
const db=getFirestore();

exports.initializeTransparentProject=functions.firestore.document('projects/{projectId}').onCreate(async(snap,context)=>{
  const project=snap.data(),proposalSnap=await db.collection('proposals').doc(project.proposalId).get();
  if(!proposalSnap.exists||proposalSnap.data().status!=='approved'||proposalSnap.data().scope!==project.scope||proposalSnap.data().scopeId!==project.scopeId)return snap.ref.update({status:'blocked',blockedReason:'Approved proposal validation failed'});
  const milestones=Array.isArray(project.milestones)?project.milestones:[],batch=db.batch(),now=FieldValue.serverTimestamp();
  for(const [index,item] of milestones.slice(0,100).entries())batch.set(snap.ref.collection('milestones').doc(item.id||`${context.params.projectId}_m${index+1}`),{id:item.id||`${context.params.projectId}_m${index+1}`,title:item.title||`Milestone ${index+1}`,amount:Number(item.amount||0),status:'planned',createdBy:project.createdBy,providerId:item.providerId||'',evidenceHash:'',acceptedVerificationCount:0,createdAt:now});
  batch.update(snap.ref,{status:'active',projectAccountId:`PROJECT-${context.params.projectId.toUpperCase()}`,fundingStatus:'awaiting_settlement_provider',settlementMode:'disabled',serverInitializedAt:now});
  return batch.commit();
});

exports.aggregateMilestoneVerification=functions.firestore.document('projects/{projectId}/milestones/{milestoneId}/verifications/{uid}').onCreate(async(snap,context)=>{
  const record=snap.data(),milestoneRef=db.collection('projects').doc(context.params.projectId).collection('milestones').doc(context.params.milestoneId);
  return db.runTransaction(async transaction=>{const current=await transaction.get(milestoneRef);if(!current.exists)throw new Error('Milestone not found');const milestone=current.data();if(record.verifierId!==context.params.uid||record.verifierId===milestone.providerId||record.verifierId===milestone.createdBy||record.evidenceHash!==milestone.evidenceHash)throw new Error('Independent verification failed');transaction.update(milestoneRef,{acceptedVerificationCount:Number(milestone.acceptedVerificationCount||0)+1,verifierId:record.verifierId,lastVerifiedAt:FieldValue.serverTimestamp()});});
});

exports.authorizeVotedMilestoneRelease=functions.firestore.document('proposals/{proposalId}').onUpdate(async change=>{
  const before=change.before.data(),decision=change.after.data();
  if(before.status===decision.status||decision.status!=='approved'||decision.decisionType!=='milestone_release')return null;
  const projectRef=db.collection('projects').doc(decision.projectId),milestoneRef=projectRef.collection('milestones').doc(decision.milestoneId);
  return db.runTransaction(async transaction=>{const [projectSnap,milestoneSnap]=await Promise.all([transaction.get(projectRef),transaction.get(milestoneRef)]);if(!projectSnap.exists||!milestoneSnap.exists)throw new Error('Project or milestone missing');const project=projectSnap.data(),milestone=milestoneSnap.data();if(!['active','funded'].includes(project.status)||!milestone.evidenceHash||Number(milestone.acceptedVerificationCount||0)<1||Number(milestone.amount||0)<=0)throw new Error('Milestone is not release eligible');transaction.update(milestoneRef,{status:'release_authorized',releaseProposalId:change.after.id,releaseAuthorizedAt:FieldValue.serverTimestamp(),settlementStatus:'approved_awaiting_provider'});transaction.set(projectRef.collection('ledger').doc(`release_${decision.milestoneId}`),{type:'milestone_release_authorization',proposalId:change.after.id,milestoneId:decision.milestoneId,amount:milestone.amount,status:'approved_awaiting_provider',createdAt:FieldValue.serverTimestamp()});});
});
