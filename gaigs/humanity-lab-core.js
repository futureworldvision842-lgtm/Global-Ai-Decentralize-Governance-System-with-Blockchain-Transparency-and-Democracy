/* Interactive Humanity Lab runs with reviewable receipts, never self-minted money. */
(function(){
  'use strict';
  const key='gaigsHumanityLabV1';
  const cloudReady=()=>Boolean(firebaseAvailable&&window.NDCONF?.firebaseProductionMode===true&&fbAuth?.currentUser&&fbDb);
  const uid=()=>fbAuth?.currentUser?.uid||state.user?.uid||state.user?.email||'offline-player';
  const catalog=[{
    id:'daily-resilience-world',title:'Daily Resilience World',domain:'Civic science',summary:'Build a tile-based neighbourhood with drainage, water, energy and shelter systems, then run a reproducible daily stress test.',engine:'Deterministic grid simulator',rulesVersion:'resilience-world-1.0',status:'connected_sandbox',page:'science-world.html'
  },{
    id:'water-routing-physics',title:'Water Routing Physics Lab',domain:'Water systems',summary:'Move and rotate a deflector to route falling particles under gravity into a target zone.',engine:'Three.js + Cannon-es',rulesVersion:'water-routing-1.0',status:'connected_sandbox',page:'science-game.html'
  }];
  let activeFrame=null,activeChallenge=null;
  function store(){return JSON.parse(localStorage.getItem(key)||'{"submissions":[]}');}
  function persist(value){localStorage.setItem(key,JSON.stringify(value));}
  function submissions(){return store().submissions||[];}
  function statusLabel(value){return value==='submitted_for_review'?'SUBMITTED FOR REVIEW':value==='completed_locally'?'LOCAL RUN COMPLETE':'NOT STARTED';}
  function challengeCard(challenge){
    const last=submissions().filter(x=>x.challengeId===challenge.id).at(-1);
    return card(challenge.title,`<div class="lab-preview"><div class="lab-orbit"><span></span></div><b>Interactive physics workspace</b></div><p class="muted">${esc(challenge.summary)}</p><div class="meta-row"><span class="tag">${esc(challenge.domain)}</span><span class="tag green">${esc(challenge.engine)}</span><span class="tag ${last?'green':'gold'}">${esc(statusLabel(last?.status))}</span></div><div class="governance-proof"><b>${esc(challenge.rulesVersion)}</b><span>A completed run creates a reproducible client receipt. Scientific claims and rewards require independent review.</span></div><button class="action-btn" style="margin-top:10px" data-lab-open="${esc(challenge.id)}">${last?'Run again':'Start simulation'}</button>`,8);
  }
  function submissionList(){
    const list=submissions();if(!list.length)return '<div class="empty-state"><h3>No completed runs</h3><p>Complete the interactive physics lab to create your first reviewable receipt.</p></div>';
    return `<div class="activity-list">${list.slice().reverse().map(s=>`<div class="activity-item"><div class="activity-icon">LAB</div><div><b>${esc(s.challengeId)}</b><p>${new Date(s.completedAt).toLocaleString()} · score ${Number(s.score||0)} · ${(Number(s.durationMs||0)/1000).toFixed(1)}s</p><div class="meta-row"><span class="tag ${s.status==='submitted_for_review'?'green':'gold'}">${esc(statusLabel(s.status))}</span><span class="tag mono">${esc(String(s.solutionHash||'').slice(0,12))}…</span></div></div></div>`).join('')}</div>`;
  }
  views.science=function(){
    const pending=(state.challenges||[]).length;
    return `${pageHead('Humanity Lab','Learn through real interaction, then submit datasets and evidence for peer or expert review.',`<button class="action-btn" data-action="challenge">＋ Propose a challenge</button>`)}<div class="capability-strip"><span class="tag green">INTERACTIVE SANDBOX</span><b>${catalog.length} playable lab</b><span>Game completion is learning evidence, not proof that a real-world solution works.</span></div><div class="dashboard-grid">${catalog.map(challengeCard).join('')}${card('My run receipts',submissionList(),4)}${pending?card('Proposed challenge briefs',`<div class="activity-list">${state.challenges.map(c=>`<div class="activity-item"><div class="activity-icon">NEW</div><div><b>${esc(c.title)}</b><p>${esc(c.goal)} · simulator and review protocol not built yet</p><span class="tag gold">DESIGN REVIEW</span></div></div>`).join('')}</div>`,12):''}</div>`;
  };
  function openChallenge(id){
    const challenge=catalog.find(x=>x.id===id)||catalog[Number(id)]||catalog[0];activeChallenge=challenge;
    const url=new URL(`../${challenge.page||'science-game.html'}`,location.href);url.searchParams.set('challenge',challenge.id);
    openModal(`<div class="lab-modal-head"><div><h2>${esc(challenge.title)}</h2><p class="muted">Touch, mouse, and keyboard-safe interactive run · ${esc(challenge.rulesVersion)}</p></div><span class="tag green">CONNECTED SANDBOX</span></div><iframe id="humanityLabFrame" class="humanity-lab-frame" title="${esc(challenge.title)}" src="${esc(url.href)}" allow="fullscreen"></iframe><p class="micro">Completion saves a run receipt. It does not mint currency, release a bounty, or certify a scientific result.</p>`);
    activeFrame=$('#humanityLabFrame');
  }
  async function saveCompletion(data){
    if(!activeChallenge||data.challengeId!==activeChallenge.id)return;
    const record={id:`submission_${Date.now().toString(36)}`,ownerId:uid(),challengeId:data.challengeId,score:Number(data.score||0),startedAt:Number(data.startedAt),completedAt:Number(data.completedAt),durationMs:Number(data.durationMs),engine:String(data.engine||''),rulesVersion:String(data.rulesVersion||''),solutionHash:String(data.solutionHash||''),status:cloudReady()?'submitted_for_review':'completed_locally',createdAt:new Date().toISOString()};
    const value=store();value.submissions=value.submissions||[];if(value.submissions.some(x=>x.solutionHash===record.solutionHash))return;value.submissions.push(record);persist(value);
    try{if(cloudReady())await fbDb.collection('challengeSubmissions').doc(record.id).set({...record,createdAt:firebase.firestore.FieldValue.serverTimestamp()});}
    catch(error){record.status='completed_locally';persist(value);toast('Run saved locally; review submission will need retry.');return;}
    closeModal();render();toast(cloudReady()?'Run submitted for review.':'Physics run completed and saved on this device.');
  }
  window.addEventListener('message',event=>{
    if(!activeFrame||event.source!==activeFrame.contentWindow)return;
    if(location.origin!=='null'&&event.origin!==location.origin)return;
    if(event.data?.type==='gaigs:challenge-completed')saveCompletion(event.data);
    if(event.data?.type==='gaigs:close-challenge')closeModal();
  });
  const priorBindDynamic=bindDynamic;
  bindDynamic=function(){priorBindDynamic();$$('[data-lab-open]').forEach(button=>button.addEventListener('click',()=>openChallenge(button.dataset.labOpen)));};
  window.GAIGSHumanityLab={open:openChallenge,catalog};
})();
