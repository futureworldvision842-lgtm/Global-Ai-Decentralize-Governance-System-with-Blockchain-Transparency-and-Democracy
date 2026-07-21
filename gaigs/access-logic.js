(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GAIGSAccessLogic=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const rolePermissions={
    member:['view_public','create_post','create_proposal','vote_self','apply_service','submit_evidence'],
    society_moderator:['view_public','moderate_content','view_audit'],
    society_committee:['view_public','manage_members','verify_milestone','view_audit'],
    society_treasurer:['view_public','record_treasury','view_audit'],
    society_admin:['view_public','manage_members','moderate_content','manage_society_workspace','view_audit'],
    city_operator:['view_public','manage_scope_directory','coordinate_mission','moderate_escalation','view_audit'],
    country_operator:['view_public','manage_scope_directory','coordinate_mission','moderate_escalation','view_audit'],
    global_operator:['view_public','manage_scope_directory','coordinate_mission','moderate_escalation','view_audit'],
    auditor:['view_public','view_audit','export_audit'],
    system_admin:['view_public','configure_platform','manage_operator_assignments','security_response','view_audit']
  };
  const forbidden=new Set(['vote_for_other','erase_audit','change_ballot','move_user_money','unilateral_public_fund_release']);
  function validRole(role){return Object.prototype.hasOwnProperty.call(rolePermissions,role);}
  function can(role,action){if(forbidden.has(action))return false;return validRole(role)&&rolePermissions[role].includes(action);}
  function activeAssignments(assignments,now=Date.now()){
    return (assignments||[]).filter(a=>a&&a.status==='active'&&validRole(a.role)&&(!a.expiresAt||new Date(a.expiresAt).getTime()>now));
  }
  function authorized(assignments,action,target={}){
    return activeAssignments(assignments).some(a=>{
      if(!can(a.role,action))return false;
      if(['system_admin','auditor'].includes(a.role))return !a.scope||a.scope==='global'||a.scope===target.scope;
      return (!target.scope||a.scope===target.scope)&&(!target.scopeId||a.scopeId===target.scopeId);
    });
  }
  return {rolePermissions,forbidden,validRole,can,activeAssignments,authorized};
});
