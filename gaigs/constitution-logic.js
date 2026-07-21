/* GAIGS constitutional defaults. Jurisdiction law always overrides platform defaults. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GAIGSConstitutionLogic=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='GAIGS-CONSTITUTION-1.0.0';
  const POLICY=Object.freeze({
    formation:Object.freeze({minimumFounders:10,petitionDays:14,votingDays:7,quorumPercent:70,approvalPercent:66.67,boundaryEvidenceMinimum:2}),
    clerk:Object.freeze({nominationDays:3,votingDays:5,termDays:365,maximumConsecutiveTerms:2,quorumPercent:30}),
    recall:Object.freeze({petitionPercent:15,minimumDaysAfterElection:30,votingDays:5,quorumPercent:35,approvalPercent:50}),
    constitution:Object.freeze({discussionDays:14,votingDays:7,quorumPercent:50,approvalPercent:66.67}),
    federation:Object.freeze({delegateTermDays:180,recallable:true,imperativeMandate:true}),
    privacy:Object.freeze({rawIdentityOnChain:false,exactHomeLocationPublic:false,privateBallots:true})
  });
  const CLERK_ACTIONS=new Set(['review_membership_evidence','publish_agenda','open_approved_vote','record_meeting_minutes','request_project_evidence','moderate_illegal_content','coordinate_emergency','publish_audit_export']);
  const RESERVED_ACTIONS=new Set(['cast_member_vote','change_ballot','declare_outcome','release_funds','edit_audit_record','appoint_successor','change_constitution','sell_member_data']);
  const number=value=>Number.isFinite(Number(value))?Number(value):0;
  function unique(items,key='memberId'){
    const ids=items.map(item=>String(item?.[key]||'').trim()).filter(Boolean);
    return ids.length===new Set(ids).size;
  }
  function validateFounders(founders,policy=POLICY.formation){
    const list=Array.isArray(founders)?founders:[];
    const reasons=[];
    if(list.length<policy.minimumFounders)reasons.push(`At least ${policy.minimumFounders} verified founding residents are required.`);
    if(!unique(list))reasons.push('Each founding resident may appear only once.');
    if(list.some(person=>!person?.memberId||person.residenceVerified!==true||person.inBoundary!==true))reasons.push('Every founder needs a verified residence claim inside the proposed boundary.');
    return {valid:reasons.length===0,reasons,count:list.length,version:VERSION};
  }
  function evaluateBinaryVote({yes=0,no=0,abstain=0,eligible=0,quorumPercent,approvalPercent}){
    yes=Math.max(0,number(yes));no=Math.max(0,number(no));abstain=Math.max(0,number(abstain));eligible=Math.max(0,number(eligible));
    const cast=yes+no+abstain,decisive=yes+no;
    const turnoutPercent=eligible?cast/eligible*100:0,approval=decisive?yes/decisive*100:0;
    const quorumMet=eligible>0&&turnoutPercent+Number.EPSILON>=number(quorumPercent);
    const approvalMet=decisive>0&&approval+Number.EPSILON>=number(approvalPercent);
    return {yes,no,abstain,eligible,cast,turnoutPercent:Number(turnoutPercent.toFixed(2)),approvalPercent:Number(approval.toFixed(2)),quorumMet,approvalMet,passed:quorumMet&&approvalMet};
  }
  function evaluateFormation(input,policy=POLICY.formation){
    const founders=validateFounders(input?.founders,policy),boundaryEvidence=Array.isArray(input?.boundaryEvidence)?input.boundaryEvidence:[];
    const boundaryValid=boundaryEvidence.filter(item=>item?.verified===true).length>=policy.boundaryEvidenceMinimum;
    const noOverlap=input?.overlapResolved===true;
    const vote=evaluateBinaryVote({...input?.vote,quorumPercent:policy.quorumPercent,approvalPercent:policy.approvalPercent});
    const passed=founders.valid&&boundaryValid&&noOverlap&&vote.passed;
    return {passed,founders,boundaryValid,noOverlap,vote,version:VERSION,reasons:[...founders.reasons,...(!boundaryValid?['Independent boundary evidence is incomplete.']:[]),...(!noOverlap?['Boundary overlap or appeal is unresolved.']:[]),...(!vote.quorumMet?['Formation quorum was not met.']:[]),...(vote.quorumMet&&!vote.approvalMet?['Formation approval threshold was not met.']:[])]};
  }
  function evaluateRecall(input,policy=POLICY.recall){
    const eligible=Math.max(0,number(input?.eligible));
    const petitionPercent=eligible?Math.max(0,number(input?.petitionSignatures))/eligible*100:0;
    const petitionMet=petitionPercent+Number.EPSILON>=policy.petitionPercent;
    const coolingPeriodMet=number(input?.daysSinceElection)>=policy.minimumDaysAfterElection;
    const vote=evaluateBinaryVote({...input?.vote,eligible,quorumPercent:policy.quorumPercent,approvalPercent:policy.approvalPercent});
    return {passed:petitionMet&&coolingPeriodMet&&vote.passed,petitionMet,coolingPeriodMet,petitionPercent:Number(petitionPercent.toFixed(2)),vote,version:VERSION};
  }
  function clerkPermission(action){
    const normalized=String(action||'').toLowerCase();
    return {allowed:CLERK_ACTIONS.has(normalized)&&!RESERVED_ACTIONS.has(normalized),action:normalized,version:VERSION};
  }
  function electClerk(candidates,eligible,policy=POLICY.clerk){
    const list=(Array.isArray(candidates)?candidates:[]).map(candidate=>({...candidate,votes:Math.max(0,number(candidate.votes))}));
    const cast=list.reduce((sum,item)=>sum+item.votes,0),turnoutPercent=number(eligible)?cast/number(eligible)*100:0;
    const ordered=list.slice().sort((a,b)=>b.votes-a.votes||String(a.memberId).localeCompare(String(b.memberId)));
    const tie=ordered.length>1&&ordered[0].votes===ordered[1].votes;
    return {elected:turnoutPercent+Number.EPSILON>=policy.quorumPercent&&!tie&&ordered[0]?.votes>0?ordered[0]:null,quorumMet:turnoutPercent+Number.EPSILON>=policy.quorumPercent,tie,cast,turnoutPercent:Number(turnoutPercent.toFixed(2)),version:VERSION};
  }
  return {VERSION,POLICY,CLERK_ACTIONS:[...CLERK_ACTIONS],RESERVED_ACTIONS:[...RESERVED_ACTIONS],validateFounders,evaluateBinaryVote,evaluateFormation,evaluateRecall,clerkPermission,electClerk};
});
