/* Production-readiness layer for shared accounts, nearby communities, services and wallet safety. */
(function(){
  'use strict';
  const sitesReady=()=>Boolean(window.gaigsApi?.active?.());
  const cloudReady=()=>sitesReady()||Boolean(firebaseAvailable&&window.NDCONF?.firebaseProductionMode===true&&fbAuth&&fbDb);
  const uid=()=>fbAuth?.currentUser?.uid||state.user?.uid||state.user?.email||'offline-user';
  const recordId=(p='record')=>`${p}_${Date.now().toString(36)}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
  const isoNow=()=>new Date().toISOString();
  const radians=n=>n*Math.PI/180;
  const distanceKm=(a,b)=>{
    if(!Number.isFinite(a?.lat)||!Number.isFinite(a?.lng)||!Number.isFinite(b?.lat)||!Number.isFinite(b?.lng))return null;
    const dLat=radians(b.lat-a.lat),dLng=radians(b.lng-a.lng);
    const q=Math.sin(dLat/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(dLng/2)**2;
    return 6371*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
  };
  function ensureAccount(){
    if(!state.user)return;
    state.user.uid=state.user.uid||uid();
    state.wallet=state.wallet||{id:`GAIGS-${String(uid()).replace(/[^a-z0-9]/gi,'').slice(0,12).toUpperCase()}`,currency:'PKR',available:0,reserved:0,status:'preview',createdAt:isoNow()};
    if(state.wallet.status==='sandbox')state.wallet.status='preview';
    save();
  }
  function walletText(value){return state.wallet?.currency==='GCR'?`${Number(value||0).toLocaleString()} GCR`:money(value||0)}
  function statusText(){return cloudReady()?'Shared account · secure network':'Interactive preview · private to this device'}
  function refreshStatus(){
    const status=document.getElementById('platformStatus');
    if(status)status.innerHTML=cloudReady()?'<span class="trust-pulse"></span><div><b>Secure network ready.</b><small>Verified accounts and shared community spaces are connected.</small></div>':'<span class="trust-pulse"></span><div><b>Built around your consent.</b><small>Your identity, location, vote and wallet actions stay under your control.</small></div>';
    const hint=document.getElementById('loginModeHint');
    if(hint)hint.textContent=cloudReady()?'Shared account login is live. Email verification status remains visible until a mail provider is connected.':'Create a shared account or explore the private preview.';
    const pill=document.querySelector('.status-pill');
    if(pill)pill.innerHTML=`<span></span> ${cloudReady()?'Network online':'Private preview'}`;
    const wallet=document.querySelector('.wallet-chip');
    if(wallet)wallet.innerHTML=cloudReady()?`<small>${esc(state.wallet?.currency||'Platform')} wallet</small><b>${walletText(state.wallet?.available||0)}</b>`:'<small>Wallet</small><b>Not connected</b>';
    const integrity=document.querySelector('.integrity-card');
    if(integrity){const anchored=(state.transactions||[]).filter(item=>item.blockchainTxHash).length;integrity.innerHTML=`<span>${anchored?'✓':'i'}</span><div><b>${anchored?'Anchor receipt available':'Ledger not blockchain-anchored'}</b><small>${anchored?`${anchored} network receipt${anchored===1?'':'s'} to inspect`:'Local/cloud records only'}</small></div>`;}
  }
  async function updatePublicProfile(){
    if(!cloudReady()||!state.user)return;
    const u=state.user;
    if(sitesReady()){await window.gaigsApi.updateProfile({name:u.name,city:u.city,country:u.country,skills:u.skills,bio:u.bio,locationPublic:Boolean(u.locationPublic),lat:u.lat,lng:u.lng});return}
    await fbDb.collection('publicProfiles').doc(uid()).set({uid:uid(),displayName:u.name||'',city:u.city||'',country:u.country||'',skills:u.skills||'',bio:u.bio||'',avatarUrl:u.avatarUrl||'',companyIds:u.companyIds||[],locationPublic:Boolean(u.locationPublic),updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  }
  function communities(){
    const local=(state.communities||[]).map((c,i)=>({...c,id:c.id||`local-${i}`,lat:Number(c.lat),lng:Number(c.lng),members:c.members||1}));
    return local.length?local:(state.settings?.showSampleData===true?[
      {id:'jmn',name:'Jamia Masjid Nabvi Qureshi Hashmi',location:'G-11/4, Islamabad',lat:33.6844,lng:73.0479,members:1284,level:'Society'},
      {id:'g11',name:'G-11 Citizens Forum',location:'G-11 Markaz, Islamabad',lat:33.679,lng:73.04,members:842,level:'Society'},
      {id:'iab',name:'Islamabad AI Builders',location:'F-10, Islamabad',lat:33.695,lng:73.018,members:516,level:'City'}
    ]:[]);
  }
  function nearbyCommunities(){
    const me={lat:Number(state.user?.lat),lng:Number(state.user?.lng)};
    return communities().map(c=>({...c,distance:distanceKm(me,c)})).sort((a,b)=>(a.distance??99999)-(b.distance??99999));
  }
  function communityCardsReal(){
    return nearbyCommunities().map(c=>{
      const request=(state.membershipRequests||[]).find(r=>r.communityId===c.id);
      const distance=c.distance==null?'Location needed':`${c.distance.toFixed(1)} km away`;
      const initials=(c.name||'C').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
      return card(esc(c.name),`<div class="activity-item"><div class="activity-icon">${esc(initials)}</div><div><b>${esc(c.location||'')}</b><p>${distance} · ${Number(c.members||0).toLocaleString()} members · ${esc(c.level||'Society')}</p><div class="meta-row"><span class="tag ${request?'gold':'green'}">${request?esc(request.status.toUpperCase()):'DISCOVERED'}</span></div></div></div><button class="${request?'ghost-btn':'action-btn'}" style="margin-top:10px;width:100%" ${request?'disabled':''} data-community-join="${esc(c.id)}">${request?'Request '+esc(request.status):'Request to join'}</button>`,4);
    }).join('');
  }
  views.communities=function(){return `${pageHead('Nearby communities',`Matched by location. Exact residence goes only to selected society reviewers. <b>${statusText()}</b>`,`<button class="ghost-btn" data-live-location>📍 Update location</button><button class="action-btn" data-action="community">＋ Register society</button>`)}<div class="dashboard-grid">${communityCardsReal()}</div>`};
  views.treasury=function(){
    ensureAccount();const w=state.wallet;
    return `${pageHead('Wallet & tamper-evident ledger','A dedicated GAIGS Credits account with a SHA-256 receipt chain. This app never generates or stores a crypto private key.',`<button class="action-btn" data-wallet-transfer>Send credits</button>`)}<div class="demo-banner">${cloudReady()?'Shared GCR ledger is online. GCR is a closed-loop contribution/reward credit: it is not PKR, cryptocurrency, a deposit or an investment.':'Preview entries are private test records and have no monetary value.'}</div><div class="dashboard-grid">${card('My platform wallet',`<div class="wallet-balance"><div><small>Wallet ID</small><div class="mono">${esc(w.id)}</div><strong>${walletText(w.available||0)}</strong></div><span class="tag ${cloudReady()?'green':'gold'}">${esc(String(w.status||'preview').toUpperCase())}</span></div><div class="metric-row"><div class="metric"><small>Available</small><b>${walletText(w.available||0)}</b></div><div class="metric"><small>Reserved</small><b>${walletText(w.reserved||0)}</b></div></div><div class="rule-actions" style="margin-top:12px"><button class="ghost-btn" data-wallet-transfer>Send GCR</button><button class="ghost-btn" data-ledger-verify>Verify hash chain</button></div>`,5)}${card('Account safety',`<div class="rule-card"><h4>User approval required</h4><p>JARVIS may prepare a transfer but cannot submit it. Every transfer needs explicit confirmation.</p></div><div class="rule-card" style="margin-top:10px"><h4>Public-chain boundary</h4><p>The MVP is an append-only hash chain. Public blockchain anchors and real settlement require independent audits and regulated partners.</p></div>`,7)}${card('Transaction history',transactionTable(),12)}</div>`;
  };
  views.services=function(){
    const skills=String(state.user?.skills||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
    const listings=[...(state.services||[]),...(state.settings?.showSampleData===true?seed.services:[])].map(s=>({...s,match:skills.some(k=>String(`${s.title} ${s.tag}`).toLowerCase().includes(k))?100:50})).sort((a,b)=>b.match-a.match);
    return `${pageHead('Nearby jobs & services','Ranked by declared skills, coverage and reputation; exact home coordinates stay private.',`<button class="action-btn" data-action="service">＋ Offer a service</button>`)}<div class="dashboard-grid"><section class="span-8"><div class="service-list">${listings.length?listings.map(serviceCard).join(''):'<div class="empty-state"><h3>No service listings</h3><p>Publish a skill or request. Shared matching requires cloud mode.</p></div>'}</div></section>${card('Your searchable skills',providerProfile(),4)}${card('Fair matching',`<div class="briefing">Skill relevance and selected distance come first. Sponsored listings cannot silently outrank relevant local providers. Users choose whom to contact.</div>`,4)}</div>`;
  };
  const basePostCard=postCard;
  postCard=function(post){
    const html=basePostCard(post);
    if(post.name===state.user?.name)return html;
    const person=esc(post.name||'Member');
    return html.replace('<button>Discuss</button>',`<button data-connect-person="${person}">Connect</button><button data-message-person="${person}">Message</button>`);
  };
  const baseFeed=views.feed;
  views.feed=function(){
    const output=baseFeed();
    return output.replace('Posts become discussions, proposals, services and verified projects.','People and content are ranked by selected scope, city and declared interests. Connect or message without exposing your exact location.');
  };
  function openJoinForm(communityId){
    const community=communities().find(x=>x.id===communityId);if(!community)return;
    openModal(`<h2>Join ${esc(community.name)}</h2><p class="muted">Only society reviewers receive residence evidence; it is never posted publicly.</p><form id="joinSocietyForm" class="form-grid"><label>Residence status<select id="residenceStatus" required><option value="owner">Owner</option><option value="tenant">Tenant</option><option value="family">Living with family</option><option value="worker">Works here</option></select></label><label>Block / street (private)<input id="residenceArea" required autocomplete="street-address"></label><label>Evidence reference<input id="residenceEvidence" placeholder="Utility bill / tenancy document reference" required></label><label class="consent"><input id="residenceConsent" type="checkbox" required> I consent to society reviewers checking this claim.</label><button class="primary">Send secure join request</button></form>`);
    $('#joinSocietyForm').addEventListener('submit',async event=>{
      event.preventDefault();
      const request={id:recordId('membership'),communityId:community.id,communityName:community.name,userId:uid(),userName:state.user?.name||'Applicant',residenceStatus:$('#residenceStatus').value,area:$('#residenceArea').value.trim(),evidenceRef:$('#residenceEvidence').value.trim(),status:'pending',createdAt:isoNow()};
      try{
        if(cloudReady())await fbDb.collection('communities').doc(community.id).collection('members').doc(uid()).set({userId:uid(),userName:request.userName,status:'pending',role:'applicant',residenceStatus:request.residenceStatus,area:request.area,evidenceRef:request.evidenceRef,requestedAt:firebase.firestore.FieldValue.serverTimestamp()});
        state.membershipRequests.unshift(request);save();closeModal();render();toast('Join request sent for society review.');
      }catch(error){toast(error.message||'Join request failed.');}
    });
  }
  function openTransferForm(){
    openModal(`<h2>Send GAIGS Credits</h2><p class="muted">GCR is a closed-loop contribution credit. It cannot be deposited, withdrawn or traded as money.</p><form id="walletTransferForm" class="form-grid"><label>Recipient wallet ID<input id="transferRecipient" required placeholder="GAIGS-XXXXXXXXXXXX"></label><label>Amount (GCR)<input id="transferAmount" required type="number" min="1" max="100000" step="1"></label><label>Purpose<input id="transferPurpose" required maxlength="160"></label><label class="consent"><input type="checkbox" required> I reviewed the recipient, amount and purpose.</label><button class="primary">Confirm GCR transfer</button></form>`);
    $('#walletTransferForm').addEventListener('submit',async event=>{
      event.preventDefault();const amount=Number($('#transferAmount').value);if(!Number.isFinite(amount)||amount<=0)return toast('Enter a valid amount.');
      if(sitesReady()){try{const result=await window.gaigsApi.transfer($('#transferRecipient').value.trim(),amount,$('#transferPurpose').value.trim());state.transactions.unshift({date:'Today',type:'transfer',desc:`To ${$('#transferRecipient').value.trim()}: ${$('#transferPurpose').value.trim()}`,amount:-amount,proof:`SHA-256 ${result.receipt.slice(0,16)}…`,entryHash:result.receipt,currency:'GCR'});save();closeModal();render();toast('GCR transfer recorded with a hash-chain receipt.');}catch(error){toast(error.message||'Transfer failed.')}return}
      state.transactions.unshift({id:recordId('tx'),date:'Today',type:'Draft transfer',desc:`To ${$('#transferRecipient').value.trim()}: ${$('#transferPurpose').value.trim()}`,amount:-amount,proof:'Awaiting regulated settlement',status:'draft',createdAt:isoNow()});
      save();closeModal();render();toast('Transfer draft saved; no money was moved.');
    });
  }
  const baseBindDynamic=bindDynamic;
  bindDynamic=function(){
    baseBindDynamic();
    $$('[data-live-location]').forEach(button=>button.addEventListener('click',requestLiveLocation));
    $$('[data-community-join]').forEach(button=>button.addEventListener('click',()=>openJoinForm(button.dataset.communityJoin)));
    $$('[data-wallet-transfer]').forEach(button=>button.addEventListener('click',openTransferForm));
    $$('[data-ledger-verify]').forEach(button=>button.addEventListener('click',async()=>{try{const result=sitesReady()?await window.gaigsApi.verifyLedger():{valid:false,checked:(state.transactions||[]).length,headHash:'none',notice:'Preview records are not on the shared ledger.'};openModal(`<h2>Ledger integrity</h2><div class="rule-card"><p><b>Status:</b> ${result.valid?'VALID HASH CHAIN':'NOT VERIFIED'}</p><p><b>Entries checked:</b> ${result.checked}</p><p><b>Head hash:</b> <span class="mono">${esc(result.headHash)}</span></p><p>${esc(result.notice)}</p></div>`);}catch(error){toast(error.message||'Ledger verification failed.')}}));
    $$('[data-connect-person]').forEach(button=>button.addEventListener('click',()=>connectPerson(button.dataset.connectPerson)));
    $$('[data-message-person]').forEach(button=>button.addEventListener('click',()=>messagePerson(button.dataset.messagePerson)));
  };
  async function connectPerson(person){
    if(state.connections.some(item=>item.person===person))return toast('Connection request already sent.');
    const request={id:recordId('connection'),person,ownerId:uid(),status:'pending',createdAt:isoNow()};
    try{
      if(cloudReady())await fbDb.collection('connections').add({...request,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      state.connections.unshift(request);save();toast(`Connection request sent to ${person}.`);
    }catch(error){toast(error.message||'Connection request failed.');}
  }
  function messagePerson(person){
    openModal(`<h2>Message ${esc(person)}</h2><form id="directMessageForm" class="form-grid"><label>Message<textarea id="directMessageText" maxlength="1000" required></textarea></label><button class="primary">Send message</button></form>`);
    $('#directMessageForm').addEventListener('submit',async event=>{
      event.preventDefault();const message={id:recordId('message'),ownerId:uid(),recipientName:person,text:$('#directMessageText').value.trim(),createdAt:isoNow(),status:'sent'};
      try{
        if(cloudReady())await fbDb.collection('messages').add({...message,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
        state.messages.unshift(message);save();closeModal();toast(`Message sent to ${person}.`);
      }catch(error){toast(error.message||'Message could not be sent.');}
    });
  }
  const baseEditProfileForm=editProfileForm;
  editProfileForm=function(){return baseEditProfileForm().replace('</form>',`<label>Bio<textarea id="profileBio">${esc(state.user.bio||'')}</textarea></label><label class="consent"><input id="profileLocationPublic" type="checkbox" ${state.user.locationPublic?'checked':''}> Show city-level location publicly (never exact coordinates)</label></form>`)};
  const baseBindModal=bindModal;
  bindModal=function(){
    baseBindModal();const form=$('#editProfileForm');
    if(form&&!form.dataset.coreBound){form.dataset.coreBound='1';form.addEventListener('submit',()=>{state.user.bio=$('#profileBio')?.value||'';state.user.locationPublic=Boolean($('#profileLocationPublic')?.checked);save();updatePublicProfile().catch(()=>{});});}
  };
  const baseRender=render;
  render=function(){ensureAccount();baseRender();refreshStatus();};
  if(firebaseAvailable&&fbAuth)fbAuth.onAuthStateChanged(async user=>{
    if(user&&user.emailVerified){
      try{const [publicDoc,privateDoc]=await Promise.all([fbDb.collection('publicProfiles').doc(user.uid).get(),fbDb.collection('users').doc(user.uid).get()]),publicData=publicDoc.exists?publicDoc.data():{},privateData=privateDoc.exists?privateDoc.data():{};state.user={...(state.user||{}),...publicData,uid:user.uid,name:publicData.displayName||state.user?.name||user.displayName||user.email,email:user.email,phone:user.phoneNumber||privateData.phone||state.user?.phone||'',city:publicData.city||privateData.city||state.user?.city||'',country:publicData.country||privateData.country||state.user?.country||'',skills:publicData.skills||state.user?.skills||'',communityIds:publicData.communityIds||state.user?.communityIds||[],kycStatus:privateData.kycStatus||state.user?.kycStatus||'pending'};}catch(error){state.user=state.user||{uid:user.uid,name:user.displayName||user.email,email:user.email,city:'',country:'',skills:'',kycStatus:'pending'};state.user.uid=user.uid;}
      ensureAccount();await updatePublicProfile().catch(()=>{});render();
    }
    refreshStatus();
  });
  ensureAccount();refreshStatus();if(state.user)render();
})();
