(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GAIGSGovernanceLogic=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='gaigs-governance-1.0';
  const rules={
    standard:{key:'standard',label:'Standard decision',discussionHours:72,votingHours:72,quorumPercent:40,approvalPercent:50,minEvidence:1},
    constitutional:{key:'constitutional',label:'Constitution amendment',discussionHours:168,votingHours:120,quorumPercent:60,approvalPercent:66.67,minEvidence:2},
    emergency:{key:'emergency',label:'Verified emergency decision',discussionHours:1,votingHours:6,quorumPercent:20,approvalPercent:60,minEvidence:2}
  };
  const choices=['yes','no','abstain'];
  const transitions={draft:['discussion'],discussion:['voting','withdrawn'],voting:['approved','rejected','no_quorum','canceled'],approved:['implementation'],implementation:['completed','disputed'],disputed:['implementation','canceled']};
  function ruleFor(key){return rules[key]||rules.standard;}
  function normalizeStatus(value){return String(value||'draft').trim().toLowerCase().replace(/\s+/g,'_');}
  function percent(part,total){return total>0?Math.round((part/total)*10000)/100:0;}
  function tally(input,eligibleCount,ruleKey='standard'){
    const counts={yes:0,no:0,abstain:0};
    if(Array.isArray(input)){
      const seen=new Set();
      input.forEach(v=>{const voter=String(v?.voterId||'');const choice=String(v?.choice||'').toLowerCase();if(!voter||seen.has(voter)||!choices.includes(choice))return;seen.add(voter);counts[choice]++;});
    }else{
      choices.forEach(choice=>{const n=Number(input?.[choice]||0);counts[choice]=Number.isFinite(n)&&n>0?Math.floor(n):0;});
    }
    const eligible=Math.max(0,Math.floor(Number(eligibleCount)||0));
    const cast=counts.yes+counts.no+counts.abstain;
    const decisive=counts.yes+counts.no;
    const turnoutPercent=percent(cast,eligible);
    const approvalPercent=percent(counts.yes,decisive);
    const rule=ruleFor(ruleKey);
    const quorumMet=turnoutPercent>=rule.quorumPercent;
    const approved=quorumMet&&decisive>0&&approvalPercent>=rule.approvalPercent;
    return {...counts,cast,eligible,decisive,turnoutPercent,approvalPercent,quorumMet,approved,outcome:quorumMet?(approved?'approved':'rejected'):'no_quorum',ruleKey:rule.key,rulesVersion:VERSION};
  }
  function canTransition(from,to,context={}){
    from=normalizeStatus(from);to=normalizeStatus(to);
    if(!(transitions[from]||[]).includes(to))return {allowed:false,reason:'Invalid lifecycle transition'};
    if(from==='discussion'&&to==='voting'){
      const rule=ruleFor(context.ruleKey);if(Number(context.evidenceCount||0)<rule.minEvidence)return {allowed:false,reason:`At least ${rule.minEvidence} evidence record(s) required`};
      if(!context.discussionClosed)return {allowed:false,reason:'Discussion period is still open'};
    }
    if(from==='voting'&&['approved','rejected','no_quorum'].includes(to)&&!context.votingClosed)return {allowed:false,reason:'Voting period is still open'};
    return {allowed:true,reason:'Allowed by lifecycle rules'};
  }
  function validateVote({voterId,choice,status,isEligible,closesAt,now=Date.now()}){
    if(!voterId)return {valid:false,reason:'A verified voter is required'};
    if(!choices.includes(String(choice||'').toLowerCase()))return {valid:false,reason:'Invalid ballot choice'};
    if(normalizeStatus(status)!=='voting')return {valid:false,reason:'This proposal is not open for voting'};
    if(!isEligible)return {valid:false,reason:'This account is not eligible in the proposal scope'};
    if(closesAt&&new Date(closesAt).getTime()<=Number(now))return {valid:false,reason:'Voting has closed'};
    return {valid:true,reason:'Ballot is eligible'};
  }
  return {VERSION,rules,choices,transitions,ruleFor,normalizeStatus,tally,canTransition,validateVote};
});
