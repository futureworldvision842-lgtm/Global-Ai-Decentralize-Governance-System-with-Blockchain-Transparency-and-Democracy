/* Same-origin GAIGS account/data client with native bearer-token fallback. */
(function(){
  'use strict';
  const configured=String(window.NDCONF?.platformApiBase||'').replace(/\/$/,'');
  const hosted=/^https?:$/i.test(location.protocol)&&!['localhost','127.0.0.1'].includes(location.hostname);
  const base=configured||(hosted?'':'https://gaigs-jarvis-v2.qw01.chatgpt.site');
  const native=Boolean(window.Capacitor?.isNativePlatform?.()||window.Capacitor?.getPlatform?.()==='android'||location.hostname==='localhost');
  const tokenKey='gaigsNativeSessionV1';
  const secureStore=window.Capacitor?.Plugins?.GaigsSecureStore;
  let sessionToken='';
  const tokenReady=(async()=>{
    if(!native)return;
    const legacy=localStorage.getItem(tokenKey)||'';
    if(secureStore){
      try{
        const stored=await secureStore.get({key:tokenKey});
        sessionToken=stored?.value||legacy;
        if(legacy&&!stored?.value)await secureStore.set({key:tokenKey,value:legacy});
        localStorage.removeItem(tokenKey);
        return;
      }catch(error){console.warn('[GAIGS] Android secure storage unavailable:',error.message)}
    }
    sessionToken=legacy;
  })();

  async function saveToken(value){
    sessionToken=value||'';
    if(!native)return;
    if(secureStore){
      if(sessionToken)await secureStore.set({key:tokenKey,value:sessionToken});
      else await secureStore.remove({key:tokenKey});
      localStorage.removeItem(tokenKey);
    }else if(sessionToken)localStorage.setItem(tokenKey,sessionToken);
    else localStorage.removeItem(tokenKey);
  }

  async function request(path,options={}){
    await tokenReady;
    const headers=new Headers(options.headers||{});
    headers.set('x-gaigs-request','app');
    headers.set('x-gaigs-client',native?'native':'web');
    if(sessionToken)headers.set('authorization','Bearer '+sessionToken);
    if(options.json!==undefined){headers.set('content-type','application/json');options.body=JSON.stringify(options.json)}
    const response=await fetch(base+path,{...options,headers,credentials:'include'});
    const type=response.headers.get('content-type')||'';
    const payload=type.includes('application/json')?await response.json():{error:await response.text()};
    if(!response.ok)throw new Error(payload.error||`Request failed (${response.status}).`);
    if(payload.sessionToken&&native)await saveToken(payload.sessionToken);
    return payload;
  }

  function active(){return state.user?.accountMode==='sites'}
  function hydrate(payload){
    if(payload.user)state.user={...(state.user||{}),...payload.user,accountMode:'sites'};
    if(payload.wallet)state.wallet=payload.wallet;
    if(Array.isArray(payload.transactions))state.transactions=payload.transactions;
    save();render();
  }
  async function loadShared(){
    if(!active())return;
    const [posts,proposals]=await Promise.allSettled([request('/api/posts'),request('/api/governance/proposals')]);
    if(posts.status==='fulfilled')state.posts=posts.value.posts||[];
    if(proposals.status==='fulfilled')state.proposals=proposals.value.proposals||[];
    save();render();
  }
  async function register(details){const result=await request('/api/auth/register',{method:'POST',json:details});hydrate(result);await loadShared();return result}
  async function login(email,password){const result=await request('/api/auth/login',{method:'POST',json:{email,password}});hydrate(result);await loadShared();return result}
  async function logout(){try{await request('/api/auth/logout',{method:'POST'})}finally{await saveToken('')}}
  async function me(){const result=await request('/api/auth/me');hydrate(result);await loadShared();return result}
  async function updateProfile(profile){const result=await request('/api/profile',{method:'PATCH',json:profile});hydrate(result);return result}
  async function upload(file,purpose='post'){
    const form=new FormData();form.append('file',file);
    return request(purpose==='avatar'?'/api/profile/avatar':'/api/uploads',{method:'POST',body:form});
  }
  async function createPost(post){const result=await request('/api/posts',{method:'POST',json:post});if(result.wallet)state.wallet=result.wallet;return result}
  async function createProposal(proposal){return request('/api/governance/proposals',{method:'POST',json:proposal})}
  async function vote(proposalId,choice){return request(`/api/governance/proposals/${encodeURIComponent(proposalId)}/vote`,{method:'POST',json:{choice}})}
  async function transfer(recipientWalletId,amount,purpose){const result=await request('/api/wallet/transfer',{method:'POST',json:{recipientWalletId,amount,purpose}});if(result.wallet)state.wallet=result.wallet;return result}
  async function verifyLedger(){return request('/api/ledger/verify')}

  async function registerMessagingDevice(device){return request('/api/messaging/devices',{method:'PUT',json:device})}
  async function messagingContacts(query=''){return request('/api/messaging/contacts'+(query?`?q=${encodeURIComponent(query)}`:''))}
  async function messagingKeys(userId){return request(`/api/messaging/keys/${encodeURIComponent(userId)}`)}
  async function messagingMessages(after=0){return request(`/api/messaging/messages?after=${Math.max(0,Number(after)||0)}`)}
  async function sendEncryptedMessage(message){return request('/api/messaging/messages',{method:'POST',json:message})}
  async function markMessageRead(messageId){return request(`/api/messaging/messages/${encodeURIComponent(messageId)}/read`,{method:'POST'})}
  async function verifyConversation(conversationId){return request(`/api/messaging/conversations/${encodeURIComponent(conversationId)}/verify`)}
  async function roomMessages(type,key=''){const query=new URLSearchParams({type});if(key)query.set('key',key);return request(`/api/messaging/rooms?${query}`)}
  async function postRoomMessage(message){return request('/api/messaging/rooms',{method:'POST',json:message})}

  window.gaigsApi={base,native,active,request,register,login,logout,me,updateProfile,upload,createPost,createProposal,vote,transfer,verifyLedger,loadShared,registerMessagingDevice,messagingContacts,messagingKeys,messagingMessages,sendEncryptedMessage,markMessageRead,verifyConversation,roomMessages,postRoomMessage};
  queueMicrotask(()=>me().catch(error=>{if(active()){state.user=null;save();render()}console.info('[GAIGS] Shared session:',error.message)}));
})();
