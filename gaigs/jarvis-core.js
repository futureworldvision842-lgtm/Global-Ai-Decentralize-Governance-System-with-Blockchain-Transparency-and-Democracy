/* Voice-first JARVIS: local safe commands plus authenticated server intelligence. */
(function(){
  'use strict';
  const routeIntents=[
    {pattern:/\b(open|show|go to)\b.*\b(wallet|treasury|account)\b/i,view:'treasury',reply:'Opening your wallet and transparent ledger.'},
    {pattern:/\b(open|show|go to)\b.*\b(map|nearby|location)\b/i,view:'map',reply:'Opening the map and nearby activity.'},
    {pattern:/\b(open|show|go to)\b.*\b(vote|voting|governance|proposal)\b/i,view:'governance',reply:'Opening governed discussions and eligible votes.'},
    {pattern:/\b(open|show|go to)\b.*\b(community|society)\b/i,view:'communities',reply:'Opening your nearby communities.'},
    {pattern:/\b(open|show|go to)\b.*\b(job|service|work|market)\b/i,view:'services',reply:'Opening skill and service matches.'},
    {pattern:/\b(open|show|go to)\b.*\b(game|science|humanity lab)\b/i,view:'science',reply:'Opening the Humanity Lab.'},
    {pattern:/\b(open|show|go to)\b.*\b(admin|operations|authority|roles)\b/i,view:'operations',reply:'Opening your verified roles and operations access.'}
  ];
  function localIntent(prompt){
    const route=routeIntents.find(item=>item.pattern.test(prompt));
    if(route){navigate(route.view);return route.reply;}
    if(/\b(create|write|draft)\b.*\b(post|problem report)\b/i.test(prompt)){action('post');return 'I opened a post draft. Review it before publishing.';}
    if(/\b(create|write|draft)\b.*\bproposal\b/i.test(prompt)){action('proposal');return 'I opened a governed proposal draft. Add evidence and review it before submission.';}
    return null;
  }
  function safeContext(){
    const user=state.user||{},context={city:user.city||'',country:user.country||'',view:state.view,scope:state.scope};
    if(state.settings?.jarvisCommunity!==false)context.community=state.community||'';
    if(state.settings?.jarvisSkills!==false)context.skills=user.skills||'';
    if(state.view==='governance'){
      const p=(state.proposals||[])[0];if(p)context.proposal={id:p.id,title:p.title,status:p.status,scope:p.scope,summary:p.summary,evidence:p.evidence};
    }
    if(state.settings?.jarvisLedger===true&&state.view==='treasury')context.treasurySummary={entryCount:(state.transactions||[]).length,mode:state.wallet?.status||'sandbox'};
    return context;
  }
  function offlineAnswer(prompt){
    const p=prompt.toLowerCase();
    if(p.includes('proposal')||p.includes('vote'))return 'Offline JARVIS can help structure arguments and evidence, but shared proposal facts require the connected server. Open Governance to inspect the records saved in this workspace.';
    if(p.includes('fund')||p.includes('wallet'))return 'Open Wallet to inspect the current ledger mode. I will not describe a draft as money moved, and I cannot submit a transfer.';
    if(p.includes('work')||p.includes('service'))return 'Open Services to compare declared skills, coverage and reputation. Exact home coordinates are not shared.';
    return 'JARVIS is in preview assistance mode. I can navigate, open a draft, and explain the visible interface; shared facts require a verified account.';
  }
  function setMode(mode){const label=document.querySelector('.jarvis-head small');if(label)label.textContent=mode;}
  settingsJarvis=function(){const options=[['jarvisCommunity','Use joined community context',state.settings?.jarvisCommunity!==false],['jarvisSkills','Use declared skills for matching',state.settings?.jarvisSkills!==false],['jarvisLedger','Use ledger summary when Wallet is open',state.settings?.jarvisLedger===true]];return `<div class="activity-list">${options.map(item=>`<label class="activity-item"><input type="checkbox" data-jarvis-setting="${item[0]}" ${item[2]?'checked':''}><div><b>${item[1]}</b><p>Permission-controlled context; you can change it at any time.</p></div></label>`).join('')}<label class="activity-item"><input type="checkbox" disabled><div><b>Vote, approve, publish or move funds</b><p>Always disabled by platform authority rules.</p></div></label></div>`;};
  askJarvis=async function(prompt){
    const userBubble=document.createElement('div');userBubble.className='user-msg';userBubble.textContent=prompt;$('#jarvisChat').appendChild(userBubble);
    const answerBubble=document.createElement('div');answerBubble.className='ai-msg';answerBubble.textContent='Listening and checking your permitted context…';$('#jarvisChat').appendChild(answerBubble);$('#jarvisChat').scrollTop=$('#jarvisChat').scrollHeight;
    const local=localIntent(prompt);if(local){answerBubble.textContent=local;setMode('Voice navigation · user controlled');jarvisSpeak(local);return;}
    const configured=String(window.NDCONF?.jarvisProxyUrl||'').trim();
    const proxy=configured||(location.protocol==='http:'||location.protocol==='https:'?'/.netlify/functions/jarvis-v2':'');
    if(!proxy){const reply=offlineAnswer(prompt);answerBubble.textContent=reply;setMode('Preview assistance · no shared facts');jarvisSpeak(reply);return;}
    try{
      const headers={'Content-Type':'application/json'};
      if(fbAuth?.currentUser)headers.Authorization=`Bearer ${await fbAuth.currentUser.getIdToken()}`;
      const response=await fetch(proxy,{method:'POST',headers,body:JSON.stringify({prompt,scope:state.scope,context:safeContext()})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'JARVIS server unavailable');
      const reply=String(result.answer||'').trim()||offlineAnswer(prompt);answerBubble.textContent=reply;answerBubble.dataset.auditId=result.auditId||'';setMode('Connected intelligence · human approval required');jarvisSpeak(reply);
    }catch(error){const reply=`${offlineAnswer(prompt)} Server status: ${error.message}.`;answerBubble.textContent=reply;setMode('Offline fallback · server unavailable');jarvisSpeak(reply);}
    $('#jarvisChat').scrollTop=$('#jarvisChat').scrollHeight;
  };
  const priorBindDynamic=bindDynamic;
  bindDynamic=function(){priorBindDynamic();$$('[data-jarvis-setting]').forEach(input=>input.addEventListener('change',()=>{state.settings[input.dataset.jarvisSetting]=input.checked;save();toast('JARVIS permission updated.');}));};
  setMode(location.protocol==='file:'?'Preview assistance · shared services start on the secure release':'Connected when authenticated');
})();
