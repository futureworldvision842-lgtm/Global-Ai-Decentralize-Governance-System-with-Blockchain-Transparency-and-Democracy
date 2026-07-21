const functions=require('firebase-functions/v1');
const {getApps,initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue,Timestamp}=require('firebase-admin/firestore');
if(!getApps().length)initializeApp();
const db=getFirestore();

const FORMATION={minimumFounders:10,boundaryEvidenceMinimum:2,quorumPercent:70,approvalPercent:66.67,constitutionVersion:'GAIGS-CONSTITUTION-1.0.0'};
const assertAuth=context=>{if(!context.auth)throw new functions.https.HttpsError('unauthenticated','Sign in required');return context.auth.uid;};

exports.requestSocietyRatification=functions.https.onCall(async(data,context)=>{
  const uid=assertAuth(context),petitionId=String(data?.petitionId||''),petitionRef=db.collection('societyPetitions').doc(petitionId),petitionSnap=await petitionRef.get();
  if(!petitionSnap.exists)throw new functions.https.HttpsError('not-found','Petition not found');
  const petition=petitionSnap.data();
  const founderRef=petitionRef.collection('founders').doc(uid),founderSnap=await founderRef.get();
  if(petition.createdBy!==uid&&!founderSnap.exists)throw new functions.https.HttpsError('permission-denied','Founding resident required');
  const [founders,evidence]=await Promise.all([petitionRef.collection('founders').where('residenceVerified','==',true).where('inBoundary','==',true).count().get(),petitionRef.collection('boundaryEvidence').where('verified','==',true).count().get()]);
  const founderCount=founders.data().count,evidenceCount=evidence.data().count;
  if(founderCount<FORMATION.minimumFounders)throw new functions.https.HttpsError('failed-precondition',`At least ${FORMATION.minimumFounders} verified founders required`);
  if(evidenceCount<FORMATION.boundaryEvidenceMinimum||petition.overlapResolved!==true)throw new functions.https.HttpsError('failed-precondition','Boundary evidence or overlap review is incomplete');
  if(petition.ratificationProposalId)return {proposalId:petition.ratificationProposalId,status:'already_requested'};
  const proposalRef=db.collection('proposals').doc(),now=Timestamp.now(),discussionClosesAt=Timestamp.fromMillis(now.toMillis()+14*24*3600000);
  const batch=db.batch();
  batch.create(proposalRef,{title:`Ratify society: ${petition.name}`,summary:`Residents decide whether to register ${petition.name} within the reviewed boundary.`,scope:'society',scopeId:petitionId,ruleKey:'constitutional',rulesVersion:FORMATION.constitutionVersion,status:'discussion',createdBy:uid,createdAt:now,discussionClosesAt,evidenceCount,eligibleCount:founderCount,tally:{yes:0,no:0,abstain:0,cast:0},decisionType:'society_formation',societyPetitionId:petitionId,formationPolicy:FORMATION});
  batch.update(petitionRef,{status:'ratification',ratificationProposalId:proposalRef.id,ratificationRequestedAt:now});
  await batch.commit();return {proposalId:proposalRef.id,status:'discussion'};
});

exports.createRatifiedSociety=functions.firestore.document('proposals/{proposalId}').onUpdate(async change=>{
  const before=change.before.data(),after=change.after.data();
  if(before.status===after.status||after.status!=='approved'||after.decisionType!=='society_formation'||!after.societyPetitionId)return null;
  const petitionRef=db.collection('societyPetitions').doc(after.societyPetitionId),petitionSnap=await petitionRef.get();if(!petitionSnap.exists)throw new Error('Formation petition missing');
  const petition=petitionSnap.data(),communityRef=db.collection('communities').doc(after.societyPetitionId),founders=await petitionRef.collection('founders').where('residenceVerified','==',true).where('inBoundary','==',true).get(),batch=db.batch(),now=FieldValue.serverTimestamp();
  batch.set(communityRef,{name:petition.name,location:petition.area,center:petition.center||'',level:'Society',status:'active',constitutionVersion:FORMATION.constitutionVersion,formationProposalId:change.after.id,memberCount:founders.size,createdAt:now,authorityModel:'elected_recallable_clerks'});
  founders.forEach(doc=>batch.set(communityRef.collection('members').doc(doc.id),{uid:doc.id,status:'active',role:'member',joinedAt:now,source:'formation_ratification'}));
  batch.update(petitionRef,{status:'active',communityId:communityRef.id,ratifiedAt:now});
  return batch.commit();
});
