/* Server-scoped notifications with an honest empty offline state. */
(function(){
  'use strict';
  let items=[],unsubscribe=null;
  const cloudReady=()=>Boolean(firebaseAvailable&&window.NDCONF?.firebaseProductionMode===true&&fbAuth?.currentUser&&fbDb);
  const uid=()=>fbAuth?.currentUser?.uid;
  function updateBadge(){const badge=document.querySelector('#notificationsBtn em'),unread=items.filter(x=>!x.read).length;if(badge){badge.textContent=String(unread);badge.style.display=unread?'':'none';}}
  function openNotifications(){
    const body=items.length?`<div class="activity-list">${items.map(item=>`<div class="activity-item"><div class="activity-icon">${item.read?'✓':'!'}</div><div><b>${esc(item.title||'Update')}</b><p>${esc(item.body||'')}</p><div class="meta-row"><span class="tag">${esc(item.scope||'personal')}</span>${item.read?'':`<button class="mini-btn" data-notification-read="${esc(item.id)}">Mark read</button>`}</div></div></div>`).join('')}</div>`:`<div class="empty-state"><h3>${cloudReady()?'No notifications':'Notifications are offline'}</h3><p>${cloudReady()?'Scoped updates will appear here when real records are published.':'Sign in to a configured cloud deployment to receive society, city, country and global updates.'}</p></div>`;
    openModal(`<h2>Notifications</h2><p class="muted">Delivered by verified scope: society, city, country, or global.</p>${body}`);bindRead();
  }
  function bindRead(){$$('[data-notification-read]').forEach(button=>button.addEventListener('click',async()=>{const item=items.find(x=>x.id===button.dataset.notificationRead);if(!item||!cloudReady())return;try{await fbDb.collection('notifications').doc(uid()).collection('items').doc(item.id).update({read:true,readAt:firebase.firestore.FieldValue.serverTimestamp()});}catch(error){toast(error.message||'Could not update notification.');}}));}
  const button=document.getElementById('notificationsBtn');button?.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();openNotifications();},true);
  function start(user){if(unsubscribe){unsubscribe();unsubscribe=null;}items=[];updateBadge();if(!user||!window.NDCONF?.firebaseProductionMode)return;unsubscribe=fbDb.collection('notifications').doc(user.uid).collection('items').orderBy('createdAt','desc').limit(50).onSnapshot(snapshot=>{items=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));updateBadge();},error=>console.warn('[GAIGS] Notifications unavailable:',error.message));}
  if(firebaseAvailable&&fbAuth)fbAuth.onAuthStateChanged(start);else updateBadge();
})();
