(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GAIGSProjectLogic=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='GAIGS-PROJECTS-1.0.0';
  const terminal=new Set(['released','rejected','canceled']);
  function releaseEligibility({projectStatus,milestone,approval}){
    const reasons=[];
    if(!['active','funded'].includes(String(projectStatus||'').toLowerCase()))reasons.push('Project must be active or funded.');
    if(!milestone||terminal.has(String(milestone.status||'').toLowerCase()))reasons.push('Milestone is not open for verification.');
    if(!milestone?.evidenceHash)reasons.push('Evidence hash is required.');
    if(!milestone?.providerId)reasons.push('Selected provider is required.');
    if(!milestone?.verifierId)reasons.push('An independent verifier is required.');
    if(milestone?.providerId&&milestone?.verifierId===milestone.providerId)reasons.push('Provider cannot verify their own milestone.');
    if(milestone?.createdBy&&milestone?.verifierId===milestone.createdBy)reasons.push('Milestone creator cannot be the only verifier.');
    if(!approval?.proposalId||approval?.passed!==true)reasons.push('A passed release decision is required.');
    if(String(approval?.milestoneId)!==String(milestone?.id))reasons.push('Release decision does not match this milestone.');
    if(Number(milestone?.amount||0)<=0)reasons.push('Milestone amount must be positive.');
    return {eligible:reasons.length===0,reasons,version:VERSION};
  }
  function contributionDraft({amount,projectId,memberId,currency='PKR'}){
    const value=Number(amount);
    if(!projectId||!memberId||!Number.isFinite(value)||value<=0)throw new Error('Project, member and a positive amount are required.');
    return {id:`contribution_${Date.now().toString(36)}`,projectId,memberId,amount:value,currency,status:'awaiting_settlement',createdAt:new Date().toISOString(),version:VERSION};
  }
  function fundingSummary(contributions,budget){
    const confirmed=(Array.isArray(contributions)?contributions:[]).filter(item=>item?.status==='confirmed').reduce((sum,item)=>sum+Number(item.amount||0),0);
    const target=Math.max(0,Number(budget||0));
    return {confirmed,target,remaining:Math.max(0,target-confirmed),percent:target?Math.min(100,Number((confirmed/target*100).toFixed(2))):0};
  }
  return {VERSION,releaseEligibility,contributionDraft,fundingSummary};
});
