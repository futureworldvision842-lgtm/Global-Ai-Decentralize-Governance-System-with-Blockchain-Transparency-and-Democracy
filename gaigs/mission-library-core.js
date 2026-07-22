/* Source-linked creator library and JARVIS mission intelligence. */
(function(){
  'use strict';
  const library=window.GAIGSCreatorLibrary||{folders:[],rootFiles:[],sites:[]};
  const mission={status:'idle',brief:null,error:''};
  const libraryUi={query:'',type:'all',folder:'all',showAll:false};
  const cacheKey='gaigsMissionBriefCacheV1',cacheMs=6*60*60*1000;
  const typeIcons={video:'▶',audio:'♫',image:'▧',document:'DOC',presentation:'SLD',folder:'⌂',app:'APP',file:'•'};
  const typeLabels={video:'Video',audio:'Audio',image:'Image',document:'Document',presentation:'Presentation',folder:'Folder',app:'App',file:'File'};
  let lastActionSource=null;
  document.addEventListener('click',event=>{const source=event.target.closest('[data-action]');if(source)lastActionSource=source;},true);

  const allItems=()=>{
    const root=(library.rootFiles||[]).map(item=>({...item,folder:'Drive root'}));
    const nested=(library.folders||[]).flatMap(folder=>(folder.items||[]).map(item=>({...item,folder:folder.name,folderId:folder.id})));
    return [...root,...nested];
  };
  const totalStats=()=>{const items=allItems();return {files:items.filter(x=>x.type!=='folder').length,videos:items.filter(x=>x.type==='video').length,folders:(library.folders||[]).length+items.filter(x=>x.type==='folder').length,documents:items.filter(x=>['document','presentation'].includes(x.type)).length};};
  const safeDate=value=>{try{return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}catch(error){return 'Current source check';}};
  const itemById=id=>allItems().find(item=>item.id===id);
  const signalById=id=>(mission.brief?.signals||[]).find(item=>item.id===id);
  const sourceLabel=item=>item.source?.name||item.source||'Original source';

  function featuredItems(){
    const preferred=['Humanity_OS_3.mp4','Think_Globally,_Act_Locally__Rebuilding_Civilization_from_the_N','The_Next_Social_Operating_System.mp4','Engineering_Programmable_Trust__The_AI-Blockchain_Synthesis.mp4','One Earth. One Platform. One Future._1080p_caption.mp4','Tafkir-e-Afkar — Episode 1 (Intro)_1080p_caption.mp4','full podcast.mp4','GAIGS_Investor_Deck_v2_Visual.pdf'];
    const items=allItems(),found=preferred.map(name=>items.find(item=>item.name===name||item.name.startsWith(name))).filter(Boolean);
    return [...new Map(found.map(item=>[item.id,item])).values()].slice(0,8);
  }
  function libraryItemCard(item){
    const icon=typeIcons[item.type]||typeIcons.file,previewable=!['folder','app'].includes(item.type);
    return `<article class="library-item-card"><div class="library-item-icon ${esc(item.type||'file')}">${esc(icon)}</div><div class="library-item-copy"><div class="meta-row"><span class="tag">${esc(typeLabels[item.type]||'File')}</span><span>${esc(item.folder||'Drive root')}</span></div><h3>${esc(item.name)}</h3><p>${item.size?`${esc(item.size)} · `:''}Opens from its original Google Drive source.</p></div><div class="library-item-actions">${previewable?`<button class="mini-btn" data-action="libraryPreview" data-library-id="${esc(item.id)}">Preview</button>`:''}<a class="ghost-btn" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Open source</a><button class="mini-btn" data-action="libraryDraft" data-library-id="${esc(item.id)}">Prepare post</button></div></article>`;
  }
  function filteredItems(){
    const query=libraryUi.query.trim().toLowerCase();let items=allItems();
    if(libraryUi.folder!=='all')items=items.filter(item=>item.folderId===libraryUi.folder||item.id===libraryUi.folder);
    if(libraryUi.type!=='all')items=items.filter(item=>item.type===libraryUi.type);
    if(query)items=items.filter(item=>`${item.name} ${item.folder} ${item.type}`.toLowerCase().includes(query));
    if(!query&&libraryUi.folder==='all'&&libraryUi.type==='all'&&!libraryUi.showAll){const ids=new Set(featuredItems().map(item=>item.id));items=items.filter(item=>ids.has(item.id));}
    return items;
  }
  function libraryResults(){
    const items=filteredItems(),total=allItems().length,expanded=libraryUi.showAll||libraryUi.query||libraryUi.folder!=='all'||libraryUi.type!=='all';
    return `<div class="library-results-head"><div><b>${items.length} item${items.length===1?'':'s'} shown</b><span>${expanded?`${total} indexed items available`:'Mission-selected starting collection'}</span></div>${!expanded?'<button class="ghost-btn" data-action="libraryAll">Browse complete index</button>':''}</div><div class="library-item-list">${items.length?items.slice(0,expanded?500:12).map(libraryItemCard).join(''):'<div class="empty-state"><h3>No matching source</h3><p>Try another word, media type or folder.</p></div>'}</div>`;
  }
  function siteCard(site){return `<a class="mission-link-card" href="${esc(site.url)}" target="_blank" rel="noopener noreferrer"><span>${esc(site.kind)}</span><b>${esc(site.name)}</b><p>${esc(site.description)}</p><i>Open verified link ↗</i></a>`;}
  function folderCard(folder){
    const items=folder.items||[],videoCount=items.filter(item=>item.type==='video').length;
    return `<article class="drive-folder-card"><div><span class="drive-folder-icon">⌂</span><span class="tag">${items.length} indexed</span></div><h3>${esc(folder.name)}</h3><p>${videoCount} video${videoCount===1?'':'s'} · source-linked collection</p><div class="rule-actions"><button class="mini-btn" data-action="libraryFolder" data-library-folder="${esc(folder.id)}">Browse here</button><a class="ghost-btn" href="${esc(folder.url)}" target="_blank" rel="noopener noreferrer">Open Drive</a></div></article>`;
  }

  views.library=function(){
    const count=totalStats(),types=['all','video','audio','document','image','folder'];
    return `${pageHead('Creator & Mission Library','Search Muhammad Qureshi’s public Drive collection, open original sources and prepare member posts without silently republishing anyone’s work.',`<a class="action-btn" href="${esc(library.rootUrl)}" target="_blank" rel="noopener noreferrer">Open complete Drive ↗</a>`)}
      <section class="library-hero"><div><span class="overview-kicker">PUBLIC SOURCE INDEX · ${esc(library.version||'CURRENT')}</span><h2>From ideas and research<br>to media people can act on.</h2><p>${esc(library.note||'Original sources remain visible.')}</p></div><div class="library-stat-grid"><div><b>${count.files}</b><span>files indexed</span></div><div><b>${count.videos}</b><span>videos</span></div><div><b>${count.folders}</b><span>folders</span></div><div><b>${count.documents}</b><span>documents</span></div></div></section>
      <div class="capability-strip"><span class="tag green">SOURCE-LINKED</span><b>No blind reposting</b><span>JARVIS prepares a draft; the signed-in member reviews scope, context and ownership before publishing.</span></div>
      <section class="library-toolbar"><label class="library-search"><span>⌕</span><input id="librarySearch" type="search" value="${esc(libraryUi.query)}" placeholder="Search videos, podcasts, GAIGS plans, songs, folders…"></label><div class="library-filter-row">${types.map(type=>`<button class="${libraryUi.type===type?'active':''}" data-action="libraryType" data-library-type="${type}">${type==='all'?'All':typeLabels[type]}</button>`).join('')}</div></section>
      <div class="dashboard-grid">
        <section class="card span-12"><div class="card-head"><div class="card-title">Featured mission media</div><span class="tag">ORIGINAL DRIVE SOURCES</span></div><div class="card-body"><div class="featured-library-grid">${featuredItems().map(libraryItemCard).join('')}</div></div></section>
        <section class="card span-12"><div class="card-head"><div class="card-title">Drive collections</div><button class="ghost-btn" data-action="libraryAll">See every indexed item</button></div><div class="card-body"><div class="drive-folder-grid">${(library.folders||[]).map(folderCard).join('')}</div></div></section>
        <section class="card span-12"><div class="card-head"><div class="card-title">Search results</div><span class="tag">${count.files} SOURCE FILES</span></div><div class="card-body" id="libraryResults">${libraryResults()}</div></section>
        <section class="card span-12"><div class="card-head"><div class="card-title">Muhammad’s public network</div><span class="tag green">DIRECT LINKS</span></div><div class="card-body"><div class="mission-link-grid">${(library.sites||[]).map(siteCard).join('')}</div></div></section>
      </div>`;
  };

  function sourceStateRows(){
    const statuses=mission.brief?.sourceStatus||[];
    if(!statuses.length)return '<div class="source-status-row"><span class="source-dot pending"></span><div><b>Waiting for source check</b><p>No headline is shown until an official source responds.</p></div></div>';
    return statuses.map(item=>`<div class="source-status-row"><span class="source-dot ${item.ok?'ok':'error'}"></span><div><b>${esc(item.name)}</b><p>${esc(item.ok?`${item.count||0} current records received`:item.message||'Temporarily unavailable')}</p></div></div>`).join('');
  }
  function signalCard(signal,index){
    const location=signal.location||signal.category||'Global';
    return `<article class="mission-signal-card"><div class="mission-signal-head"><div><span class="mission-rank">${String(index+1).padStart(2,'0')}</span><span class="tag ${signal.priority==='urgent'?'red':signal.priority==='high'?'gold':''}">${esc(signal.priority||'watch')}</span></div><span>${esc(location)}</span></div><h3>${esc(signal.title)}</h3><p class="mission-problem">${esc(signal.problem||signal.summary||'Open the original source for verified details.')}</p><div class="mission-action"><span>JARVIS ACTION PATH</span><p>${esc(signal.suggestedAction||'Verify locally, identify responsible people and open a source-linked discussion.')}</p></div><div class="mission-signal-footer"><div><b>${esc(sourceLabel(signal))}</b><span>${esc(signal.publishedAt?safeDate(signal.publishedAt):'Current source')}</span></div><div class="rule-actions"><a class="ghost-btn" href="${esc(signal.url)}" target="_blank" rel="noopener noreferrer">Read source</a><button class="mini-btn" data-action="missionDraft" data-mission-id="${esc(signal.id)}">Draft discussion</button></div></div></article>`;
  }
  views.mission=function(){
    const signals=mission.brief?.signals||[],generated=mission.brief?.generatedAt?safeDate(mission.brief.generatedAt):'Not checked yet';
    return `${pageHead('JARVIS Mission Desk','A current, source-labelled global brief that turns public signals into questions and member-approved action drafts—not automatic posts or AI orders.','<button class="ghost-btn" data-action="missionAsk">Hear JARVIS brief</button><button class="action-btn" data-action="missionRefresh">Refresh sources</button>')}
      <section class="mission-desk-hero"><div><span class="overview-kicker"><b>DAILY MISSION</b> HUMANITY-FIRST INTELLIGENCE</span><h2>See the problem.<br><em>Organize the response.</em></h2><p>JARVIS combines official disaster and humanitarian sources, shows provenance and proposes a first community action. Members decide what to share, discuss or fund.</p><div class="overview-hero-actions"><button class="primary" data-action="missionAsk">Ask JARVIS what matters</button><button class="secondary" data-view="library">Open creator library</button></div></div><aside class="mission-source-panel"><small>LAST SOURCE CHECK</small><strong>${esc(generated)}</strong><div class="source-status-list">${sourceStateRows()}</div><p>Feeds refresh on demand and are cached for up to six hours. This is not an emergency dispatch service.</p></aside></section>
      <div class="capability-strip"><span class="tag ${mission.status==='ready'?'green':'gold'}">${mission.status==='loading'?'CHECKING SOURCES':mission.status==='ready'?'SOURCES LOADED':'SOURCE CHECK NEEDED'}</span><b>${signals.length} current signal${signals.length===1?'':'s'}</b><span>Always follow local authorities and field responders for urgent instructions.</span></div>
      <div class="dashboard-grid"><section class="card span-8"><div class="card-head"><div class="card-title">Global problems & action paths</div><span class="tag">NASA EONET + GDACS</span></div><div class="card-body"><div class="mission-signal-list">${mission.status==='loading'?'<div class="mission-loading"><span></span><span></span><span></span><p>JARVIS is checking official public sources…</p></div>':signals.length?signals.map(signalCard).join(''):`<div class="empty-state"><h3>${mission.error?'Sources temporarily unavailable':'Open this desk to load the current brief'}</h3><p>${esc(mission.error||'No current signal is invented when sources cannot be reached.')}</p><button class="action-btn" data-action="missionRefresh">Try source check</button></div>`}</div></div></section>
        <section class="span-4 mission-side-stack">
          ${card('How JARVIS shares','<div class="mission-rule-list"><div><span>1</span><p><b>Source first</b>Headline, date and original link stay visible.</p></div><div><span>2</span><p><b>Draft, never command</b>JARVIS suggests a question and first action.</p></div><div><span>3</span><p><b>Member approval</b>You choose society, city, country or global scope.</p></div><div><span>4</span><p><b>Evidence loop</b>Discussion can become a proposal, project and proof record.</p></div></div>',12)}
          ${card('Mission channels','<div class="activity-list"><button class="activity-item" data-view="emergency"><div class="activity-icon">!</div><div><b>Emergency response</b><p>Field reports and transparent relief records</p></div></button><button class="activity-item" data-view="science"><div class="activity-icon">✦</div><div><b>Humanity Lab</b><p>Turn unsolved problems into missions</p></div></button><button class="activity-item" data-view="governance"><div class="activity-icon">✓</div><div><b>Public decisions</b><p>Move from discussion to member vote</p></div></button></div>',12)}
          ${card('Official source policy','<p class="muted">The desk currently reads public machine feeds from NASA EONET and GDACS. A source outage is displayed as an outage; it is never filled with invented “breaking news.”</p><div class="rule-actions"><a class="ghost-btn" href="https://eonet.gsfc.nasa.gov/" target="_blank" rel="noopener noreferrer">NASA EONET</a><a class="ghost-btn" href="https://www.gdacs.org/" target="_blank" rel="noopener noreferrer">GDACS</a></div>',12)}
        </section></div>`;
  };
  viewNames.library='Creator & mission library';viewNames.mission='JARVIS mission desk';

  function renderLibraryResults(){
    const target=$('#libraryResults');
    if(!target)return;
    target.innerHTML=libraryResults();
    $$('[data-action]',target).forEach(button=>{
      if(button.dataset.missionLibraryBound)return;
      button.dataset.missionLibraryBound='1';
      button.addEventListener('click',()=>action(button.dataset.action));
    });
  }
  function loadCachedBrief(){
    try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');if(cached?.savedAt&&cached?.brief&&Date.now()-cached.savedAt<cacheMs){mission.status='ready';mission.brief=cached.brief;return true;}}
    catch(error){localStorage.removeItem(cacheKey);}return false;
  }
  async function ensureMissionBrief(force=false){
    if(!force&&['loading','ready','error'].includes(mission.status))return;if(!force&&loadCachedBrief())return;
    mission.status='loading';mission.error='';if(state.view==='mission')render();
    try{const endpoint=window.NDCONF?.missionApiUrl||(window.Capacitor?'https://gaigs-humanity-platform.qw01.chatgpt.site/api/mission-brief':'/api/mission-brief'),response=await fetch(endpoint,{headers:{accept:'application/json'},cache:'no-store'}),payload=await response.json().catch(()=>null);if(!response.ok||!payload||!Array.isArray(payload.signals))throw new Error(payload?.error||`Source service returned ${response.status}.`);mission.status='ready';mission.brief=payload;localStorage.setItem(cacheKey,JSON.stringify({savedAt:Date.now(),brief:payload}));}
    catch(error){mission.status='error';mission.error=error.message||'Official sources could not be reached.';}
    if(state.view==='mission')render();
  }
  function openDraft({title,type='Discussion',scope='Global',location='Public source',text}){
    openModal(`<h2>Review JARVIS draft</h2><p class="muted">Nothing has been published. Check the source, wording, geographic scope and ownership before you submit.</p>${postForm()}`);
    const typeInput=$('#postType'),scopeInput=$('#postScope'),locationInput=$('#postLocation'),textInput=$('#postText');if(typeInput)typeInput.value=type;if(scopeInput)scopeInput.value=scope;if(locationInput)locationInput.value=location;if(textInput)textInput.value=`${title}\n\n${text}`;textInput?.focus();
  }
  function briefText(){const signals=mission.brief?.signals||[];if(!signals.length)return 'No current source-backed signal is loaded. Open the Mission Desk and refresh official sources first.';return `Today’s source-backed mission brief has ${signals.length} signals. ${signals.slice(0,3).map((item,index)=>`${index+1}: ${item.title}. Suggested first action: ${item.suggestedAction}`).join(' ')}`;}

  const priorAction=action;
  action=function(type){
    const source=lastActionSource;
    if(type==='libraryAll'){libraryUi.showAll=true;libraryUi.folder='all';renderLibraryResults();return;}
    if(type==='libraryFolder'){libraryUi.folder=source?.dataset.libraryFolder||'all';libraryUi.showAll=true;renderLibraryResults();$('#libraryResults')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
    if(type==='libraryType'){libraryUi.type=source?.dataset.libraryType||'all';libraryUi.showAll=true;render();return;}
    if(type==='libraryPreview'){const item=itemById(source?.dataset.libraryId);if(!item)return toast('Source item was not found.');openModal(`<h2>${esc(item.name)}</h2><p class="muted">Playing from the original public Google Drive source. Ownership and source remain visible.</p><iframe class="drive-preview-frame" src="https://drive.google.com/file/d/${encodeURIComponent(item.id)}/preview" allow="autoplay; fullscreen" title="${esc(item.name)}"></iframe><div class="rule-actions"><a class="action-btn" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Open original source ↗</a><button class="ghost-btn" data-modal-close>Close preview</button></div>`);return;}
    if(type==='libraryDraft'){const item=itemById(source?.dataset.libraryId);if(!item)return toast('Source item was not found.');openDraft({title:item.name,type:item.type==='video'?'Learning':'Discussion',location:`Public Drive · ${item.folder||'MQ Data'}`,text:`Why this may matter to our mission:\nAdd your context or question here.\n\nOriginal source: ${item.url}\nSource collection: ${item.folder||'MQ Data'}`});return;}
    if(type==='missionRefresh'){localStorage.removeItem(cacheKey);mission.status='idle';mission.brief=null;ensureMissionBrief(true);return;}
    if(type==='missionAsk'){const text=briefText();$('#jarvisPanel').classList.add('open');addAI(text);jarvisSpeak(text);return;}
    if(type==='missionDraft'){const signal=signalById(source?.dataset.missionId);if(!signal)return toast('Mission signal was not found.');openDraft({title:signal.title,type:'Problem',location:signal.location||signal.category||'Global',text:`Problem signal:\n${signal.problem||signal.summary||''}\n\nSuggested first community action:\n${signal.suggestedAction||''}\n\nSource: ${signal.url}\nPublisher: ${sourceLabel(signal)}\n\nPlease verify local conditions before proposing resources or funds.`});return;}
    return priorAction(type);
  };
  const priorBindDynamic=bindDynamic;
  bindDynamic=function(){
    priorBindDynamic();const search=$('#librarySearch');
    if(search&&!search.dataset.libraryBound){search.dataset.libraryBound='1';search.addEventListener('input',()=>{libraryUi.query=search.value;libraryUi.showAll=true;renderLibraryResults();});}
    if(state.view==='mission')ensureMissionBrief(false);
  };
  const priorJarvisContext=jarvisContextLine;
  jarvisContextLine=function(){const base=priorJarvisContext(),signals=mission.brief?.signals||[];return `${base} Mission Desk: ${signals.length?signals.slice(0,3).map(item=>item.title).join(' | '):'no current source-backed brief loaded'}.`;};
  const priorOverview=views.overview;
  views.overview=function(){return priorOverview().replace('<div class="home-actions">','<div class="home-actions mission-home-actions"><button data-view="mission"><i>◎</i><b>Mission</b><span>Daily global problems and action paths</span></button><button data-view="library"><i>▶</i><b>Library</b><span>Videos, research and public links</span></button>');};
  if(state.user)render();
})();
