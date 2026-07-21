/* Role-scoped operations center. Higher scope means coordination, not ownership. */
(function(){
  'use strict';
  if(!window.GAIGSAccessLogic)return;
  const Access=window.GAIGSAccessLogic,key='gaigsAccessAssignmentsV1';
  const uid=()=>fbAuth?.currentUser?.uid||state.user?.uid||state.user?.email||'offline-member';
  const cloudReady=()=>Boolean(firebaseAvailable&&window.NDCONF?.firebaseProductionMode===true&&fbAuth?.currentUser&&fbDb);
  function assignments(){
    const stored=JSON.parse(localStorage.getItem(key)||'[]');
    const baseline={id:'member-self',uid:uid(),role:'member',scope:'personal',scopeId:uid(),status:'active',source:'verified account'};
    const owned=(state.communities||[]).filter(c=>c.ownerId===uid()||c.createdBy===uid()||c.role==='admin').map(c=>({id:`society-admin-${c.id}`,uid:uid(),role:'society_admin',scope:'society',scopeId:c.id,status:'active',source:'society creator'}));
    return Access.activeAssignments([baseline,...stored,...owned].filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i));
  }
  function roleLabel(role){return role.split('_').map(x=>x[0].toUpperCase()+x.slice(1)).join(' ');}
  function assignmentList(){
    return assignments().map(a=>`<div class="activity-item"><div class="activity-icon">${esc(a.role.split('_').map(x=>x[0]).join('').toUpperCase())}</div><div><b>${esc(roleLabel(a.role))}</b><p>${esc(a.scope)} · ${esc(a.scopeId||'all assigned')} · ${esc(a.source||'server assignment')}</p><div class="meta-row"><span class="tag green">ACTIVE</span>${a.expiresAt?`<span class="tag">Expires ${esc(a.expiresAt)}</span>`:''}</div></div></div>`).join('');
  }
  const panels=[
    {scope:'society',role:'society_admin',title:'Society operations',action:'manage_society_workspace',summary:'Membership review, moderation, roles, project proof, and society audit.',view:'communityAdmin'},
    {scope:'city',role:'city_operator',title:'City operations',action:'manage_scope_directory',summary:'Society directory, cross-society missions, escalations, and city evidence.'},
    {scope:'country',role:'country_operator',title:'Country operations',action:'manage_scope_directory',summary:'National programs, standards, regional escalations, and public reporting.'},
    {scope:'global',role:'global_operator',title:'Global operations',action:'coordinate_mission',summary:'Global missions, emergency visibility, shared learning, and standards.'},
    {scope:'global',role:'system_admin',title:'Platform administration',action:'configure_platform',summary:'Security, service health, operator assignment, abuse controls, and configuration.'}
  ];
  function panelCard(panel){
    const mine=assignments().filter(a=>a.role===panel.role),allowed=mine.some(a=>Access.can(a.role,panel.action));
    const body=`<div class="operation-panel-head"><span class="tag ${allowed?'green':'gold'}">${allowed?'AUTHORIZED':'ACCESS REQUIRED'}</span><span>${esc(roleLabel(panel.role))}</span></div><p class="muted">${esc(panel.summary)}</p><div class="rule-card"><h4>Cannot cross this boundary</h4><p>${panel.role==='system_admin'?'System admins cannot cast member votes or move user/community funds.':'This operator cannot edit ballots, override outcomes, erase audit records, or take over lower-scope decisions.'}</p></div>${allowed?`<button class="action-btn" data-operation-open="${esc(panel.role)}" ${panel.view?`data-operation-view="${panel.view}"`:''}>Open authorized workspace</button>`:`<button class="ghost-btn" disabled>Server-issued role required</button>`}`;
    return card(panel.title,body,4,allowed?'operation-authorized':'operation-locked');
  }
  views.operations=function(){
    const list=assignments();return `${pageHead('Authority & operations','One account, separately verified roles. Every operator action is scoped, expiring, and audited.','')}<div class="capability-strip"><span class="tag ${cloudReady()?'green':'gold'}">${cloudReady()?'SERVER ROLES CONNECTED':'OFFLINE ROLE VIEW'}</span><b>${list.length} active assignment${list.length===1?'':'s'}</b><span>Viewing a scope never grants authority inside it.</span></div><div class="dashboard-grid">${card('My verified assignments',assignmentList(),12)}${panels.map(panelCard).join('')}${card('Universal separation of power',`<div class="authority-grid"><div><b>People decide</b><span>Eligible members cast their own ballots.</span></div><div><b>Operators coordinate</b><span>They run queues, standards, and visibility.</span></div><div><b>Treasurers record</b><span>Settlement still needs approved purpose and proof.</span></div><div><b>JARVIS assists</b><span>It explains and drafts but never approves.</span></div></div>`,12)}</div>`;
  };
  viewNames.operations='Authority and operations';
  async function loadCloudAssignments(){
    if(!cloudReady())return;
    try{const snapshot=await fbDb.collection('scopeAssignments').where('uid','==',uid()).where('status','==','active').limit(50).get(),items=[];snapshot.forEach(doc=>items.push({id:doc.id,...doc.data(),source:'server assignment'}));localStorage.setItem(key,JSON.stringify(items));if(state.view==='operations')render();}
    catch(error){console.warn('[GAIGS] Role assignments unavailable:',error.message);}
  }
  const priorBindDynamic=bindDynamic;
  bindDynamic=function(){priorBindDynamic();$$('[data-operation-open]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.operationView)return navigate(button.dataset.operationView);const role=button.dataset.operationOpen;openModal(`<h2>${esc(roleLabel(role))}</h2><p class="muted">This role is active, but its dedicated operational queue has no assigned records yet. No placeholder action was executed.</p><div class="rule-card"><h4>Authority verified</h4><p>The server assignment permits the workspace. Decisions and funds remain outside operator control.</p></div>`);}));};
  if(firebaseAvailable&&fbAuth)fbAuth.onAuthStateChanged(user=>{if(user)loadCloudAssignments();});
  loadCloudAssignments();
})();
