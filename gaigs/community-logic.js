(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GAIGSCommunityLogic=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const roles=['member','moderator','committee','treasurer','admin'];
  const decisions=['approved','rejected','needs_more_evidence'];
  function canManage(role){return role==='admin'||role==='committee';}
  function validRole(role){return roles.includes(role);}
  function reviewRequest(request,decision,reason,actorId){
    if(!request||!decisions.includes(decision))throw new Error('Invalid membership decision');
    if(decision!=='approved'&&!String(reason||'').trim())throw new Error('A reason is required');
    return {...request,status:decision==='approved'?'active':decision,role:decision==='approved'?'member':request.role||'applicant',reviewReason:String(reason||'').trim(),reviewedBy:actorId,reviewedAt:new Date().toISOString()};
  }
  function sanitizeCommunity(input){
    const name=String(input.name||'').trim(),location=String(input.location||'').trim(),purpose=String(input.purpose||'').trim();
    if(name.length<3||location.length<2)throw new Error('Community name and location are required');
    return {name:name.slice(0,120),location:location.slice(0,160),purpose:purpose.slice(0,1000),level:String(input.level||'Society').split(' /')[0]};
  }
  return {roles,decisions,canManage,validRole,reviewRequest,sanitizeCommunity};
});
