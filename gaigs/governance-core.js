/* Deterministic governance lifecycle, private ballots, and honest audit receipts. */
(function(){
  'use strict';
  if(!window.GAIGSGovernanceLogic)return;
  const Logic=window.GAIGSGovernanceLogic;
  const auditKey='gaigsGovernanceAuditV2';
  const currentUid=()=>fbAuth?.currentUser?.uid||state.user?.uid||state.user?.email||'offline-member';
  const cloudReady=()=>Boolean(firebaseAvailable&&window.NDCONF?.firebaseProductionMode===true&&fbAuth?.currentUser&&fbDb);
  const normalizeScope=value=>String(value||state.scope||'society').toLowerCase();
  const proposalStatus=p=>Logic.normalizeStatus(p?.status);
  const proposalRule=p=>p?.ruleKey||(/rule|constitution/i.test(p?.title||'')?'constitutional':'standard');
  const scopeIdFor=scope=>{
    if(scope==='society')return (state.communities||[]).find(c=>(state.user?.communityIds||[]).includes(c.id)||c.role==='admin'||c.ownerId===currentUid())?.id||(state.user?.communityIds||[])[0]||state.community;
    if(scope==='city')return state.user?.city||'unassigned-city';
    if(scope==='country')return state.user?.country||'unassigned-country';
    return 'global';
  };
  const eligibleFor=p=>{
    if(!state.user)return false;
    if(!cloudReady())return true;
    if(state.user.kycStatus!=='verified')return false;
    if(normalizeScope(p.scope)==='society')return Boolean((state.user?.communityIds||[]).includes(p.scopeId)||(state.communities||[]).some(c=>c.id===p.scopeId&&(c.role==='admin'||c.ownerId===currentUid())));
    return true; // Firestore rules make the final verified-jurisdiction decision.
  };
  const eligibleCount=p=>Math.max(1,Number(p.eligibleCount||p.eligible||1284));
  const countsFor=p=>{
    const mine=state.votes[p.id];
    return {yes:Number(p.yes||p.tally?.yes||0)+(mine==='yes'?1:0),no:Number(p.no||p.tally?.no||0)+(mine==='no'?1:0),abstain:Number(p.abstain||p.tally?.abstain||0)+(mine==='abstain'?1:0)};
  };
  function governanceTally(p){return Logic.tally(countsFor(p),eligibleCount(p),proposalRule(p));}
  function lifecycleBadge(p){
    const status=proposalStatus(p),classes=['approved','completed','implementation'].includes(status)?'green':['rejected','canceled','disputed'].includes(status)?'red':'gold';
    return `<span class="tag ${classes}">${esc(status.replace(/_/g,' ').toUpperCase())}</span>`;
  }
  function governanceCard(p){
    const tally=governanceTally(p),rule=Logic.ruleFor(proposalRule(p)),mine=state.votes[p.id],status=proposalStatus(p),open=status==='voting';
    const closes=p.closesAt||p.votingClosesAt||p.deadline||'Server-controlled phase';
    const result=open?`${tally.turnoutPercent}% turnout · ${tally.approvalPercent}% approval`:`${tally.cast.toLocaleString()} aggregate ballots`;
    return `<article class="proposal-item governance-record">
      <div class="governance-record-head"><div><div class="meta-row"><span class="tag">${esc(normalizeScope(p.scope).toUpperCase())}</span>${lifecycleBadge(p)}<span class="tag">${esc(rule.label)}</span></div><h3>${esc(p.title)}</h3></div><span class="tag">${esc(String(closes))}</span></div>
      <p class="muted">${esc(p.summary||p.description||'No summary supplied.')}</p>
      <div class="metric-row"><div class="metric"><small>Eligible snapshot</small><b>${tally.eligible.toLocaleString()}</b></div><div class="metric"><small>Quorum</small><b>${rule.quorumPercent}%</b></div><div class="metric"><small>Approval rule</small><b>${rule.approvalPercent}%</b></div></div>
      <div class="progress" style="margin-top:12px"><span style="width:${Math.min(100,tally.turnoutPercent)}%"></span></div>
      <div class="meta-row"><span class="tag green">Yes ${tally.yes}</span><span class="tag red">No ${tally.no}</span><span class="tag">Abstain ${tally.abstain}</span><span class="tag ${tally.quorumMet?'green':'gold'}">${esc(result)}</span></div>
      <div class="governance-proof"><b>Rules ${esc(Logic.VERSION)}</b><span>Ballots are one-per-account and private. Public totals are server aggregated; blockchain anchoring is a separate receipt.</span></div>
      <div class="rule-actions"><button class="mini-btn" data-action="jarvis">Explain with JARVIS</button><button class="mini-btn" data-governance-proof="${esc(p.id)}">Audit details</button>${open?`<button class="action-btn" data-vote="${esc(p.id)}" data-choice="yes" ${mine?'disabled':''}>${mine?'Vote recorded':'Vote yes'}</button><button class="ghost-btn" data-vote="${esc(p.id)}" data-choice="no" ${mine?'disabled':''}>Vote no</button><button class="ghost-btn" data-vote="${esc(p.id)}" data-choice="abstain" ${mine?'disabled':''}>Abstain</button>`:''}</div>
    </article>`;
  }
  proposalCard=governanceCard;
  rulesPanel=function(){return Object.values(Logic.rules).map(rule=>`<div class="rule-card"><h4>${esc(rule.label)}</h4><p>${rule.discussionHours}h discussion · ${rule.votingHours}h voting · ${rule.quorumPercent}% quorum · ${rule.approvalPercent}% approval · ${rule.minEvidence} evidence minimum.</p></div>`).join('')+`<div class="rule-card"><h4>Authority boundary</h4><p>JARVIS explains. Operators run the workflow. Eligible people vote. No administrator can edit a ballot or declare an outcome from the browser.</p></div>`};
  views.governance=function(){
    const records=state.proposals||[],open=records.filter(p=>proposalStatus(p)==='voting').length,connected=cloudReady();
    return `${pageHead(`${getScopeLabel()} governance`,'Evidence becomes discussion; time-bound rules open voting; the server closes and tallies the decision.',`<button class="action-btn" data-action="proposal">＋ New proposal</button>`)}
      <div class="capability-strip"><span class="tag ${connected?'green':'gold'}">${connected?'LIVE PILOT DATA':'INTERACTIVE PREVIEW'}</span><b>${open} vote${open===1?'':'s'} open</b><span>Individual ballots stay private; aggregate results remain inspectable.</span></div>
      <div class="dashboard-grid"><section class="span-8"><div class="proposal-list">${records.length?records.map(governanceCard).join(''):'<div class="empty-state"><h3>No proposals in this scope</h3><p>Create a proposal to begin structured discussion.</p></div>'}</div></section>${card('Published decision rules',rulesPanel(),4)}</div>`;
  };
  async function sha256(value){
    if(!crypto?.subtle)return null;
    const bytes=new TextEncoder().encode(value),hash=await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function appendLocalReceipt(proposalId,choice){
    const records=JSON.parse(localStorage.getItem(auditKey)||'[]'),previousHash=records.at(-1)?.hash||null;
    const record={id:`ballot_${Date.now().toString(36)}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`,proposalId,voterId:currentUid(),choice,createdAt:new Date().toISOString(),previousHash,rulesVersion:Logic.VERSION,mode:'offline_sandbox'};
    record.hash=await sha256(JSON.stringify(record));records.push(record);localStorage.setItem(auditKey,JSON.stringify(records));return record;
  }
  function receiptModal(record,cloud){
    const proof=record.hash?`${record.hash.slice(0,18)}…`:'Server receipt ID pending';
    openModal(`<h2>Ballot receipt</h2><div class="rule-card"><p><b>Proposal:</b> ${esc(record.proposalId)}</p><p><b>Choice:</b> stored ${cloud?'privately on the shared ledger':'in this private preview'}</p><p><b>Receipt:</b> <span class="mono">${esc(proof)}</span></p><p><b>Status:</b> ${cloud?'Server aggregation pending. No blockchain claim is made until an anchor transaction is confirmed.':'Preview ballot only. This is not a public or blockchain vote.'}</p></div><button class="action-btn" data-modal-close>Done</button>`);
  }
  vote=async function(id,choice){
    const proposal=(state.proposals||[]).find(p=>String(p.id)===String(id));if(!proposal)return toast('Proposal not found.');
    if(state.votes[id])return toast('This account already has a ballot receipt for this proposal.');
    const validation=Logic.validateVote({voterId:currentUid(),choice,status:proposal.status,isEligible:eligibleFor(proposal),closesAt:proposal.closesAt||proposal.votingClosesAt});
    if(!validation.valid)return toast(validation.reason);
    try{
      if(cloudReady()){
        if(!fbAuth.currentUser.emailVerified)throw new Error('Verify your email before voting.');
        const voteRef=fbDb.collection('proposals').doc(String(id)).collection('votes').doc(currentUid()),nonce=crypto.getRandomValues(new Uint32Array(2)).join('-');
        await fbDb.runTransaction(async tx=>{const existing=await tx.get(voteRef);if(existing.exists)throw new Error('A ballot already exists for this account.');tx.set(voteRef,{voterId:currentUid(),choice:String(choice).toLowerCase(),rulesVersion:Logic.VERSION,clientNonce:nonce,createdAt:firebase.firestore.FieldValue.serverTimestamp()});});
        state.votes[id]=choice;save();render();receiptModal({proposalId:String(id),hash:null},true);return;
      }
      const receipt=await appendLocalReceipt(String(id),String(choice).toLowerCase());state.votes[id]=choice;save();render();receiptModal(receipt,false);
    }catch(error){toast(error.message||'Ballot could not be recorded.');}
  };
  proposalForm=function(prefix=''){
    return `<form id="proposalCreateForm" class="form-grid"><label>Proposal title<input id="proposalTitle" value="${esc(prefix)}" maxlength="160" required></label><label>Decision type<select id="proposalRule"><option value="standard">Standard decision</option><option value="constitutional">Constitution amendment</option><option value="emergency">Verified emergency</option></select></label><label>Decision scope<select id="proposalScope"><option>Society</option><option>City</option><option>Country</option><option>Global</option></select></label><label>Problem, solution, success measure, and affected people<textarea id="proposalBody" maxlength="5000" required></textarea></label><label>First evidence or source summary<textarea id="proposalEvidence" maxlength="1200" required></textarea></label><label>Estimated budget (PKR; zero if none)<input id="proposalBudget" type="number" min="0" step="1" value="0"></label><button class="primary" type="submit">Open governed discussion</button></form>`;
  };
  async function createProposal(event){
    event.preventDefault();event.stopImmediatePropagation();
    const title=$('#proposalTitle').value.trim(),scope=normalizeScope($('#proposalScope').value),ruleKey=$('#proposalRule').value,summary=$('#proposalBody').value.trim(),evidence=$('#proposalEvidence').value.trim(),budget=Number($('#proposalBudget').value||0),rule=Logic.ruleFor(ruleKey),id=`proposal_${Date.now().toString(36)}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
    if(cloudReady()&&state.user.kycStatus!=='verified')return toast('Identity review must be verified before creating a governance proposal.');
    if(cloudReady()&&scope==='society'&&!(state.user.communityIds||[]).length&&!(state.communities||[]).some(c=>c.ownerId===currentUid()||c.createdBy===currentUid()))return toast('Join or create a verified society before opening a society proposal.');
    const record={id,title,scope,scopeId:scopeIdFor(scope),ruleKey,rulesVersion:Logic.VERSION,status:'discussion',summary,budget,evidence:1,evidenceCount:1,yes:0,no:0,abstain:0,eligibleCount:scope==='society'?1284:1,deadline:`Discussion open for ${rule.discussionHours} hours`,createdBy:currentUid(),createdAt:new Date().toISOString(),discussionClosesAt:new Date(Date.now()+rule.discussionHours*3600000).toISOString()};
    try{
      if(cloudReady()){
        const proposalRef=fbDb.collection('proposals').doc(id),evidenceRef=proposalRef.collection('evidence').doc(`evidence_${Date.now().toString(36)}`),batch=fbDb.batch();
        batch.set(proposalRef,{...record,createdAt:firebase.firestore.FieldValue.serverTimestamp(),discussionClosesAt:firebase.firestore.Timestamp.fromDate(new Date(record.discussionClosesAt)),eligibleCount:null});
        batch.set(evidenceRef,{authorId:currentUid(),summary:evidence,createdAt:firebase.firestore.FieldValue.serverTimestamp(),status:'submitted'});await batch.commit();
      }else state.proposals.unshift(record);
      save();closeModal();navigate('governance');toast(cloudReady()?'Proposal opened for shared discussion.':'Proposal added to the private interactive preview.');
    }catch(error){toast(error.message||'Proposal could not be created.');}
  }
  const priorBindModal=bindModal;
  bindModal=function(){priorBindModal();const form=$('#proposalCreateForm');if(form&&!form.dataset.governanceBound){form.dataset.governanceBound='1';form.addEventListener('submit',createProposal,true);}};
  const priorBindDynamic=bindDynamic;
  bindDynamic=function(){priorBindDynamic();$$('[data-governance-proof]').forEach(button=>button.addEventListener('click',()=>{const p=(state.proposals||[]).find(x=>String(x.id)===button.dataset.governanceProof),t=p?governanceTally(p):null;if(!p||!t)return;openModal(`<h2>Governance audit details</h2><div class="rule-card"><p><b>Rules version:</b> ${esc(t.rulesVersion)}</p><p><b>Scope:</b> ${esc(normalizeScope(p.scope))} · ${esc(p.scopeId||'scope snapshot pending')}</p><p><b>Eligible snapshot:</b> ${t.eligible}</p><p><b>Aggregate ballots:</b> ${t.cast}</p><p><b>Turnout:</b> ${t.turnoutPercent}%</p><p><b>Current calculated outcome:</b> ${esc(t.outcome.replace('_',' '))}</p></div><p class="muted">Only the scheduled server lifecycle can finalize an outcome after the voting deadline.</p>`);}));};
  let governanceStops=[];
  async function startScopedGovernance(user){
    governanceStops.forEach(stop=>stop());governanceStops=[];if(!user||!window.NDCONF?.firebaseProductionMode)return;
    const profile=await fbDb.collection('publicProfiles').doc(user.uid).get().then(doc=>doc.exists?doc.data():{}).catch(()=>({})),parts=new Map(),specs=[['global','global'],profile.country&&['country',profile.country],profile.city&&['city',profile.city],...(profile.communityIds||[]).slice(0,10).map(id=>['society',id])].filter(Boolean);
    const merge=()=>{const seen=new Set();state.proposals=[...parts.values()].flat().filter(p=>!seen.has(p.id)&&seen.add(p.id)).sort((a,b)=>new Date(b.createdAtRaw||0)-new Date(a.createdAtRaw||0));save();if(['governance','overview','global','projects'].includes(state.view))render();};
    specs.forEach(([scope,scopeId])=>{const key=`${scope}:${scopeId}`,stop=fbDb.collection('proposals').where('scope','==',scope).where('scopeId','==',scopeId).orderBy('createdAt','desc').limit(100).onSnapshot(snapshot=>{parts.set(key,snapshot.docs.map(doc=>{const d=doc.data(),created=d.createdAt?.toDate?.(),votingClose=d.votingClosesAt?.toDate?.(),discussionClose=d.discussionClosesAt?.toDate?.();return {id:doc.id,...d,summary:d.summary||d.description||'',yes:Number(d.tally?.yes||0),no:Number(d.tally?.no||0),abstain:Number(d.tally?.abstain||0),evidence:d.evidenceCount||0,deadline:(votingClose||discussionClose)?.toLocaleString()||'Server-controlled phase',closesAt:votingClose?.toISOString()||null,createdAtRaw:created?.toISOString()||''};}));merge();},error=>console.warn(`[GAIGS] ${key} governance unavailable:`,error.message));governanceStops.push(stop);});
  }
  if(firebaseAvailable&&fbAuth)fbAuth.onAuthStateChanged(startScopedGovernance);
})();
