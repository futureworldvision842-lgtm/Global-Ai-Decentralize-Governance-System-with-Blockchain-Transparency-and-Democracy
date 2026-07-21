/* Direct messages use participant IDs, not display names, and form real inbox threads. */
(function(){
  'use strict';
  const key='gaigsMessagesV2';let messages=JSON.parse(localStorage.getItem(key)||'[]'),unsubscribe=null;
  const cloudReady=()=>Boolean(firebaseAvailable&&window.NDCONF?.firebaseProductionMode===true&&fbAuth?.currentUser&&fbDb);
  const uid=()=>fbAuth?.currentUser?.uid||state.user?.uid||state.user?.email||'offline-user';
  const persist=()=>localStorage.setItem(key,JSON.stringify(messages));
  function other(message){return message.senderId===uid()?{id:message.recipientId,name:message.recipientName}:{id:message.senderId,name:message.senderName};}
  function threads(){const map=new Map();messages.forEach(message=>{const person=other(message);if(!person.id)return;const value=map.get(person.id)||{...person,messages:[],latest:message};value.messages.push(message);if(new Date(message.createdAt||0)>new Date(value.latest.createdAt||0))value.latest=message;map.set(person.id,value);});return [...map.values()].sort((a,b)=>new Date(b.latest.createdAt||0)-new Date(a.latest.createdAt||0));}
  function threadList(){const list=threads();return list.length?`<div class="message-thread-list">${list.map(thread=>{const unread=thread.messages.filter(x=>x.recipientId===uid()&&!x.read).length;return `<button data-message-thread="${esc(thread.id)}"><span class="avatar">${esc(String(thread.name||'M').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase())}</span><span><b>${esc(thread.name||'Member')}</b><small>${esc(thread.latest.text||'')}</small></span>${unread?`<i>${unread}</i>`:''}</button>`;}).join('')}</div>`:`<div class="empty-state"><h3>No conversations</h3><p>Open a member post menu to send a direct message.</p></div>`;}
  views.messages=function(){return `${pageHead('Messages','Private participant-ID conversations. Scope feeds never expose your exact residence.','')}<div class="capability-strip"><span class="tag ${cloudReady()?'green':'gold'}">${cloudReady()?'SHARED INBOX':'OFFLINE INBOX'}</span><b>${threads().length} conversation${threads().length===1?'':'s'}</b><span>Messages cannot authorize a vote, transfer, membership approval or rule change.</span></div><div class="dashboard-grid">${card('Inbox',threadList(),12)}</div>`;};
  viewNames.messages='Direct messages';
  function compose(recipientId,recipientName){
    if(!recipientId||recipientId===uid())return toast('Choose another member to message.');
    openModal(`<h2>Message ${esc(recipientName||'member')}</h2><form id="messageComposeForm" class="form-grid"><label>Message<textarea id="messageComposeText" maxlength="2000" required></textarea></label><p class="micro">Do not send CNIC images, passwords, private keys or exact beneficiary addresses.</p><button class="primary">Send message</button></form>`);
    $('#messageComposeForm').addEventListener('submit',async event=>{event.preventDefault();const text=$('#messageComposeText').value.trim();if(!text)return;const id=`message_${Date.now().toString(36)}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`,record={id,senderId:uid(),senderName:state.user.name,recipientId,recipientName:recipientName||'Member',participants:[uid(),recipientId].sort(),text,status:'sent',read:false,createdAt:new Date().toISOString()};try{if(cloudReady())await fbDb.collection('messages').doc(id).set({...record,createdAt:firebase.firestore.FieldValue.serverTimestamp()});else{messages.unshift(record);persist();}closeModal();toast(cloudReady()?'Message sent.':'Message added to your private preview.');}catch(error){toast(error.message||'Message could not be sent.');}});
  }
  async function openThread(personId){
    const thread=threads().find(x=>x.id===personId);if(!thread)return;const list=thread.messages.slice().sort((a,b)=>new Date(a.createdAt||0)-new Date(b.createdAt||0));
    openModal(`<h2>${esc(thread.name||'Conversation')}</h2><div class="direct-thread">${list.map(message=>`<div class="${message.senderId===uid()?'user-msg':'ai-msg'}"><p>${esc(message.text)}</p><small>${esc(message.createdAt?.toDate?.().toLocaleString?.()||String(message.createdAt||''))}</small></div>`).join('')}</div><button class="action-btn" id="threadReply">Reply</button>`);$('#threadReply').addEventListener('click',()=>compose(thread.id,thread.name));
    if(cloudReady()){const unread=list.filter(x=>x.recipientId===uid()&&!x.read).slice(0,400);if(unread.length){const batch=fbDb.batch();unread.forEach(item=>batch.update(fbDb.collection('messages').doc(item.id),{read:true,readAt:firebase.firestore.FieldValue.serverTimestamp()}));await batch.commit().catch(()=>{});}}
  }
  const priorBindDynamic=bindDynamic;
  bindDynamic=function(){priorBindDynamic();$$('[data-message-thread]').forEach(button=>button.addEventListener('click',()=>openThread(button.dataset.messageThread)));};
  function start(user){if(unsubscribe){unsubscribe();unsubscribe=null;}if(!user||!window.NDCONF?.firebaseProductionMode)return;unsubscribe=fbDb.collection('messages').where('participants','array-contains',user.uid).orderBy('createdAt','desc').limit(200).onSnapshot(snapshot=>{messages=snapshot.docs.map(doc=>({id:doc.id,...doc.data(),createdAt:doc.data().createdAt?.toDate?.().toISOString()||''}));persist();if(state.view==='messages')render();},error=>console.warn('[GAIGS] Messages unavailable:',error.message));}
  if(firebaseAvailable&&fbAuth)fbAuth.onAuthStateChanged(start);
  window.GAIGSMessaging={compose};
})();
