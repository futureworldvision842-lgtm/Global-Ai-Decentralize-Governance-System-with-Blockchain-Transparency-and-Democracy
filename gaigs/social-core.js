/* Phase 1 social layer: posts, reactions, comments, follows, saves, reports and recovery. */
(function(){
  'use strict';
  const cloud=()=>Boolean(firebaseAvailable&&window.NDCONF?.firebaseProductionMode===true&&fbAuth?.currentUser&&fbDb);
  const uid=()=>fbAuth?.currentUser?.uid||state.user?.uid||state.user?.email||'offline-user';
  const makeId=(prefix='item')=>`${prefix}_${Date.now().toString(36)}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
  const stored=JSON.parse(localStorage.getItem('gaigsSocialV1')||'null')||{};
  const social={reactions:stored.reactions||{},comments:stored.comments||{},saved:stored.saved||[],following:stored.following||[],blocked:stored.blocked||[],reports:stored.reports||[],filter:stored.filter||'Nearby',page:stored.page||1,pageSize:5};
  const persist=()=>localStorage.setItem('gaigsSocialV1',JSON.stringify(social));
  const postId=post=>post.id||`seed_${String(post.name+'_'+post.text).split('').reduce((a,c)=>((a<<5)-a+c.charCodeAt(0))|0,0).toString(36).replace('-','n')}`;
  const initials=name=>String(name||'Member').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const seedPosts=()=>state.settings?.showSampleData===true?[
    {id:'seed_waste',name:'Sara Khan',authorId:'seed-sara',scope:'Society',time:'18 min ago',type:'Problem',text:'The waste collection point near Street 44 has remained blocked for three days. I uploaded location-tagged photos.',location:'Islamabad',media:'Location evidence · 6 photos'},
    {id:'seed_ai',name:'Islamabad AI Builders',authorId:'seed-iab',scope:'City',time:'1 hour ago',type:'Mission',text:'We are opening a weekend AI literacy lab. Volunteer mentors, refurbished laptops and curriculum reviewers are needed.',location:'Islamabad',media:'Crew mission · 64% staffed'},
    {id:'seed_water',name:'Global Water Challenge',authorId:'seed-water',scope:'Global',time:'3 hours ago',type:'Science',text:'Can a solar filtration system serve 1,000 households affordably? Submit a simulation, material list and maintenance plan.',location:'Global',media:'Humanity Lab · submissions open'}
  ]:[];
  function allPosts(){
    return [...(state.posts||[]),...seedPosts()].map(post=>({...post,id:postId(post),authorId:post.authorId||post.userId||post.name,initials:post.initials||initials(post.name)})).filter(post=>!social.blocked.includes(post.authorId));
  }
  function filteredPosts(){
    return GAIGSSocialLogic.filterPosts(allPosts(),social.filter,{city:state.user?.city||'Islamabad',following:social.following,saved:social.saved});
  }
  function attachment(post){
    if(post.mediaUrl)return String(post.mediaType||'').startsWith('video')?`<video controls preload="metadata" src="${esc(post.mediaUrl)}"></video>`:`<img loading="lazy" src="${esc(post.mediaUrl)}" alt="Post media">`;
    return esc(post.media||'No attachment');
  }
  function socialCard(post){
    const id=post.id,reaction=social.reactions[id],comments=(social.comments[id]||[]).length,saved=social.saved.includes(id),following=social.following.includes(post.authorId),mine=post.authorId===uid()||post.name===state.user?.name;
    return `<article class="feed-post" data-post-id="${esc(id)}"><div class="post-head"><div class="avatar">${esc(post.initials)}</div><div><b>${esc(post.name)}</b><small>${esc(post.time||'Recently')} · ${esc(post.type||'Post')}${post.location?' · '+esc(post.location):''}</small></div><span class="scope-badge">${esc(post.scope||'City')}</span></div><div class="post-body">${esc(post.text||'')}</div><div class="post-media">${attachment(post)}</div><div class="social-counts"><span>${reaction?'You reacted · ':''}${Object.keys(social.reactions).filter(k=>k===id).length||0} reactions</span><span>${comments} comments</span></div><div class="post-actions social-actions"><button class="${reaction?'active':''}" data-social-react="${esc(id)}">${reaction||'Support'}</button><button data-social-comments="${esc(id)}">Discuss</button><button class="${saved?'active':''}" data-social-save="${esc(id)}">${saved?'Saved':'Save'}</button>${mine?'':`<button data-social-follow="${esc(post.authorId)}">${following?'Following':'Follow'}</button><button data-social-menu="${esc(id)}">•••</button>`}</div></article>`;
  }
  views.feed=function(){
    const list=filteredPosts(),paged=GAIGSSocialLogic.paginate(list,social.page,social.pageSize),pages=paged.pages;social.page=paged.page;const shown=paged.items;
    const filters=['Nearby','Following','My society','City','Country','Global','Saved'];
    return `${pageHead('Your community feed','Connect around location, interests and verified community scope. Exact home coordinates remain private.',`<button class="action-btn" data-action="post">＋ Create post</button>`)}<div class="social-filter-bar">${filters.map(f=>`<button class="filter-btn ${social.filter===f?'active':''}" data-social-filter="${f}">${f}</button>`).join('')}</div><div class="dashboard-grid"><section class="span-8"><div class="feed-list">${shown.length?shown.map(socialCard).join(''):'<div class="empty-message">No posts match this feed yet.</div>'}</div><div class="feed-pages"><button class="ghost-btn" data-social-page="prev" ${social.page<=1?'disabled':''}>← Newer</button><span>Page ${social.page} of ${pages}</span><button class="ghost-btn" data-social-page="next" ${social.page>=pages?'disabled':''}>Older →</button></div></section>${card('Feed control',`<div class="briefing"><b>Nearby:</b> city and society content.<br><b>Following:</b> people and organizations you chose.<br><b>Saved:</b> private reading list.<br><br>Use the menu on any post to report or block safely.</div>`,4)}</div>`;
  };
  function react(id){
    social.reactions[id]=GAIGSSocialLogic.nextReaction(social.reactions[id]);persist();render();
    if(cloud())fbDb.collection('posts').doc(id).collection('reactions').doc(uid()).set({type:social.reactions[id],userId:uid(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()}).catch(()=>{});
  }
  function toggleSave(id){
    social.saved=social.saved.includes(id)?social.saved.filter(x=>x!==id):[id,...social.saved];persist();render();
    if(cloud()){const ref=fbDb.collection('savedPosts').doc(uid()).collection('items').doc(id);(social.saved.includes(id)?ref.set({postId:id,savedAt:firebase.firestore.FieldValue.serverTimestamp()}):ref.delete()).catch(()=>{});}
  }
  function toggleFollow(authorId){
    social.following=social.following.includes(authorId)?social.following.filter(x=>x!==authorId):[...social.following,authorId];persist();render();
    if(cloud()){const ref=fbDb.collection('follows').doc(uid()).collection('outgoing').doc(authorId);(social.following.includes(authorId)?ref.set({targetId:authorId,createdAt:firebase.firestore.FieldValue.serverTimestamp()}):ref.delete()).catch(()=>{});}
  }
  async function openComments(id){
    const post=allPosts().find(p=>p.id===id);if(!post)return;
    const draw=()=>`<h2>Discussion</h2><p class="muted">Reply to the issue, not the person. Evidence and respectful disagreement are welcome.</p><div class="comment-list">${(social.comments[id]||[]).map(c=>`<div class="comment"><b>${esc(c.authorName)}</b><p>${esc(c.text)}</p><small>${esc(c.time||'Just now')}</small></div>`).join('')||'<div class="empty-message">Start the discussion.</div>'}</div><form id="commentForm" class="form-grid"><label>Your comment<textarea id="commentText" maxlength="1000" required></textarea></label><button class="primary">Publish comment</button></form>`;
    openModal(draw());
    if(cloud()&&!String(id).startsWith('seed_')){
      try{const snap=await fbDb.collection('posts').doc(id).collection('comments').orderBy('createdAt','asc').limit(100).get();social.comments[id]=snap.docs.map(d=>({id:d.id,...d.data(),time:'Cloud'}));persist();$('#modalContent').innerHTML=draw();bindCommentForm(id);}catch(_){bindCommentForm(id);}
    }else bindCommentForm(id);
  }
  function bindCommentForm(id){
    const form=$('#commentForm');if(!form)return;form.addEventListener('submit',async event=>{event.preventDefault();const text=$('#commentText').value.trim();if(!text)return;const comment={id:makeId('comment'),authorId:uid(),authorName:state.user?.name||'Member',text,time:'Just now'};
      try{if(cloud()&&!String(id).startsWith('seed_'))await fbDb.collection('posts').doc(id).collection('comments').add({...comment,createdAt:firebase.firestore.FieldValue.serverTimestamp()});social.comments[id]=[...(social.comments[id]||[]),comment];persist();closeModal();render();toast('Comment published.');}catch(error){toast(error.message||'Comment failed.');}
    });
  }
  function postMenu(id){
    const post=allPosts().find(p=>p.id===id);if(!post)return;
    openModal(`<h2>Post options</h2><div class="rule-actions"><button class="action-btn" id="messageAuthorBtn">Message ${esc(post.name)}</button><button class="ghost-btn" id="reportPostBtn">Report post</button><button class="ghost-btn" id="blockAuthorBtn">Block ${esc(post.name)}</button></div><p class="muted" style="margin-top:14px">Messages use the member account ID. Reports are private and blocking removes this author from your feed.</p>`);
    $('#messageAuthorBtn').addEventListener('click',()=>{closeModal();window.GAIGSMessaging?.compose(post.authorId,post.name);});$('#reportPostBtn').addEventListener('click',()=>reportPost(post));$('#blockAuthorBtn').addEventListener('click',()=>blockAuthor(post));
  }
  function reportPost(post){
    const communityId=post.scopeId||(String(post.scope).toLowerCase()==='society'?(state.communities||[]).find(c=>c.name===state.community)?.id:'')||'';
    const report={id:makeId('report'),postId:post.id,communityId,reporterId:uid(),reason:'User requested review',status:'open',createdAt:new Date().toISOString()};social.reports.push(report);persist();if(cloud()){fbDb.collection('reports').add({...report,createdAt:firebase.firestore.FieldValue.serverTimestamp()}).catch(()=>{});if(communityId)fbDb.collection('contentReports').doc(report.id).set({...report,createdAt:firebase.firestore.FieldValue.serverTimestamp()}).catch(()=>{});}closeModal();toast('Report submitted privately for moderation.');
  }
  function blockAuthor(post){
    if(!social.blocked.includes(post.authorId))social.blocked.push(post.authorId);persist();if(cloud())fbDb.collection('blocks').doc(uid()).collection('items').doc(post.authorId).set({targetId:post.authorId,createdAt:firebase.firestore.FieldValue.serverTimestamp()}).catch(()=>{});closeModal();render();toast(`${post.name} blocked.`);
  }
  const baseBindDynamic=bindDynamic;
  bindDynamic=function(){
    baseBindDynamic();
    $$('[data-social-react]').forEach(b=>b.addEventListener('click',()=>react(b.dataset.socialReact)));
    $$('[data-social-comments]').forEach(b=>b.addEventListener('click',()=>openComments(b.dataset.socialComments)));
    $$('[data-social-save]').forEach(b=>b.addEventListener('click',()=>toggleSave(b.dataset.socialSave)));
    $$('[data-social-follow]').forEach(b=>b.addEventListener('click',()=>toggleFollow(b.dataset.socialFollow)));
    $$('[data-social-menu]').forEach(b=>b.addEventListener('click',()=>postMenu(b.dataset.socialMenu)));
    $$('[data-social-filter]').forEach(b=>b.addEventListener('click',()=>{social.filter=b.dataset.socialFilter;social.page=1;persist();render();}));
    $$('[data-social-page]').forEach(b=>b.addEventListener('click',()=>{social.page=Math.max(1,social.page+(b.dataset.socialPage==='next'?1:-1));persist();render();window.scrollTo({top:0,behavior:'smooth'});}));
    $$('[data-phone-verify]').forEach(b=>b.addEventListener('click',openPhoneVerification));
  };
  const baseSettingsSecurity=settingsSecurity;
  settingsSecurity=function(){return `<div class="activity-list"><div class="activity-item"><div class="activity-icon">EM</div><div><b>Email verification</b><p>${fbAuth?.currentUser?.emailVerified?'Verified':'Required for shared accounts'}</p></div></div><div class="activity-item"><div class="activity-icon">ID</div><div><b>Identity review</b><p>${esc(String(state.user?.kycStatus||'pending').replace('_',' '))}. Only a signed provider webhook can change this status; the browser cannot self-verify.</p></div></div><div class="activity-item"><div class="activity-icon">2F</div><div><b>Mobile verification</b><p>${fbAuth?.currentUser?.phoneNumber?'Verified: '+esc(fbAuth.currentUser.phoneNumber):'Verify a mobile number with a secure SMS code.'}</p><button class="mini-btn" data-phone-verify>${fbAuth?.currentUser?.phoneNumber?'Change number':'Verify number'}</button></div></div><div class="activity-item"><div class="activity-icon">DV</div><div><b>Account sessions</b><p>Use password reset immediately if an unknown device accesses your account.</p></div></div></div>`};
  function openPhoneVerification(){
    if(!cloud())return toast('Sign in to a configured production account first.');
    openModal(`<h2>Verify mobile number</h2><p class="muted">A secure SMS code will be sent. Standard carrier charges may apply.</p><form id="phoneStartForm" class="form-grid"><label>Mobile number with country code<input id="verifyPhone" type="tel" placeholder="+923001234567" required></label><div id="phoneRecaptcha"></div><button class="primary">Send OTP</button></form>`);
    $('#phoneStartForm').addEventListener('submit',async event=>{event.preventDefault();const phone=$('#verifyPhone').value.replace(/[\s()-]/g,'');if(!GAIGSSocialLogic.validatePhone(phone))return toast('Use international format, for example +923001234567.');
      try{const verifier=new firebase.auth.RecaptchaVerifier('phoneRecaptcha',{size:'normal'});const provider=new firebase.auth.PhoneAuthProvider();const verificationId=await provider.verifyPhoneNumber(phone,verifier);$('#modalContent').innerHTML=`<h2>Enter SMS code</h2><form id="phoneCodeForm" class="form-grid"><label>Six-digit code<input id="verifyPhoneCode" inputmode="numeric" maxlength="6" required></label><button class="primary">Verify mobile</button></form>`;$('#phoneCodeForm').addEventListener('submit',async codeEvent=>{codeEvent.preventDefault();try{const credential=firebase.auth.PhoneAuthProvider.credential(verificationId,$('#verifyPhoneCode').value.trim());await fbAuth.currentUser.linkWithCredential(credential);closeModal();render();toast('Mobile number verified.');}catch(error){toast(error.message||'Invalid verification code.');}});}catch(error){toast(error.message||'SMS verification could not start.');}
    });
  }
  async function fileData(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});}
  const baseBindModal=bindModal;
  bindModal=function(){
    baseBindModal();const form=$('#postCreateForm');if(!form||form.dataset.socialBound)return;form.dataset.socialBound='1';
    form.addEventListener('submit',async event=>{
      event.preventDefault();event.stopImmediatePropagation();const file=$('#postMedia').files[0];if(file&&file.size>100*1024*1024)return toast('Media must be under 100 MB.');
      const id=makeId('post'),scope=$('#postScope').value.toLowerCase(),societyRecord=(state.communities||[]).find(c=>(state.user?.communityIds||[]).includes(c.id)||c.ownerId===uid()||c.createdBy===uid()||c.role==='admin'),societyId=societyRecord?.id||(state.user?.communityIds||[])[0]||'',shareApprox=Boolean($('#postApproxLocation')?.checked&&Number.isFinite(Number(state.user.lat))&&Number.isFinite(Number(state.user.lng)));if(cloud()&&scope==='society'&&!societyId)return toast('Join an approved society before publishing to society scope.');const post={id,authorId:uid(),name:state.user.name,initials:initials(state.user.name),scope,scopeId:scope==='city'?state.user.city:scope==='country'?state.user.country:scope==='society'?(societyId||state.community):'global',city:state.user.city,country:state.user.country,time:'Just now',type:$('#postType').value,text:$('#postText').value.trim(),location:$('#postLocation').value.trim(),lat:shareApprox?Number(Number(state.user.lat).toFixed(3)):null,lng:shareApprox?Number(Number(state.user.lng).toFixed(3)):null,locationPrecision:shareApprox?'approximately_100m':'none',media:file?file.name:'No attachment',mediaType:file?.type||'',createdAt:new Date().toISOString()};
      try{
        if(cloud()){
          if(file){const path=`users/${uid()}/posts/${id}/${file.name.replace(/[^a-z0-9._-]/gi,'_')}`;const ref=fbStorage.ref(path);await ref.put(file);post.mediaUrl=await ref.getDownloadURL();}
          await fbDb.collection('posts').doc(id).set({...post,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
        }else if(file&&file.size<=2*1024*1024)post.mediaUrl=await fileData(file);
        else if(file)post.media='Media preview is session-only; cloud mode is required to persist files over 2 MB.';
        state.posts.unshift(post);save();closeModal();navigate('feed');toast(cloud()?'Post published to the shared feed.':'Post added to your private interactive preview.');
      }catch(error){toast(error.message||'Post could not be published.');}
    },true);
  };
  $('#forgotPasswordBtn')?.addEventListener('click',async()=>{const email=$('#loginEmail').value.trim();if(!email)return toast('Enter your email first.');if(!firebaseAvailable)return toast('Account recovery activates on the secure release.');try{await fbAuth.sendPasswordResetEmail(email);toast('Password reset email sent.');}catch(error){toast(error.message||'Reset failed.');}});
  $('#resendVerificationBtn')?.addEventListener('click',async()=>{if(!firebaseAvailable)return toast('Account verification activates on the secure release.');const email=$('#loginEmail').value.trim(),password=$('#loginPassword').value;if(!email||!password)return toast('Enter email and password first.');try{const credential=await fbAuth.signInWithEmailAndPassword(email,password);if(credential.user.emailVerified)toast('This email is already verified.');else{await credential.user.sendEmailVerification();toast('Verification email sent.');}await fbAuth.signOut();}catch(error){toast(error.message||'Could not resend verification.');}});
  let feedUnsubscribes=[];
  async function startCloudFeed(user){
    feedUnsubscribes.forEach(stop=>stop());feedUnsubscribes=[];
    if(!user||!window.NDCONF?.firebaseProductionMode)return;
    const profile=await fbDb.collection('publicProfiles').doc(user.uid).get().then(doc=>doc.exists?doc.data():{}).catch(()=>({})),parts=new Map();
    const specs=[['global','global'],profile.country&&['country',profile.country],profile.city&&['city',profile.city],...(profile.communityIds||[]).slice(0,10).map(id=>['society',id])].filter(Boolean);
    const merge=()=>{const seen=new Set();state.posts=[...parts.values()].flat().filter(post=>!seen.has(post.id)&&seen.add(post.id)).sort((a,b)=>new Date(b.createdAtRaw||0)-new Date(a.createdAtRaw||0));save();if(state.view==='feed'||state.view==='overview'||state.view==='global')render();};
    specs.forEach(([scope,scopeId])=>{const key=`${scope}:${scopeId}`,stop=fbDb.collection('posts').where('scope','==',scope).where('scopeId','==',scopeId).orderBy('createdAt','desc').limit(50).onSnapshot(snapshot=>{parts.set(key,snapshot.docs.map(doc=>{const value=doc.data(),date=value.createdAt?.toDate?.();return {id:doc.id,...value,name:value.name||value.authorName||'Member',initials:value.initials||initials(value.name||value.authorName),time:date?date.toLocaleString():'Recently',createdAtRaw:date?.toISOString()||''};}));merge();},error=>console.warn(`[GAIGS] ${key} feed unavailable:`,error.message));feedUnsubscribes.push(stop);});
  }
  if(firebaseAvailable&&fbAuth)fbAuth.onAuthStateChanged(startCloudFeed);
  if(state.user)render();
})();
