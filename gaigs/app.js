(function migrateNewDawn(){
  if(localStorage.getItem('gaigsUnifiedMigrationV1'))return;
  try{
    const old=JSON.parse(localStorage.getItem('newdawn_app_v1')||'null');
    if(!old)return;
    if(!localStorage.getItem('gaigsUser')&&old.user){
      localStorage.setItem('gaigsUser',JSON.stringify({name:old.user.name,email:old.user.email,phone:old.user.phone,country:(old.user.country||'Pakistan'),city:(old.user.city||'Islamabad'),skills:(old.user.skills||''),mission:'Community governance and transparent action'}));
    }
    if(!localStorage.getItem('gaigsPosts')&&Array.isArray(old.posts)){
      localStorage.setItem('gaigsPosts',JSON.stringify(old.posts.map(p=>({name:p.by||'Member',initials:(p.by||'M').slice(0,2).toUpperCase(),scope:p.tier||'Society',time:'Migrated',type:p.type||'Discussion',text:p.tx||'',media:'Migrated NewDawn record'}))));
    }
    if(!localStorage.getItem('gaigsProposals')&&Array.isArray(old.props)){
      localStorage.setItem('gaigsProposals',JSON.stringify(old.props.map(p=>({id:String(p.id),title:p.title,scope:p.tier||'Society',status:p.status==='open'?'Voting':p.status,deadline:'Migrated decision',yes:(p.votes?.yes||[]).length,no:(p.votes?.no||[]).length,veto:(p.votes?.veto||[]).length,turnout:0,budget:p.cost||0,summary:p.desc||'',risk:'Pending review',evidence:0}))));
    }
    if(!localStorage.getItem('gaigsTx')&&Array.isArray(old.ledger)){
      localStorage.setItem('gaigsTx',JSON.stringify(old.ledger.map(x=>({date:new Date(x.t||Date.now()).toLocaleDateString(),type:(x.amt||0)>=0?'Incoming':'Expense',desc:x.w||'Migrated ledger entry',amount:x.amt||0,proof:'Migrated local audit'}))));
    }
    localStorage.setItem('gaigsUnifiedMigrationV1','complete');
  }catch(e){console.warn('[GAIGS] NewDawn migration skipped:',e.message)}
})();

const $ = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => [...el.querySelectorAll(q)];
const state = {
  user: JSON.parse(localStorage.getItem('gaigsUser')||'null'),
  scope: localStorage.getItem('gaigsScope') || 'personal',
  view: localStorage.getItem('gaigsView') || 'overview',
  community: 'Jamia Masjid Nabvi Qureshi Hashmi',
  votes: JSON.parse(localStorage.getItem('gaigsVotes')||'{}'),
  proposals: JSON.parse(localStorage.getItem('gaigsProposals')||'[]'),
  posts: JSON.parse(localStorage.getItem('gaigsPosts')||'[]'),
  transactions: JSON.parse(localStorage.getItem('gaigsTx')||'[]'),
  services: JSON.parse(localStorage.getItem('gaigsServices')||'[]'),
  companies: JSON.parse(localStorage.getItem('gaigsCompanies')||'[]'),
  communities: JSON.parse(localStorage.getItem('gaigsCommunities')||'[]'),
  projects: JSON.parse(localStorage.getItem('gaigsProjects')||'[]'),
  challenges: JSON.parse(localStorage.getItem('gaigsChallenges')||'[]'),
  applications: JSON.parse(localStorage.getItem('gaigsApplications')||'[]'),
  membershipRequests: JSON.parse(localStorage.getItem('gaigsMembershipRequests')||'[]'),
  connections: JSON.parse(localStorage.getItem('gaigsConnections')||'[]'),
  messages: JSON.parse(localStorage.getItem('gaigsMessages')||'[]'),
  wallet: JSON.parse(localStorage.getItem('gaigsWallet')||'null'),
  societyPetitions: JSON.parse(localStorage.getItem('gaigsSocietyPetitions')||'[]'),
  clerkMandates: JSON.parse(localStorage.getItem('gaigsClerkMandates')||'[]'),
  news: JSON.parse(localStorage.getItem('gaigsNews')||'[]'),
  projectContributions: JSON.parse(localStorage.getItem('gaigsProjectContributions')||'[]'),
  dao: JSON.parse(localStorage.getItem('gaigsDao')||'{"walletAddress":"","chainId":"","receipts":[]}'),
  settings: JSON.parse(localStorage.getItem('gaigsSettings')||'{"language":"English","jarvisStyle":"Simple and concise"}')
};
const seed = {
  proposals:[
    {id:'water',title:'Community clean-water filtration unit',scope:'Society',status:'Voting',deadline:'Closes in 7h 42m',yes:684,no:139,turnout:64,budget:1850000,summary:'Install a solar-assisted filtration unit near the community center, serving approximately 760 households. Funding releases in three verified milestones.',risk:'Medium',evidence:12},
    {id:'street',title:'Repair damaged street lights in Sector G-11/4',scope:'City',status:'Discussion',deadline:'Discussion ends tomorrow',yes:0,no:0,turnout:0,budget:420000,summary:'Replace 31 damaged lights and publish maintenance responsibility and completion photos.',risk:'Low',evidence:18},
    {id:'skills',title:'Weekend youth skills and AI learning lab',scope:'Society',status:'Approved',deadline:'Implementation',yes:941,no:87,turnout:81,budget:690000,summary:'Open a supervised weekend lab for AI literacy, editing, coding and entrepreneurship.',risk:'Low',evidence:9}
  ],
  transactions:[
    {date:'14 Jul',type:'Incoming',desc:'Water project community contributions',amount:286500,proof:'Verified'},
    {date:'13 Jul',type:'Expense',desc:'Solar filtration vendor advance - milestone 1',amount:-175000,proof:'Receipt + vote'},
    {date:'12 Jul',type:'Incoming',desc:'Anonymous relief contribution',amount:75000,proof:'Verified'},
    {date:'10 Jul',type:'Expense',desc:'Youth lab equipment - 4 refurbished PCs',amount:-128000,proof:'Invoice uploaded'},
    {date:'08 Jul',type:'Incoming',desc:'Friday community fund collection',amount:214300,proof:'Committee verified'}
  ],
  services:[
    {icon:'🎬',title:'Short-form video editor needed',meta:'1.2 km · Budget ₨12,000',person:'Afkaar Media',tag:'Creative'},
    {icon:'🔧',title:'Water pump inspection',meta:'0.7 km · Offers open',person:'G-11 Residents',tag:'Home service'},
    {icon:'🧠',title:'AI automation consultation',meta:'Remote · Budget ₨35,000',person:'Local Business Network',tag:'AI'},
    {icon:'🍲',title:'Home-cooked lunch subscriptions',meta:'2.0 km · 18 weekly orders',person:'Kitchen by Ayesha',tag:'Food'}
  ],
  members:[
    ['AH','Ahmed Hassan','Committee · Finance'],['SK','Sara Khan','Member · Teacher'],['UR','Umar Raza','Member · Developer'],['FA','Fatima Ali','Member · Health volunteer'],['DA','Daniyal Ahmed','Member · Video creator'],['ZN','Zainab Noor','Member · Student']
  ]
};

// ================= FIREBASE INITIALIZATION =================
let useFirebase = false;
let firebaseAvailable = false;
let fbApp, fbAuth, fbDb, fbStorage, fbFunctions;
const firebaseClientConfig=window.NDCONF?.firebase||null;
const firebaseConfigValid=Boolean(firebaseClientConfig&&
  /^AIza[0-9A-Za-z_-]{20,}$/.test(String(firebaseClientConfig.apiKey||''))&&
  !Object.values(firebaseClientConfig).some(value=>/YOUR_|REPLACE_|PASTE_/i.test(String(value))));
if (firebaseConfigValid && typeof firebase!=='undefined') {
  try {
    fbApp = firebase.initializeApp(firebaseClientConfig);
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    fbStorage = firebase.storage();
    fbFunctions = typeof firebase.functions==='function'?firebase.functions():null;
    firebaseAvailable = true;
    useFirebase = window.NDCONF.firebaseProductionMode === true || window.NDCONF.firebaseDemoSync === true;
    console.log("[GAIGS] Firebase client ready; shared sync " + (useFirebase ? "enabled" : "disabled"));
  } catch (err) {
    console.error("[GAIGS] Firebase initialization failed:", err);
  }
}

if(!state.proposals.length&&state.settings.showSampleData===true) state.proposals=seed.proposals.map(item=>({...item,recordMode:'sample'}));
if(!state.transactions.length&&state.settings.showSampleData===true) state.transactions=seed.transactions.map(item=>({...item,recordMode:'sample'}));

if (useFirebase && window.NDCONF?.enableLegacyUnscopedSync === true) {
  // Real-time proposals sync
  fbDb.collection('proposals').orderBy('createdAt', 'desc').onSnapshot(snap => {
    state.proposals = [];
    snap.forEach(doc => {
      const d = doc.data();
      const yesCount = Number(d.tally?.yes ?? (d.yesVotesList ? d.yesVotesList.length : (d.yes || 0)));
      const noCount = Number(d.tally?.no ?? (d.noVotesList ? d.noVotesList.length : (d.no || 0)));
      const abstainCount = Number(d.tally?.abstain || 0);
      const tot = yesCount + noCount + abstainCount;
      state.proposals.push({
        id: doc.id,
        title: d.title || '',
        summary: d.description || d.summary || '',
        scope: d.scope || 'Society',
        scopeId: d.scopeId || '',
        status: d.status || 'Voting',
        deadline: d.votingClosesAt?.toDate?.().toLocaleString() || d.discussionClosesAt?.toDate?.().toLocaleString() || d.deadline || 'Server-controlled phase',
        closesAt: d.votingClosesAt?.toDate?.().toISOString() || null,
        yes: yesCount,
        no: noCount,
        abstain: abstainCount,
        eligibleCount: Number(d.eligibleCount || 0),
        turnout: d.turnoutPercent ?? (tot > 0 && d.eligibleCount ? Math.round((tot / d.eligibleCount) * 100) : 0),
        ruleKey: d.ruleKey || 'standard',
        rulesVersion: d.rulesVersion || '',
        budget: d.budget || 0,
        risk: d.risk || 'Low',
        evidence: d.evidenceCount ?? d.evidence ?? 0
      });
    });
    render();
  });

  // Real-time posts/feed sync
  fbDb.collection('posts').orderBy('createdAt', 'desc').onSnapshot(snap => {
    state.posts = [];
    snap.forEach(doc => {
      const d = doc.data();
      state.posts.push({
        name: d.name || 'Anonymous',
        initials: d.initials || 'U',
        scope: d.scope || 'Society',
        time: d.time || 'Just now',
        type: d.type || 'Discussion',
        text: d.text || '',
        media: d.media || '',
        location: d.location || '',
        lat: d.lat ?? null,
        lng: d.lng ?? null,
        locationPrecision: d.locationPrecision || 'none'
      });
    });
    render();
  });

  // Real-time transactions ledger sync
  fbDb.collection('transactions').orderBy('createdAt', 'desc').onSnapshot(snap => {
    state.transactions = [];
    snap.forEach(doc => {
      const d = doc.data();
      state.transactions.push({
        date: d.date || 'Today',
        type: d.type || 'Incoming',
        desc: d.desc || '',
        amount: d.amount || 0,
        proof: d.proof || 'Verified'
      });
    });
    render();
  });
}

function save(){
  localStorage.setItem('gaigsUser',JSON.stringify(state.user));
  localStorage.setItem('gaigsScope',state.scope);localStorage.setItem('gaigsView',state.view);
  localStorage.setItem('gaigsVotes',JSON.stringify(state.votes));localStorage.setItem('gaigsProposals',JSON.stringify(state.proposals));
  localStorage.setItem('gaigsPosts',JSON.stringify(state.posts));localStorage.setItem('gaigsTx',JSON.stringify(state.transactions));
  localStorage.setItem('gaigsServices',JSON.stringify(state.services));localStorage.setItem('gaigsCommunities',JSON.stringify(state.communities));
  localStorage.setItem('gaigsCompanies',JSON.stringify(state.companies));
  localStorage.setItem('gaigsProjects',JSON.stringify(state.projects));localStorage.setItem('gaigsChallenges',JSON.stringify(state.challenges));
  localStorage.setItem('gaigsApplications',JSON.stringify(state.applications));localStorage.setItem('gaigsSettings',JSON.stringify(state.settings));
  localStorage.setItem('gaigsMembershipRequests',JSON.stringify(state.membershipRequests||[]));
  localStorage.setItem('gaigsConnections',JSON.stringify(state.connections||[]));
  localStorage.setItem('gaigsMessages',JSON.stringify(state.messages||[]));
  localStorage.setItem('gaigsWallet',JSON.stringify(state.wallet||null));
  localStorage.setItem('gaigsSocietyPetitions',JSON.stringify(state.societyPetitions||[]));
  localStorage.setItem('gaigsClerkMandates',JSON.stringify(state.clerkMandates||[]));
  localStorage.setItem('gaigsNews',JSON.stringify(state.news||[]));
  localStorage.setItem('gaigsProjectContributions',JSON.stringify(state.projectContributions||[]));
  localStorage.setItem('gaigsDao',JSON.stringify(state.dao||{}));
}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function esc(s=''){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function money(n){return new Intl.NumberFormat('en-PK',{style:'currency',currency:'PKR',maximumFractionDigits:0}).format(n).replace('PKR','₨')}
function card(title,body,span=4,extra=''){return `<section class="card span-${span} ${extra}"><div class="card-head"><div class="card-title">${title}</div><button class="ghost-btn">⋯</button></div><div class="card-body">${body}</div></section>`}
function pageHead(title,sub,action=''){return `<div class="page-head"><div><h1>${title}</h1><p>${sub}</p></div><div class="page-actions">${action}</div></div>`}
function getScopeLabel(){return state.scope[0].toUpperCase()+state.scope.slice(1)}
function svgWorld(){return `<svg class="world-svg" viewBox="0 0 1000 420" aria-label="abstract world map"><path fill="#173047" d="M90 120l70-45 97 16 67 46-35 38-62 1-19 49-52 20-31-52-54-13zm285-51 56-24 64 18 44-26 63 27-11 32-72 5-14 45-54-4-28-30-47-7zm213 72 62-38 68 17 35 34 72 5 83 48-17 60-67 9-50-32-44 19-26-34-72-2-35-34zm-269 125 49-30 60 18 14 45-36 49-68-4-32-39zm504 52 43-22 68 18 28 42-42 24-70-8-38-25z"/><g fill="none" stroke="#315c75" stroke-width="1" opacity=".6"><path d="M0 110C200 220 270 40 500 165S780 280 1000 90"/><path d="M0 270C240 150 360 335 610 218S820 85 1000 245"/></g></svg>`}
function worldMap(){return `<div class="map-shell">${svgWorld()}<span class="map-node" style="left:66%;top:42%"></span><span class="map-node orange" style="left:72%;top:49%"></span><span class="map-node green" style="left:24%;top:39%"></span><span class="map-node" style="left:49%;top:32%"></span><span class="map-node red" style="left:55%;top:60%"></span><span class="map-node orange" style="left:81%;top:37%"></span><div class="map-overlay"><button>Layers 8</button><button>Scope: ${getScopeLabel()}</button><button>Live activity</button><button>Verified only</button></div><div class="map-stats"><div><small>Active communities</small><b>12,842</b></div><div><small>Open proposals</small><b>3,106</b></div><div><small>Verified projects</small><b>864</b></div></div></div>`}
let gaigsMapInstance = null;
function initGaigsLeafletMap() {
  const mapShell = document.querySelector('.map-shell');
  if (!mapShell || !window.L) return;
  if (mapShell.dataset.leafletInit) return;
  mapShell.dataset.leafletInit = "true";
  mapShell.innerHTML = '<div id="gaigsLeaflet" style="width:100%;height:320px;border-radius:12px;z-index:1"></div>';
  gaigsMapInstance = L.map('gaigsLeaflet').setView([33.6844, 73.0479], 12);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(gaigsMapInstance);
  
  const pins = [
    { name: "Jamia Masjid Nabvi Qureshi Hashmi", lat: 33.6844, lng: 73.0479, desc: "Pilot Society Center · G-11/4 Islamabad" },
    { name: "G-11 Markaz Citizens Forum", lat: 33.6790, lng: 73.0400, desc: "City Network Hub · 842 members" },
    { name: "Islamabad AI Builders", lat: 33.6950, lng: 73.0180, desc: "Humanity Lab & Tech Center · F-10" },
    { name: "Northern Flood Response Zone", lat: 34.0150, lng: 71.5249, desc: "Emergency Relief Hub · Field Verified" }
  ];

  pins.forEach(pin => {
    const m = L.marker([pin.lat, pin.lng]).addTo(gaigsMapInstance);
    m.bindPopup(`<b>${pin.name}</b><br><small>${pin.desc}</small>`);
  });
}

function render(){
  if(!state.user){$('#authScreen').classList.remove('hidden');$('#app').classList.add('hidden');return}
  $('#authScreen').classList.add('hidden');$('#app').classList.remove('hidden');
  $('#topUserName').textContent=state.user.name.split(' ')[0];
  $$('.scope-btn').forEach(b=>b.classList.toggle('active',b.dataset.scope===state.scope));
  $$('.side-link[data-view],.top-nav [data-view],.bottom-nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));
  const f=views[state.view]||views.overview;$('#mainContent').innerHTML=f();bindDynamic();
  $('#jarvisContext').textContent=`${getScopeLabel()} · ${viewNames[state.view]||'Dashboard'}`;
  setTimeout(initGaigsLeafletMap, 100);
}
const viewNames={overview:'Operations overview',feed:'Action feed',map:'World map',communities:'Communities',governance:'Governance',projects:'Projects',treasury:'Wallet and treasury',services:'Services market',emergency:'Emergency response',science:'Humanity Lab',crew:'Founding crew',profile:'Personal profile',settings:'Settings',global:'Global pulse'};
const views={
  overview(){return `${pageHead(`Good morning, ${esc(state.user.name.split(' ')[0])}.`,`Here is what needs your attention across your ${getScopeLabel().toLowerCase()} network.`,`<button class="ghost-btn" data-action="investor">Investor mode</button><button class="action-btn" data-action="create">＋ Create action</button>`)}
  <div class="dashboard-grid">
    <section class="card span-12"><div class="card-body"><div class="mission-grid">
      <div class="mission-card" style="--accent:rgba(37,208,255,.18)"><small>Vote closes today</small><strong>1</strong><p>Clean-water filtration unit</p><button data-view="governance">Review and vote →</button></div>
      <div class="mission-card" style="--accent:rgba(255,157,66,.18)"><small>Issues need evidence</small><strong>2</strong><p>Street lights and waste pickup</p><button data-view="feed">Add evidence →</button></div>
      <div class="mission-card" style="--accent:rgba(79,224,164,.18)"><small>Project completion</small><strong>62%</strong><p>Youth AI learning lab</p><button data-view="projects">Track progress →</button></div>
      <div class="mission-card" style="--accent:rgba(231,184,90,.18)"><small>Skills matched</small><strong>3</strong><p>Nearby paid opportunities</p><button data-view="services">View matches →</button></div>
    </div></div></section>
    <section class="card span-8"><div class="card-head"><div class="card-title">Live Community World Map</div><button class="ghost-btn" data-view="map">Open map</button></div>${worldMap()}</section>
    ${card('JARVIS Daily Intelligence',`<div class="briefing"><b>Your society:</b> water proposal voting has reached 64% turnout. JARVIS found one missing vendor warranty document.<br><br><b>Your city:</b> 14 societies are discussing joint waste collection. Estimated shared procurement could reduce cost in the simulation by 18%.<br><br><b>Your skills:</b> one AI consultation and two video-production requests match your profile.</div><button class="action-btn" style="margin-top:12px" data-action="jarvis">Open full briefing</button>`,4)}
    ${card('Active Governance',proposalMini(),6)}
    ${card('Community Treasury',treasuryMini(),3)}
    ${card('Nearby Activity',activityMini(),3)}
    ${card('Global Pulse',globalMini(),6)}
    ${card('People Around You',membersMini(),3)}
    ${card('Humanity Lab',scienceMini(),3)}
  </div>`},
  feed(){return `${pageHead('Action Feed','Posts become discussions, proposals, services and verified projects.',`<button class="action-btn" data-action="post">＋ Create post</button>`)}<div class="dashboard-grid"><section class="span-8"><div class="feed-list">${feedPosts()}</div></section>${card('Feed filters',`<div class="activity-list">${['Following','Nearby','My society','City','Country','Global','Governance','Services','Verified only'].map((x,i)=>`<button class="filter-btn" style="text-align:left;color:${i===1?'var(--cyan)':''}">${x}</button>`).join('')}</div>`,4)}${card('Trending public missions',activityMini(),4)}</div>`},
  map(){return `${pageHead('World Operations Map','Explore communities, projects, emergencies, services and verified outcomes.',`<button class="action-btn">＋ Register a community</button>`)}<div class="dashboard-grid"><section class="card span-12"><div class="card-head"><div class="card-title">Global civic activity</div><div><span class="tag green">LIVE SIMULATION</span></div></div>${worldMap()}</section>${card('Map Layers',`<div class="activity-list">${['Communities','Open proposals','Active votes','Public projects','Fund flows','Service requests','Emergency missions','Scientific challenges'].map((x,i)=>`<label class="activity-item"><input type="checkbox" ${i<5?'checked':''}><div><b>${x}</b><p>Toggle visibility on the map.</p></div></label>`).join('')}</div>`,4)}${card('Selected location: Islamabad',`<div class="metric-row"><div class="metric"><small>Communities</small><b>164</b><em>+12 this month</em></div><div class="metric"><small>Active votes</small><b>28</b><em>71% avg turnout</em></div><div class="metric"><small>Project funds</small><b>₨18.6M</b><em>Demo data</em></div></div><div class="activity-list" style="margin-top:12px">${activityMini()}</div>`,8)}</div>`},
  communities(){return `${pageHead('Communities','Discover nearby communities or manage the ones you belong to.',`<button class="action-btn" data-action="community">＋ Create community</button>`)}<div class="dashboard-grid">${communityCards()}${card('Join requests',`<div class="activity-list"><div class="activity-item"><div class="activity-icon">⌛</div><div><b>Islamabad AI Builders</b><p>Your request is awaiting admin review.</p><div class="meta-row"><span class="tag gold">PENDING</span></div></div></div></div>`,4)}</div>`},
  governance(){return `${pageHead(`${getScopeLabel()} Governance`,`Rules, proposals and public decisions. AI explains; members decide.`,`<button class="action-btn" data-action="proposal">＋ New proposal</button>`)}<div class="dashboard-grid"><section class="span-8"><div class="proposal-list">${state.proposals.map(proposalCard).join('')}</div></section>${card('Governance rules',rulesPanel(),4)}${card('Participation analytics',`<div class="metric-row"><div class="metric"><small>Eligible members</small><b>1,284</b></div><div class="metric"><small>Average turnout</small><b>72%</b><em>+8% this quarter</em></div><div class="metric"><small>Verified votes</small><b>4,812</b><em>Hash-chain passed</em></div></div><div class="chart-bars">${[45,68,57,81,64,72].map((x,i)=>`<span style="height:${x}%" data-label="${['Feb','Mar','Apr','May','Jun','Jul'][i]}"></span>`).join('')}</div>`,8)}</div>`},
  projects(){return `${pageHead('Projects & Proof','Every approved decision becomes a transparent execution record.',`<button class="action-btn" data-action="project">＋ Start project</button>`)}<div class="dashboard-grid">${projectCards()}${card('Verification queue',`<div class="activity-list"><div class="activity-item"><div class="activity-icon">📎</div><div><b>Vendor warranty needs review</b><p>Water filtration project · milestone 1</p><div class="meta-row"><button class="mini-btn">Open evidence</button><button class="mini-btn">Ask JARVIS</button></div></div></div><div class="activity-item"><div class="activity-icon">📍</div><div><b>Geotagged completion photos</b><p>Street lighting pilot · 18 photos</p><div class="meta-row"><span class="tag green">VERIFIED</span></div></div></div></div>`,4)}</div>`},
  treasury(){return `${pageHead('Wallet & Transparent Treasury','Personal finance, community contributions and public project ledgers in one place.',`<button class="action-btn" data-action="addFunds">＋ Add demo funds</button>`)}<div class="demo-banner">ⓘ All balances in this prototype are simulated and have no real monetary value.</div><div class="dashboard-grid">${card('Personal Demo Wallet',walletPersonal(),5)}${card(`${state.community} Treasury`,walletCommunity(),7)}${card('Transparent transaction ledger',transactionTable(),8)}${card('Fund controls',fundControls(),4)}</div>`},
  services(){return `${pageHead('Local Services Market','Offer your skills, find nearby needs and create a trusted local economy.',`<button class="action-btn" data-action="service">＋ Offer a service</button>`)}<div class="dashboard-grid"><section class="span-8"><div class="service-list">${[...state.services,...seed.services].map(serviceCard).join('')}</div></section>${card('Your provider profile',providerProfile(),4)}${card('How matching works',`<div class="briefing"><b>1.</b> A person or community posts a verified need.<br><b>2.</b> Nearby providers submit prices, timelines and evidence.<br><b>3.</b> The requester selects an offer.<br><b>4.</b> Demo funds are reserved by milestone.<br><b>5.</b> Completion proof and ratings update reputation.</div>`,4)}</div>`},
  emergency(){return `${pageHead('Global Emergency Response','Verified alerts, dedicated wallets, field evidence and public delivery tracking.',`<button class="action-btn">Create verified alert</button>`)}<div class="dashboard-grid"><section class="card span-8"><div class="card-head"><div class="card-title">Active Emergency - Flood Response Simulation</div><span class="tag red">HIGH PRIORITY</span></div>${worldMap()}</section>${card('Emergency mission',`<h2 style="margin:0">Northern flood relief</h2><p class="muted">Verified by 3 local communities and 2 field teams.</p><div class="progress"><span style="width:68%"></span></div><div class="metric-row" style="margin-top:12px"><div class="metric"><small>Raised</small><b>₨8.2M</b></div><div class="metric"><small>Delivered</small><b>₨5.6M</b></div><div class="metric"><small>Families reached</small><b>1,940</b></div></div><button class="action-btn" style="margin-top:12px">View receipts and footage</button>`,4)}${card('Live delivery proof',`<div class="activity-list"><div class="activity-item"><div class="activity-icon">🚚</div><div><b>Water and food delivery - Zone 4</b><p>GPS verified · 28 minutes ago · 640 packages</p><span class="tag green">FIELD VERIFIED</span></div></div><div class="activity-item"><div class="activity-icon">🏥</div><div><b>Mobile medical camp</b><p>Receipt set 14 uploaded · 2 hours ago</p><span class="tag green">AUDIT PASSED</span></div></div></div>`,6)}${card('Public fund ledger',transactionTable(true),6)}</div>`},
  science(){return `${pageHead('Humanity Lab','Turn gaming, simulations and global collaboration into real problem-solving.',`<button class="action-btn">＋ Submit a challenge</button>`)}<div class="dashboard-grid">${scienceCards()}${card('Your learning profile',`<div class="profile-copy"><h2>Systems Explorer - Level 7</h2><p>AI policy analysis · water systems · scientific storytelling</p></div><div class="progress" style="margin:15px 0"><span style="width:71%"></span></div><div class="metric-row"><div class="metric"><small>Impact points</small><b>2,840</b></div><div class="metric"><small>Solutions</small><b>9</b></div><div class="metric"><small>Teams</small><b>3</b></div></div>`,4)}</div>`},
  crew(){return `${pageHead('Founding Crew','The platform is built in public by engineers, creators, researchers and community leaders.',`<button class="action-btn">Apply to crew</button>`)}<div class="dashboard-grid">${crewCards()}${card('Open missions',`<div class="activity-list"><div class="activity-item"><div class="activity-icon">FE</div><div><b>Frontend engineering sprint</b><p>Design system, mobile feed and operations dashboard.</p><span class="tag green">4 seats</span></div></div><div class="activity-item"><div class="activity-icon">AI</div><div><b>JARVIS civic intelligence evaluation</b><p>Bias tests, evidence grounding and multilingual responses.</p><span class="tag green">6 seats</span></div></div><div class="activity-item"><div class="activity-icon">UX</div><div><b>Community field research</b><p>Test onboarding with 50 pilot members.</p><span class="tag gold">Islamabad</span></div></div></div>`,4)}</div>`},
  profile(){return `${pageHead('Personal Profile','Your identity, skills, services, communities and public impact - controlled by you.',`<button class="action-btn">Edit profile</button>`)}<div class="dashboard-grid"><section class="card span-12"><div class="profile-banner"></div><div class="profile-info"><div class="profile-avatar">MQ</div><div class="profile-copy"><h2>${esc(state.user.name)}</h2><p>${esc(state.user.city)}, ${esc(state.user.country)} · Founding crew · Member since July 2026</p><div class="skill-grid">${state.user.skills.split(',').map(x=>`<span class="skill-chip">${esc(x.trim())}</span>`).join('')}</div></div><div><button class="action-btn">Follow impact</button></div></div></section>${card('Impact dashboard',`<div class="metric-row"><div class="metric"><small>Community contributions</small><b>18</b><em>Top 12%</em></div><div class="metric"><small>Verified service jobs</small><b>7</b><em>4.9 rating</em></div><div class="metric"><small>Governance participation</small><b>82%</b><em>6-month average</em></div></div>`,8)}${card('Communities',memberships(),4)}${card('Recent posts and missions',feedPosts(true),8)}${card('Privacy & local-first data',`<div class="briefing"><b>Device-encrypted cache:</b> enabled.<br><b>Shared public records:</b> only posts, votes and ledger entries you intentionally publish.<br><b>Recovery:</b> encrypted account backup configured.<br><br>Your phone can store an encrypted local copy, but shared governance records require replicated, available infrastructure so communities do not lose access when one device is offline.</div>`,4)}</div>`},
  settings(){return `${pageHead('Settings','Control language, privacy, security, JARVIS permissions and notifications.','')}<div class="dashboard-grid">${card('Privacy and data',settingsPrivacy(),6)}${card('JARVIS permissions',settingsJarvis(),6)}${card('Language and accessibility',settingsLanguage(),6)}${card('Security',settingsSecurity(),6)}</div>`},
  global(){return `${pageHead('Global Pulse','A verified, multi-source view of public issues, emergencies, markets and collective action.',`<button class="action-btn">Open full situation room</button>`)}<div class="dashboard-grid"><section class="card span-8"><div class="card-head"><div class="card-title">Global Situation Map</div><span class="tag green">SIMULATED LIVE DATA</span></div>${worldMap()}</section>${card('JARVIS Global Brief',`<div class="briefing">JARVIS separates <b>verified evidence</b>, <b>reported claims</b>, <b>community testimony</b> and <b>unverified content</b>. The platform does not promise uncensored truth from a single authority; it shows provenance, competing sources and confidence so people can reason before acting.</div>`,4)}${card('Global discussions',globalMini(true),6)}${card('Collective actions',`<div class="activity-list"><div class="activity-item"><div class="activity-icon">💧</div><div><b>Global clean-water design challenge</b><p>42,810 participants · 190 countries · 1,284 solutions</p></div></div><div class="activity-item"><div class="activity-icon">🌊</div><div><b>Emergency flood fund</b><p>₨8.2M raised · public receipts available</p></div></div></div>`,6)}</div>`}
};
function proposalMini(){const p=state.proposals[0];return `<h3 style="margin:0 0 5px">${p.title}</h3><p class="muted">${p.summary}</p><div class="progress"><span style="width:${p.turnout}%"></span></div><div class="meta-row"><span class="tag green">${p.turnout}% turnout</span><span class="tag gold">${p.deadline}</span><span class="tag">Budget ${money(p.budget)}</span></div><div class="rule-actions"><button class="mini-btn" data-action="explainWater">Ask JARVIS</button><button class="action-btn" data-vote="water">Vote now</button></div>`}
function treasuryMini(){return `<div class="wallet-balance"><div><small>Available community funds</small><strong>₨2.84M</strong></div><span class="tag green">AUDIT PASSED</span></div><div class="wallet-tabs"><button class="active">Balance</button><button>Projects</button><button>Ledger</button></div><div class="activity-list" style="margin-top:12px"><div class="activity-item"><div class="activity-icon">↓</div><div><b>₨286,500 received</b><p>Water project contributions · today</p></div></div><div class="activity-item"><div class="activity-icon">↑</div><div><b>₨175,000 released</b><p>Milestone 1 · receipt verified</p></div></div></div>`}
function activityMini(){return `<div class="activity-list"><div class="activity-item"><div class="activity-icon">💡</div><div><b>Street lighting evidence added</b><p>18 residents submitted photos · 11 min ago</p></div></div><div class="activity-item"><div class="activity-icon">🗳</div><div><b>Water vote crossed quorum</b><p>823 verified votes · 24 min ago</p></div></div><div class="activity-item"><div class="activity-icon">🎬</div><div><b>Video editor request near you</b><p>1.2 km · budget ₨12,000</p></div></div></div>`}
function globalMini(full=false){return `<div class="activity-list"><div class="activity-item"><div class="activity-icon">🌊</div><div><b>Flood response mission activated</b><p>Verified by three community hubs · relief wallet open</p><div class="meta-row"><span class="tag red">EMERGENCY</span><span class="tag green">VERIFIED</span></div></div></div><div class="activity-item"><div class="activity-icon">🌍</div><div><b>Global climate challenge: urban heat</b><p>${full?'18,440 teams submitted city cooling simulations.':'1,284 solutions submitted this week.'}</p></div></div><div class="activity-item"><div class="activity-icon">✓</div><div><b>Public evidence standard discussion</b><p>Global scope · 32 languages · 74% consensus</p></div></div></div>`}
function membersMini(){return `<div class="member-avatar-stack">${seed.members.slice(0,5).map(x=>`<span>${x[0]}</span>`).join('')}<span>+32</span></div><p class="muted">38 nearby members match your skills and interests.</p><button class="ghost-btn" data-view="communities">Explore people</button>`}
function scienceMini(){return `<h3 style="margin:0 0 5px">Urban flood simulation</h3><p class="muted">Design a low-cost drainage and alert system using real constraints.</p><div class="progress"><span style="width:48%"></span></div><div class="meta-row"><span class="tag">4,820 players</span><span class="tag gold">₨500K prize pool</span></div><button class="ghost-btn" style="margin-top:10px" data-view="science">Enter challenge</button>`}
function feedPosts(profile=false){const custom=state.posts.map(p=>postCard(p)).join('');return `${custom}${postCard({name:profile?state.user.name:'Sara Khan',initials:profile?'MQ':'SK',scope:'Society',time:'18 min ago',type:'Problem',text:'The waste collection point near Street 44 has remained blocked for three days. I uploaded location-tagged photos. Should we request a shared city service proposal?',media:'Location evidence · 6 photos'})}${postCard({name:'Islamabad AI Builders',initials:'AI',scope:'City',time:'1 hour ago',type:'Mission',text:'We are opening a weekend AI literacy lab. Volunteer mentors, refurbished laptops and curriculum reviewers are needed.',media:'Crew mission · 64% staffed'})}${postCard({name:'Global Water Challenge',initials:'GW',scope:'Global',time:'3 hours ago',type:'Science',text:'Can a solar filtration system serve 1,000 households for under $18,000? Submit a simulation, material list and maintenance plan.',media:'Humanity Lab · 1,284 submissions'})}`}
function postCard(p){const attachment=p.mediaUrl?(p.mediaType||'').startsWith('video')?`<video controls preload="metadata" src="${esc(p.mediaUrl)}"></video>`:`<img src="${esc(p.mediaUrl)}" alt="Post evidence">`:`${esc(p.media||'Public evidence attachment')}`;return `<article class="feed-post"><div class="post-head"><div class="avatar">${p.initials||'U'}</div><div><b>${esc(p.name)}</b><small>${esc(p.time)} · ${esc(p.type)}${p.location?' · '+esc(p.location):''}</small></div><span class="scope-badge">${esc(p.scope)}</span></div><div class="post-body">${esc(p.text)}</div><div class="post-media">${attachment}</div><div class="post-actions"><button>Discuss</button><button data-action="jarvis">Ask JARVIS</button><button data-action="proposal">Create proposal</button><button>Support</button><button>Share</button></div></article>`}
function communityCards(){const list=[...state.communities.map(x=>[x.initials||'NEW',x.name,`${x.location} · new community`,x.status||'Joined',x.level||'Society']),['JMN','Jamia Masjid Nabvi Qureshi Hashmi','G-11/4 · 1,284 members','Joined','Society'],['G11','G-11 Citizens Forum','G-11 Markaz · 842 members','Follow','Society'],['AI','Islamabad AI Builders','F-10 · 516 members','Pending','City'],['CR','Pakistan Creator Crew','National · 2,480 members','Join','Country']];return list.map((x,i)=>card(x[1],`<div class="activity-item"><div class="activity-icon">${x[0]}</div><div><b>${x[2]}</b><p>${x[4]} community · public rules and audit log</p><div class="meta-row"><span class="tag green">${x[3]}</span><span class="tag">${x[4]}</span></div></div></div><button class="ghost-btn" style="margin-top:10px;width:100%" data-community-open="${i}">Open community</button>`,4)).join('')}
function proposalCard(p){const voted=state.votes[p.id];return `<article class="proposal-item" style="display:block"><div style="display:flex;justify-content:space-between;gap:10px"><div><div class="meta-row"><span class="tag">${p.scope}</span><span class="tag ${p.status==='Voting'?'green':'gold'}">${p.status}</span></div><h3 style="margin:9px 0 5px">${p.title}</h3></div><span class="tag">${p.deadline}</span></div><p class="muted">${p.summary}</p><div class="metric-row"><div class="metric"><small>Budget</small><b>${money(p.budget)}</b></div><div class="metric"><small>Evidence</small><b>${p.evidence}</b></div><div class="metric"><small>AI risk review</small><b>${p.risk}</b></div></div>${p.status==='Voting'?`<div style="margin-top:12px"><div class="progress"><span style="width:${p.turnout}%"></span></div><div class="meta-row"><span class="tag green">Yes ${p.yes+(voted==='yes'?1:0)}</span><span class="tag red">No ${p.no+(voted==='no'?1:0)}</span><span class="tag">Turnout ${p.turnout}%</span></div><div class="rule-actions"><button class="mini-btn" data-action="explainWater">Explain with JARVIS</button><button class="action-btn" data-vote="${p.id}" data-choice="yes">${voted?'Vote recorded':'Vote yes'}</button><button class="ghost-btn" data-vote="${p.id}" data-choice="no">Vote no</button></div></div>`:`<div class="rule-actions"><button class="mini-btn">Open discussion</button><button class="mini-btn">View evidence</button></div>`}</article>`}
function rulesPanel(){return `<div class="rule-card"><h4>Community Constitution v1.2</h4><p>Rules were approved by 78% of eligible members. Amendments require seven days of discussion, 60% quorum and two-thirds approval.</p><div class="rule-actions"><button class="mini-btn" data-action="rules">View rules</button><button class="mini-btn" data-action="ruleProposal">Propose amendment</button></div></div><div class="rule-card" style="margin-top:10px"><h4>JARVIS rule assistant</h4><p>Members describe the change in ordinary language. JARVIS drafts clear clauses, checks conflicts and shows likely consequences before a vote.</p><button class="mini-btn" style="margin-top:10px" data-action="jarvis">Ask about rules</button></div><div class="rule-card" style="margin-top:10px"><h4>Current decision rules</h4><p>One verified member, one vote. Financial releases require an approved proposal, responsible committee role, public receipt and milestone proof.</p></div>`}
function projectCards(){const ps=[...state.projects.map(x=>[x.name,'0%',money(x.budget||0),'New project',x.milestones||'Milestones awaiting evidence']),['Clean-water filtration unit','62%','₨1.85M','Milestone 2 of 3','Vendor installation in progress'],['Youth AI learning lab','41%','₨690K','Equipment purchased','Curriculum and mentor onboarding'],['Street lighting pilot','92%','₨420K','Final verification','28 of 31 lights complete']];return ps.map((p,i)=>card(p[0],`<span class="tag ${i===ps.length-1?'green':'gold'}">${p[3]}</span><h2 style="margin:12px 0 4px">${p[1]}</h2><div class="progress"><span style="width:${p[1]}"></span></div><p class="muted">${p[4]}</p><div class="meta-row"><span class="tag">Budget ${p[2]}</span><span class="tag green">Receipts public</span></div><button class="ghost-btn" style="margin-top:10px" data-project-proof="${i}">Open project proof</button>`,4)).join('')}
function walletPersonal(){
  if (state.user && !state.user.ethAddr) {
    const hash = Math.abs((state.user.name||'Guest').split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)).toString(16);
    state.user.ethAddr = '0x' + (hash + '71C7656EC7ab88b098defB751B7401B5f6d8976F').slice(0, 40);
    save();
  }
  const addr = state.user ? state.user.ethAddr : '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
  return `<div class="wallet-balance">
    <div><small>Personal Blockchain Wallet (EVM L2)</small>
      <div class="mono" style="font-size:11px;color:var(--cyan);margin-top:2px">${addr}</div>
      <strong>₨84,650</strong>
    </div>
    <span class="tag green">VERIFIED ID</span>
  </div>
  <div class="wallet-tabs"><button class="active">PKR</button><button>Crypto (Polygon)</button><button>Rewards</button></div>
  <div class="metric-row" style="margin-top:14px">
    <div class="metric"><small>NDC Tokens</small><b>1,250 NDC</b></div>
    <div class="metric"><small>NDS Shares</small><b>250 NDS</b></div>
    <div class="metric"><small>MATIC Testnet</small><b>4.20 MATIC</b></div>
  </div>
  <div class="rule-actions" style="margin-top:12px">
    <button class="action-btn" data-action="addFunds">Add Funds</button>
    <button class="ghost-btn" onclick="requestLiveLocation()">📍 Update GPS Location</button>
  </div>`;
}
function walletCommunity(){return `<div class="wallet-balance"><div><small>Public treasury balance</small><strong>₨2.84M</strong></div><span class="tag green">CHAIN VERIFIED</span></div><div class="metric-row" style="margin-top:14px"><div class="metric"><small>Available</small><b>₨1.12M</b></div><div class="metric"><small>Reserved</small><b>₨1.42M</b></div><div class="metric"><small>Emergency</small><b>₨300K</b></div></div><p class="muted">No single admin can mark a project payment complete without the approved proposal, required role, receipt and milestone evidence.</p>`}
function transactionTable(emergency=false){const tx=(emergency?state.transactions.slice(0,3):state.transactions);return `<div class="transaction-list">${tx.map(t=>`<div class="transaction-item"><div class="activity-icon">${t.amount>0?'↓':'↑'}</div><div style="flex:1"><b>${t.desc}</b><p class="muted" style="margin:4px 0 0">${t.date} · ${t.proof}</p></div><b style="color:${t.amount>0?'var(--green)':'var(--text)'}">${t.amount>0?'+':''}${money(t.amount)}</b></div>`).join('')}</div><button class="ghost-btn" style="margin-top:10px" data-action="verifyChain">Verify public chain</button>`}
function fundControls(){return `<div class="rule-card"><h4>Milestone release</h4><p>Funds are reserved after approval and released only when required proof is accepted.</p></div><div class="rule-card" style="margin-top:10px"><h4>Role separation</h4><p>Proposal creator, verifier and fund recorder cannot be the same person for high-value projects.</p></div><div class="rule-card" style="margin-top:10px"><h4>Public dispute</h4><p>Members can flag an entry, attach evidence and trigger a review without deleting the original record.</p></div>`}
function serviceCard(s){return `<article class="service-item"><div class="activity-icon">${s.icon||'↗'}</div><div><div style="display:flex;justify-content:space-between"><b>${esc(s.title)}</b><span class="tag">${esc(s.tag||'Service')}</span></div><p>${esc(s.meta)} · posted by ${esc(s.person)}</p><div class="rule-actions"><button class="mini-btn" data-service-view="${esc(s.title)}">View request</button><button class="action-btn" data-action="offer">Send offer</button></div></div></article>`}
function providerProfile(){return `<div class="profile-copy"><h2>${esc(state.user.name)}</h2><p>${esc(state.user.skills)}</p></div><div class="metric-row"><div class="metric"><small>Rating</small><b>4.9</b></div><div class="metric"><small>Completed</small><b>7</b></div><div class="metric"><small>Response</small><b>94%</b></div></div><button class="ghost-btn" style="margin-top:12px" data-action="editProfile">Edit skills and rates</button>`}
function scienceCards(){const list=[...state.challenges.map(x=>[x.title,x.goal,'New challenge',money(x.reward||0),'0%']),['Urban Flood Simulation','Design drainage, sensor and evacuation strategies using real city constraints.','4,820 players','₨500K rewards','48%'],['Affordable Water Filtration','Build and test filtration designs for 1,000 households.','8,140 players','Scientist review','72%'],['Lunar Habitat Systems','Balance energy, food, oxygen and human wellbeing in a lunar base.','12,400 players','Global mission','31%']];return list.map((x,i)=>card(x[0],`<div class="post-media" style="height:145px;border-radius:9px;border:1px solid var(--line)">Interactive simulation preview</div><p class="muted">${x[1]}</p><div class="progress"><span style="width:${x[4]}"></span></div><div class="meta-row"><span class="tag">${x[2]}</span><span class="tag gold">${x[3]}</span></div><button class="action-btn" style="margin-top:10px" data-challenge-enter="${i}">Enter challenge</button>`,4)).join('')}
function crewCards(){const list=[['Engineering','18 members','Frontend, backend, AI, security and distributed systems.'],['Creators','42 members','Documentaries, explainers, community education and product storytelling.'],['Research & Policy','24 members','Governance design, economics, law, ethics and impact evaluation.'],['Community Hubs','31 members','On-ground onboarding, verification, moderation and pilot operations.']];return list.map((x,i)=>card(x[0],`<div class="activity-icon" style="width:50px;height:50px;font-size:16px">${['EN','CR','RP','CH'][i]}</div><h3>${x[1]}</h3><p class="muted">${x[2]}</p><button class="ghost-btn">View crew</button>`,4)).join('')}
function memberships(){return `<div class="activity-list"><div class="activity-item"><div class="activity-icon">JMN</div><div><b>${state.community}</b><p>Approved member · governance participation 82%</p></div></div><div class="activity-item"><div class="activity-icon">AI</div><div><b>Islamabad AI Builders</b><p>Join request pending</p></div></div></div>`}
function settingsPrivacy(){return `<div class="activity-list">${[['Location for nearby suggestions',true],['Public skill profile',true],['Show exact home location',false],['Encrypted device cache',true],['Anonymous analytics',false]].map(x=>`<label class="activity-item"><input type="checkbox" ${x[1]?'checked':''}><div><b>${x[0]}</b><p>You can change this at any time.</p></div></label>`).join('')}</div>`}
function settingsJarvis(){return `<div class="activity-list">${[['Use joined communities',true],['Use skills and interests',true],['Read wallet ledger',true],['Draft actions without publishing',true],['Move funds or vote',false]].map(x=>`<label class="activity-item"><input type="checkbox" ${x[1]?'checked':''} ${x[0]==='Move funds or vote'?'disabled':''}><div><b>${x[0]}</b><p>${x[0]==='Move funds or vote'?'Always disabled by governance design.':'Permission-controlled context.'}</p></div></label>`).join('')}</div>`}
function settingsLanguage(){return `<div class="form-grid"><label>Interface language<select><option>English</option><option>Urdu</option><option>Hindi</option><option>Arabic</option></select></label><label>JARVIS response style<select><option>Simple and concise</option><option>Detailed research</option><option>Voice-first accessibility</option></select></label><label><input type="checkbox" checked> Right-to-left interface when using Urdu or Arabic</label></div>`}
function settingsSecurity(){return `<div class="activity-list"><div class="activity-item"><div class="activity-icon">2F</div><div><b>Two-step verification</b><p>Phone OTP enabled. Passkeys planned for production.</p></div></div><div class="activity-item"><div class="activity-icon">BK</div><div><b>Encrypted recovery backup</b><p>Last backup: today, 08:42</p></div></div><div class="activity-item"><div class="activity-icon">DV</div><div><b>Active devices</b><p>2 trusted devices · review sessions</p></div></div></div>`}
function bindDynamic(){
  $$('[data-view]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));
  $$('[data-action]').forEach(b=>b.addEventListener('click',()=>action(b.dataset.action)));
  $$('[data-vote]').forEach(b=>b.addEventListener('click',()=>vote(b.dataset.vote,b.dataset.choice||'yes')));
  $$('[data-community-open]').forEach(b=>b.addEventListener('click',()=>openModal('<h2>Community workspace</h2><p class="muted">Membership, public rules, discussions, proposals, treasury and audit history are connected here.</p><button class="action-btn" data-modal-close>Open dashboard</button>')));
  $$('[data-project-proof]').forEach(b=>b.addEventListener('click',()=>openModal('<h2>Project proof record</h2><div class="rule-card"><p><b>Status:</b> Evidence available</p><p><b>Controls:</b> approved proposal, milestone owner, receipt and verifier are linked.</p><span class="tag green">LOCAL HASH VERIFIED</span></div>')));
  $$('[data-service-view]').forEach(b=>b.addEventListener('click',()=>openModal(`<h2>${esc(b.dataset.serviceView)}</h2><p class="muted">Review scope, provider reputation, budget and delivery evidence before sending an offer.</p><button class="action-btn" data-modal-action="offer">Send offer</button>`)));
  $$('[data-challenge-enter]').forEach(b=>b.addEventListener('click',()=>window.GAIGSHumanityLab?window.GAIGSHumanityLab.open(b.dataset.challengeEnter):openModal('<h2>Challenge workspace unavailable</h2><p class="muted">The simulation module did not load. No progress was recorded.</p>')));
  $$('.filter-btn').forEach(b=>b.addEventListener('click',()=>{$$('.filter-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');toast(`${b.textContent.trim()} feed loaded.`)}));
  $$('#mainContent input[type="checkbox"]').forEach((b,i)=>b.addEventListener('change',()=>{state.settings['toggle'+i]=b.checked;save();toast('Preference saved on this device.')}));
  $$('#mainContent select').forEach((b,i)=>b.addEventListener('change',()=>{state.settings['select'+i]=b.value;save();toast(`${b.value} preference saved.`)}));
  $$('#mainContent button').filter(b=>!b.dataset.view&&!b.dataset.action&&!b.dataset.vote&&!b.dataset.communityOpen&&!b.dataset.projectProof&&!b.dataset.serviceView&&!b.dataset.challengeEnter&&!Object.keys(b.dataset).some(k=>['social','admin','member','report'].some(prefix=>k.startsWith(prefix)))&&!b.classList.contains('filter-btn')).forEach(b=>b.addEventListener('click',()=>{
    const label=b.textContent.trim();
    if(label.includes('Register a community'))return action('community');
    if(label.includes('Ask JARVIS'))return action('jarvis');
    if(label.includes('Open discussion'))return openModal('<h2>Public discussion</h2><p class="muted">Arguments, evidence, questions and amendments are preserved before the decision moves to voting.</p><button class="action-btn" data-modal-action="proposal">Draft related proposal</button>');
    if(label.includes('evidence')||label.includes('proof'))return openModal('<h2>Evidence inspector</h2><p class="muted">Location, author, timestamp, receipt and verifier status are shown here. Original records are never overwritten.</p><span class="tag green">INTEGRITY CHECK PASSED</span>');
    if(label==='Balance')return toast('Available, reserved and emergency balances displayed.');
    if(label==='Projects')return navigate('projects');
    if(label==='Ledger')return navigate('treasury');
    if(label==='⋯')return openModal('<h2>Card options</h2><p class="muted">Share, export and inspect this record without changing its source data.</p>');
    toast(`${label||'Action'} completed in the local-first workspace.`);
  }));
}
function navigate(view){state.view=view;save();render();window.scrollTo({top:0,behavior:'smooth'});$('#sidebar').classList.remove('open')}
function vote(id,choice){
  if (state.votes[id]) {
    toast('Your verified vote is already recorded in this demo.');
    return;
  }
  state.votes[id] = choice;
  save();
  
  if (useFirebase) {
    const propRef = fbDb.collection('proposals').doc(id);
    fbDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(propRef);
      if (doc.exists) {
        const data = doc.data();
        let yesList = data.yesVotesList || [];
        let noList = data.noVotesList || [];
        let vetoList = data.vetoVotesList || [];
        
        yesList = yesList.filter(x => x !== state.user.name);
        noList = noList.filter(x => x !== state.user.name);
        vetoList = vetoList.filter(x => x !== state.user.name);
        
        if (choice === 'yes') yesList.push(state.user.name);
        else if (choice === 'no') noList.push(state.user.name);
        else if (choice === 'veto') vetoList.push(state.user.name);
        
        const y = yesList.length;
        const n = noList.length;
        const v = vetoList.length;
        const tot = y + n + v;
        let status = data.status || 'Voting';
        if (tot >= 4) {
          if (v / tot >= 0.33) status = 'Vetoed';
          else if (y > n) status = 'Passed';
          else status = 'Rejected';
        }
        
        transaction.update(propRef, {
          yesVotesList: yesList,
          noVotesList: noList,
          vetoVotesList: vetoList,
          status: status
        });
      }
    }).then(() => {
      toast('Vote recorded on blockchain ledger (simulated L2)!');
    }).catch(err => {
      console.error(err);
      toast('Vote broadcast failed.');
    });
    return;
  }
  
  toast(`Vote ${choice.toUpperCase()} recorded in the tamper-evident demo log.`);
  render();
}
function action(type){
  if(type==='jarvis'||type==='explainWater'){$('#jarvisPanel').classList.add('open');addAI('I can explain the proposal, compare options, identify missing evidence and show the public ledger. I cannot vote or move funds for you.');return}
  const templates={
    create:['Create an action','Choose what you want to create.','<div class="rule-actions"><button class="action-btn" data-modal-action="post">Post or problem</button><button class="action-btn" data-modal-action="proposal">Proposal</button><button class="action-btn" data-modal-action="service">Service</button><button class="action-btn" data-modal-action="company">Company</button></div>'],
    post:['Create a purposeful post','Publish to the correct geographic scope.',postForm()],
    proposal:['Create a governance proposal','JARVIS will help structure the issue, evidence, cost and decision rules.',proposalForm()],
    service:['Offer a local service','Create a discoverable skill and service listing.',serviceForm()],
    company:['Register a company','Publish a verified organization profile, skills and hiring needs.',companyForm()],
    offer:['Send an offer','This is a simulated marketplace flow.',offerForm()],
    addFunds:['Add demo funds','No real payment will occur.',fundForm()],
    community:['Register a community','Create a public community identity and choose its governance level.',communityForm()],
    project:['Start an approved project','Projects should normally be created from an approved proposal.',projectForm()],
    emergency:['Create Verified Emergency Alert','Broadcast an urgent disaster report to local & global response teams.',emergencyForm()],
    challenge:['Submit Scientific Challenge','Propose a simulation model or research challenge to the Humanity Lab.',challengeForm()],
    crewApply:['Apply to Founding Crew','Join as an engineer, creator, researcher, or community hub lead.',crewApplyForm()],
    editProfile:['Edit Personal Profile','Update your skills, location, and bio.',editProfileForm()],
    verifyChain:['Blockchain Integrity Inspector','Verify SHA-256 Merkle Hash Chain state on Layer-2.',verifyChainModal()],
    investor:['Investor Demo Mode','Explore the whole platform with guided scenarios and simulated data.',`<div class="briefing">Use the scope switcher to move from personal to society, city, country and global dashboards. Try signup, a community vote, the transparent ledger, service matching, emergency response and the Humanity Lab.</div><button class="action-btn" style="margin-top:12px" data-modal-close>Start guided tour</button>`],
    rules:['Community Constitution','Rules are public, versioned and voted on.',`<div class="rule-card"><h4>Membership</h4><p>Verified local members may participate after admin approval. Rejection requires a recorded reason and appeal path.</p></div><div class="rule-card" style="margin-top:8px"><h4>Voting</h4><p>One member, one vote. Standard proposals require 40% quorum and simple majority. Constitutional amendments require 60% quorum and two-thirds approval.</p></div><div class="rule-card" style="margin-top:8px"><h4>Funds</h4><p>No payment is treated as complete without an approved purpose, receipt, responsible role and milestone proof.</p></div>`],
    ruleProposal:['Propose a rule amendment','Describe the change. JARVIS can turn it into clear language before discussion.',proposalForm('Rule amendment')]
  };
  const t=templates[type]||templates.create;openModal(`<h2>${t[0]}</h2><p class="muted">${t[1]}</p>${t[2]}`)
}
function openModal(html){$('#modalContent').innerHTML=html;$('#actionModal').classList.add('open');bindModal()}
function closeModal(){$('#actionModal').classList.remove('open')}
function bindModal(){
  $$('[data-modal-close],.modal-close,.modal-backdrop').forEach(x=>x.addEventListener('click',closeModal));
  $$('[data-modal-action]').forEach(x=>x.addEventListener('click',()=>{closeModal();action(x.dataset.modalAction)}));
  const pf=$('#postCreateForm');if(pf)pf.addEventListener('submit',async e=>{
    e.preventDefault();
    const scope = $('#postScope').value;
    const type = $('#postType').value;
    const text = $('#postText').value;
    const location = $('#postLocation').value.trim();
    const mediaFile = $('#postMedia').files[0];
    if (useFirebase) {
      fbDb.collection('posts').add({
        name: state.user.name,
        initials: 'MQ',
        scope,
        time: 'Just now',
        type,
        text,
        media: mediaFile ? mediaFile.name : 'No media',
        location,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        closeModal();
        toast('Post published successfully to ' + scope + '!');
      });
      return;
    }
    let mediaUrl='',mediaType='';
    if(mediaFile){mediaType=mediaFile.type;mediaUrl=URL.createObjectURL(mediaFile)}
    state.posts.unshift({name:state.user.name,initials:'MQ',scope,time:'Just now',type,text,location,media:mediaFile?mediaFile.name:'No media attached',mediaUrl,mediaType});
    save();closeModal();toast('Post published to the selected scope.');navigate('feed')
  });
  const prop=$('#proposalCreateForm');if(prop)prop.addEventListener('submit',e=>{
    e.preventDefault();
    const title = $('#proposalTitle').value;
    const scope = $('#proposalScope').value;
    const budget = Number($('#proposalBudget').value||0);
    const description = $('#proposalBody').value;
    if (useFirebase) {
      fbDb.collection('proposals').add({
        title,
        scope,
        status: 'Voting',
        yesVotesList: [],
        noVotesList: [],
        vetoVotesList: [],
        budget,
        description,
        risk: 'Low',
        evidence: 1,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        closeModal();
        toast('Proposal published successfully to G.A.I.G.S.!');
      });
      return;
    }
    state.proposals.unshift({id:'p'+Date.now(),title,scope,status:'Discussion',deadline:'Discussion open for 3 days',yes:0,no:0,turnout:0,budget,summary:description,risk:'Pending AI review',evidence:0});
    save();closeModal();toast('Proposal opened for structured discussion.');navigate('governance')
  });
  const ff=$('#fundForm');if(ff)ff.addEventListener('submit',e=>{
    e.preventDefault();
    const amt=Number($('#fundAmount').value||0);
    if (useFirebase) {
      fbDb.collection('transactions').add({
        date: 'Today',
        type: 'Incoming',
        desc: 'Personal demo wallet top-up',
        amount: amt,
        proof: 'Verified',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        closeModal();
        toast(`${money(amt)} added to live ledger.`);
      });
      return;
    }
    state.transactions.unshift({date:'Today',type:'Incoming',desc:'Personal demo wallet top-up',amount:amt,proof:'Demo only'});
    save();closeModal();toast(`${money(amt)} added to demo wallet.`);navigate('treasury')
  });
  const sf=$('#serviceCreateForm');if(sf)sf.addEventListener('submit',e=>{e.preventDefault();state.services.unshift({title:$('#serviceTitle').value,meta:$('#serviceCoverage').value+' · '+$('#serviceRate').value,person:state.user.name,tag:'New',icon:'↗'});save();closeModal();toast('Service published and available in the market.');navigate('services')});
  const cof=$('#companyCreateForm');if(cof)cof.addEventListener('submit',e=>{e.preventDefault();state.companies.unshift({name:$('#companyName').value,registration:$('#companyRegistration').value,location:$('#companyLocation').value,skills:$('#companySkills').value,owner:state.user.name,status:'Pending verification'});state.posts.unshift({name:$('#companyName').value,initials:$('#companyName').value.slice(0,2).toUpperCase(),scope:$('#companyScope').value,time:'Just now',type:'Company update',text:'Company registered. Skills and hiring needs: '+$('#companySkills').value,location:$('#companyLocation').value,media:'Organization verification pending'});save();closeModal();toast('Company registered; verification review opened.');navigate('feed')});
  const of=$('#offerCreateForm');if(of)of.addEventListener('submit',e=>{e.preventDefault();state.transactions.unshift({date:'Today',type:'Reserved',desc:'Marketplace offer escrow reservation',amount:-Number($('#offerAmount').value||0),proof:'Awaiting acceptance'});save();closeModal();toast('Offer sent. Funds will move only after acceptance and milestone proof.');navigate('services')});
  const cf=$('#communityCreateForm');if(cf)cf.addEventListener('submit',e=>{e.preventDefault();const name=$('#communityName').value;state.communities.unshift({name,initials:name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(),level:$('#communityLevel').value.split(' /')[0],location:$('#communityLocation').value,status:'Joined'});save();closeModal();toast('Community created with a public rules and audit workspace.');navigate('communities')});
  const prf=$('#projectCreateForm');if(prf)prf.addEventListener('submit',e=>{e.preventDefault();state.projects.unshift({proposalId:$('#projectProposal').value,name:$('#projectName').value,milestones:$('#projectMilestones').value,team:$('#projectTeam').value,budget:0});save();closeModal();toast('Project record created and linked to its approved proposal.');navigate('projects')});
  const ef=$('#emergencyCreateForm');if(ef)ef.addEventListener('submit',e=>{e.preventDefault();state.transactions.unshift({date:'Today',type:'Emergency',desc:$('#emergencyName').value+' relief wallet opened',amount:Number($('#emergencyBudget').value||0),proof:'Alert awaiting field verification'});save();closeModal();toast('Emergency alert broadcast and transparent relief ledger opened.');navigate('emergency')});
  const chf=$('#challengeCreateForm');if(chf)chf.addEventListener('submit',e=>{e.preventDefault();state.challenges.unshift({title:$('#challengeTitle').value,goal:$('#challengeGoal').value,reward:Number($('#challengeReward').value||0)});save();closeModal();toast('Humanity Lab challenge published.');navigate('science')});
  const caf=$('#crewApplyForm');if(caf)caf.addEventListener('submit',e=>{e.preventDefault();state.applications.unshift({track:$('#crewTrack').value,expertise:$('#crewExpertise').value,status:'Submitted',date:'Today'});save();closeModal();toast('Crew application submitted and saved.');navigate('crew')});
  const epf=$('#editProfileForm');if(epf)epf.addEventListener('submit',e=>{e.preventDefault();state.user.name=$('#profileName').value;state.user.city=$('#profileCity').value;state.user.country=$('#profileCountry').value;state.user.skills=$('#profileSkills').value;save();closeModal();toast('Profile updated. JARVIS matching refreshed.');render()});
}
function postForm(){return `<form id="postCreateForm" class="form-grid"><label>Post type<select id="postType"><option>Problem</option><option>Discussion</option><option>Evidence</option><option>Project update</option><option>Learning</option><option>Skill needed</option><option>Company update</option></select></label><label>Who should receive it?<select id="postScope"><option>Society</option><option>City</option><option>Country</option><option>Global</option></select></label><label>Location / society<input id="postLocation" value="${esc((state.user.city||'')+' · '+state.community)}" required></label><label class="consent"><input id="postApproxLocation" type="checkbox"> Add an approximate map pin (about 100 m precision). Never attach my exact device coordinates.</label><label>Message<textarea id="postText" required placeholder="Describe the issue, evidence or idea..."></textarea></label><label>Photo or video evidence<input id="postMedia" type="file" accept="image/*,video/*"></label><button class="primary" type="submit">Publish responsibly</button></form>`}
function proposalForm(prefix=''){return `<form id="proposalCreateForm" class="form-grid"><label>Proposal title<input id="proposalTitle" value="${prefix}" required></label><label>Decision scope<select id="proposalScope"><option>Society</option><option>City</option><option>Country</option><option>Global</option></select></label><label>Problem, proposed solution and success measure<textarea id="proposalBody" required></textarea></label><label>Estimated demo budget<input id="proposalBudget" type="number" value="250000"></label><button class="primary" type="submit">Open discussion</button></form>`}
function serviceForm(){return `<form id="serviceCreateForm" class="form-grid"><label>Skill or service<input id="serviceTitle" required value="AI workflow consulting"></label><label>Coverage<select id="serviceCoverage"><option>Within 5 km</option><option>My city</option><option>Remote/global</option></select></label><label>Rate or offer<input id="serviceRate" value="₨5,000 per session"></label><label>Description<textarea></textarea></label><button class="primary">Publish service</button></form>`}
function companyForm(){return `<form id="companyCreateForm" class="form-grid"><label>Company name<input id="companyName" required></label><label>Registration / NTN reference<input id="companyRegistration" required></label><label>Location<input id="companyLocation" value="${esc(state.user.city||'Islamabad')}" required></label><label>Skills, services and hiring needs<textarea id="companySkills" required></textarea></label><label>Distribution scope<select id="companyScope"><option>City</option><option>Country</option><option>Global</option></select></label><button class="primary">Register company</button></form>`}
function offerForm(){return `<form id="offerCreateForm" class="form-grid"><label>Your offer (PKR)<input id="offerAmount" type="number" value="10500"></label><label>Delivery time<input value="2 days"></label><label>Message<textarea>I'll provide two edited versions, captions and source files.</textarea></label><button class="primary">Send demo offer</button></form>`}
function fundForm(){return `<form id="fundForm" class="form-grid"><div class="demo-banner">Demo funds only - no payment gateway or cryptocurrency is connected.</div><label>Amount<input id="fundAmount" type="number" value="10000"></label><label>Source<select><option>Demo bank balance</option><option>Demo crypto wallet</option><option>Impact rewards</option></select></label><button class="primary">Add demo funds</button></form>`}
function communityForm(){return `<form id="communityCreateForm" class="form-grid"><label>Community name<input id="communityName" required></label><label>Level<select id="communityLevel"><option>Society / neighborhood</option><option>City network</option><option>Country network</option><option>Global mission</option></select></label><label>Location<input id="communityLocation" value="${esc(state.user?.city||'')}"></label><label>Community purpose<textarea></textarea></label><label class="consent"><input id="communityShareCenter" type="checkbox"> Publish my current device coordinate as the community center. Use this only while physically at the public center, never at a private home.</label><button class="primary">Register community workspace</button></form>`}
function projectForm(){return `<form id="projectCreateForm" class="form-grid"><label>Approved proposal ID<input id="projectProposal" required></label><label>Project name<input id="projectName" required></label><label>Milestones<textarea id="projectMilestones" placeholder="Milestone 1...\nMilestone 2..."></textarea></label><label>Responsible team<input id="projectTeam"></label><button class="primary">Create project record</button></form>`}
function emergencyForm() {
  return `<form id="emergencyCreateForm" class="form-grid">
    <label>Incident Name<input id="emergencyName" required value="Flood Alert Zone 4"></label>
    <label>Severity<select><option>HIGH PRIORITY</option><option>CRITICAL</option><option>MODERATE</option></select></label>
    <label>Location<input value="Nowshera / Peshawar Corridor"></label>
    <label>Required Relief Budget (₨)<input id="emergencyBudget" type="number" value="1500000"></label>
    <label>Description & Evidence<textarea required>Submerged roads, emergency drinking water and medical tents needed.</textarea></label>
    <button class="primary" type="submit">Broadcast Alert</button>
  </form>`;
}
function challengeForm() {
  return `<form id="challengeCreateForm" class="form-grid">
    <label>Challenge Title<input id="challengeTitle" required value="Solar Microgrid Distribution Simulator"></label>
    <label>Domain<select><option>Energy Systems</option><option>Water Filtration</option><option>Urban Planning</option><option>Climate Adaptation</option></select></label>
    <label>Reward Pool (₨)<input id="challengeReward" type="number" value="750000"></label>
    <label>Simulation Goal & Rules<textarea id="challengeGoal" required>Design an optimal power distribution layout for 500 households with 99% uptime.</textarea></label>
    <button class="primary" type="submit">Publish Challenge</button>
  </form>`;
}
function crewApplyForm() {
  return `<form id="crewApplyForm" class="form-grid">
    <label>Track<select id="crewTrack"><option>Engineering</option><option>Creators & Media</option><option>Research & Policy</option><option>Community Hubs</option></select></label>
    <label>Your Expertise / Portfolio Link<textarea id="crewExpertise" required>AI engineering, React Native, Rust smart contracts</textarea></label>
    <button class="primary" type="submit">Submit Crew Application</button>
  </form>`;
}
function editProfileForm() {
  return `<form id="editProfileForm" class="form-grid">
    <label>Full Name<input id="profileName" required value="${esc(state.user.name)}"></label>
    <label>City<input id="profileCity" required value="${esc(state.user.city)}"></label>
    <label>Country<input id="profileCountry" required value="${esc(state.user.country)}"></label>
    <label>Skills (comma separated)<input id="profileSkills" required value="${esc(state.user.skills)}"></label>
    <button class="primary" type="submit">Save Profile Changes</button>
  </form>`;
}
function verifyChainModal() {
  const records = state.transactions || [];
  const anchored = records.filter(item=>item.blockchainTxHash);
  return `<div class="rule-card">
    <h4>Ledger integrity status</h4>
    <p><b>Local entries inspected:</b> ${records.length}</p>
    <p><b>Confirmed blockchain anchors:</b> ${anchored.length}</p>
    <p>${anchored.length?'Open each settlement receipt to confirm its network, block and transaction hash.':'No confirmed blockchain anchor is present in this workspace. Local or cloud ledger records must not be described as on-chain.'}</p>
    <div class="meta-row" style="margin-top:10px">
      <span class="tag ${anchored.length?'green':'gold'}">${anchored.length?'ANCHOR RECEIPTS PRESENT':'UNANCHORED'}</span>
      <span class="tag">${useFirebase?'SHARED DATA':'PREVIEW DATA'}</span>
    </div>
    <button class="action-btn" style="width:100%;margin-top:12px" data-modal-close>Close inspector</button>
  </div>`;
}
function addAI(text){const div=document.createElement('div');div.className='ai-msg';div.textContent=text;$('#jarvisChat').appendChild(div);$('#jarvisChat').scrollTop=$('#jarvisChat').scrollHeight}
var JARVIS_SYS='You are JARVIS, the AI assistant inside G.A.I.G.S. (Global AI Governance System) by Muhammad Qureshi — a people-owned civic platform: societies govern themselves by vote, transparent treasuries, open ledgers, AI that informs but NEVER decides (you cannot vote or move funds). Answer in the user\'s language (English/Roman-Urdu). Be concrete, concise, help explain proposals, evidence, funds, services and rules. Never invent facts.';
function _jarvisMock(){return 'JARVIS is in preview assistance mode. I can navigate and prepare a draft, while shared facts require a verified account. I cannot vote, approve, publish or move funds.';}
function jarvisSpeak(text){try{if(!('speechSynthesis'in window))return;window.speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(text.slice(0,600));u.rate=1.02;u.pitch=1;window.speechSynthesis.speak(u);}catch(e){}}
function jarvisContextLine(){try{var u=(state&&state.user)?state.user:{};return 'User: '+(u.name||'guest')+', city '+(u.city||'?')+', skills '+(u.skills||'?')+'. Current view: '+(typeof getScopeLabel==='function'?getScopeLabel():'')+'. Active water proposal: ₨1.85M, 64% turnout, 1 missing warranty. Treasury ₨2.84M (₨1.42M reserved).';}catch(e){return '';}}
function askJarvis(prompt){
  var u=document.createElement('div');u.className='user-msg';u.textContent=prompt;$('#jarvisChat').appendChild(u);
  var t=document.createElement('div');t.className='ai-msg';t.textContent='…';$('#jarvisChat').appendChild(t);$('#jarvisChat').scrollTop=$('#jarvisChat').scrollHeight;
  
  const useFn = !location.hostname.includes('localhost') && location.protocol !== 'file:';
  
  if (useFn) {
    fetch('/.netlify/functions/jarvis',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({system_instruction:{parts:[{text:JARVIS_SYS+'\n\n[CONTEXT] '+jarvisContextLine()}]},contents:[{role:'user',parts:[{text:prompt}]}],gaigs:{uid:(state.user.uid||state.user.email||'demo-user'),scope:state.scope,context:{city:state.user.city,country:state.user.country,community:state.community,skills:state.user.skills,view:state.view}}})})
      .then(function(r){return r.json()}).then(function(j){
        var a=(j.candidates&&j.candidates[0].content.parts.map(function(p){return p.text||''}).join(''))||_jarvisMock(prompt);
        t.textContent=a;$('#jarvisChat').scrollTop=$('#jarvisChat').scrollHeight;jarvisSpeak(a);
      }).catch(function(){var r=_jarvisMock(prompt);t.textContent=r;jarvisSpeak(r);});
  } else {
    var r=_jarvisMock(prompt);t.textContent=r;jarvisSpeak(r);
  }
}
// Voice input (browser speech recognition) — the mic button makes JARVIS listen.
(function(){var SR=window.SpeechRecognition||window.webkitSpeechRecognition;var btn=document.getElementById('voiceBtn');if(!btn)return;var nativeSpeech=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.JarvisSpeech;
  if(nativeSpeech){btn.addEventListener('click',async function(){try{window.speechSynthesis&&window.speechSynthesis.cancel();btn.textContent='●';var result=await nativeSpeech.start({language:navigator.language||'en-US'}),i=document.getElementById('jarvisInput');if(i)i.value=result.text||'';if(result.text)askJarvis(result.text);}catch(e){toast(e.message||'Voice recognition is unavailable.');}finally{btn.textContent='🎙';}});return;}
  if(!SR){btn.addEventListener('click',function(){var i=document.getElementById('jarvisInput');if(i)i.focus();toast('Voice recognition is unavailable; type your request.');});return;}
  var rec=new SR();rec.lang='en-US';rec.interimResults=false;var listening=false;
  btn.addEventListener('click',function(){try{if(listening){rec.stop();return;}window.speechSynthesis&&window.speechSynthesis.cancel();rec.start();listening=true;btn.textContent='🔴';}catch(e){}});
  rec.onresult=function(e){var txt=e.results[0][0].transcript;var i=document.getElementById('jarvisInput');if(i)i.value=txt;askJarvis(txt);};
  rec.onend=function(){listening=false;btn.textContent='🎙';};
  rec.onerror=function(){listening=false;btn.textContent='🎙';};
})();
$$('[data-auth-tab]').forEach(b=>b.addEventListener('click',()=>{$$('[data-auth-tab]').forEach(x=>x.classList.toggle('active',x===b));$$('.auth-form').forEach(x=>x.classList.remove('active'));$('#'+b.dataset.authTab+'Form').classList.add('active')}));
$('#signupForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const email=$('#signupEmail').value.trim(), password=$('#signupPassword').value, cnic=$('#signupCnic').value.replace(/\D/g,'');
  if(cnic.length!==13){toast('CNIC must contain exactly 13 digits.');return}
  if(firebaseAvailable && window.NDCONF.firebaseProductionMode===true){
    try{
      const cred=await fbAuth.createUserWithEmailAndPassword(email,password);
      await cred.user.sendEmailVerification();
      await fbDb.collection('users').doc(cred.user.uid).set({email,phone:$('#signupPhone').value.trim(),cnicLast4:cnic.slice(-4),country:$('#signupCountry').value,city:$('#signupCity').value,kycStatus:'pending',roles:['member'],createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      await fbDb.collection('publicProfiles').doc(cred.user.uid).set({uid:cred.user.uid,displayName:$('#signupName').value.trim(),city:$('#signupCity').value,country:$('#signupCountry').value,skills:'',bio:'',avatarUrl:'',companyIds:[],locationPublic:false,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
      toast('Verification email sent. Open it, then log in.');
      await fbAuth.signOut();
      $$('[data-auth-tab]').find(x=>x.dataset.authTab==='login').click();
    }catch(err){toast(err.message||'Registration failed.');}
    return;
  }
  toast('Public registration activates on the secure release. You can explore the complete preview now.');
  $('#demoLogin').focus();
});
$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(firebaseAvailable && window.NDCONF.firebaseProductionMode===true){
    try{
      const cred=await fbAuth.signInWithEmailAndPassword($('#loginEmail').value.trim(),$('#loginPassword').value);
      if(!cred.user.emailVerified){await fbAuth.signOut();toast('Please verify your email before login.');return}
      const [publicDoc,privateDoc]=await Promise.all([fbDb.collection('publicProfiles').doc(cred.user.uid).get(),fbDb.collection('users').doc(cred.user.uid).get()]);
      const publicData=publicDoc.exists?publicDoc.data():{},privateData=privateDoc.exists?privateDoc.data():{};
      state.user={...publicData,uid:cred.user.uid,name:publicData.displayName||cred.user.displayName||cred.user.email,email:cred.user.email,phone:cred.user.phoneNumber||privateData.phone||'',city:publicData.city||privateData.city||'',country:publicData.country||privateData.country||'',skills:publicData.skills||'',communityIds:publicData.communityIds||[],kycStatus:privateData.kycStatus||'pending'};save();render();
    }catch(err){toast(err.message||'Login failed.');}
    return;
  }
  toast('Account login activates on the secure release. Choose the interactive preview to explore now.');
  $('#demoLogin').focus();
});
$('#otpForm').addEventListener('submit',e=>{e.preventDefault();toast('Use the verification link sent to your registered email.');});
$('#onboardingForm').addEventListener('submit',e=>{e.preventDefault();state.user={name:$('#signupName').value,email:$('#signupEmail').value,phone:$('#signupPhone').value,country:$('#signupCountry').value,city:$('#signupCity').value,skills:$('#skillInput').value,mission:$('#missionSelect').value};state.community=$('input[name="community"]:checked').value;save();render();toast('Welcome aboard. Your personalized dashboard is ready.')});
$('#demoLogin').addEventListener('click',()=>{createDemoUser();render();toast('Interactive preview opened. No public account was created.')});
function createDemoUser(){state.user={name:'Muhammad Qureshi',email:'builder@example.com',phone:'+92 300 1234567',country:'Pakistan',city:'Islamabad',skills:'AI research, video production, community organizing',mission:'Building communities and governance'};state.settings.showSampleData=true;if(!state.proposals.length)state.proposals=seed.proposals.map(item=>({...item,recordMode:'sample'}));if(!state.transactions.length)state.transactions=seed.transactions.map(item=>({...item,recordMode:'sample'}));save()}
$('#logoutBtn').addEventListener('click',async()=>{if(firebaseAvailable&&fbAuth.currentUser)await fbAuth.signOut();localStorage.removeItem('gaigsUser');state.user=null;render()});
$('#openNav').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
$$('.scope-btn').forEach(b=>b.addEventListener('click',()=>{state.scope=b.dataset.scope;save();render();toast(`${getScopeLabel()} dashboard loaded.`)}));
$('#jarvisFab').addEventListener('click',()=>$('#jarvisPanel').classList.add('open'));$('#closeJarvis').addEventListener('click',()=>$('#jarvisPanel').classList.remove('open'));
$('#jarvisForm').addEventListener('submit',e=>{e.preventDefault();const p=$('#jarvisInput').value.trim();if(!p)return;$('#jarvisInput').value='';askJarvis(p)});
$$('[data-prompt]').forEach(b=>b.addEventListener('click',()=>askJarvis(b.dataset.prompt)));
$('#mobileCreate').addEventListener('click',()=>action('create'));
$('.modal-close').addEventListener('click',closeModal);$('.modal-backdrop').addEventListener('click',closeModal);
async function requestLiveLocation() {
  const applyPosition=pos=>{
    state.user.lat=pos.coords.latitude;state.user.lng=pos.coords.longitude;save();
    if(gaigsMapInstance){gaigsMapInstance.setView([state.user.lat,state.user.lng],14);L.marker([state.user.lat,state.user.lng]).addTo(gaigsMapInstance).bindPopup(`<b>${esc(state.user.name)} (You)</b><br><small>Approximate device area: ${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}</small>`).openPopup();}
    toast(`Location updated near ${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}.`);
  };
  toast('Requesting foreground location…');
  try{
    const nativeGeo=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Geolocation;
    if(nativeGeo){const permission=await nativeGeo.requestPermissions({permissions:['coarseLocation']});if(permission.coarseLocation!=='granted'&&permission.location!=='granted')throw new Error('Location permission denied.');applyPosition(await nativeGeo.getCurrentPosition({enableHighAccuracy:false,timeout:15000,maximumAge:60000}));return;}
    if('geolocation' in navigator){navigator.geolocation.getCurrentPosition(applyPosition,()=>toast('Location access denied. Using your selected city.'),{enableHighAccuracy:false,timeout:15000,maximumAge:60000});return;}
    toast('Geolocation is not supported on this device.');
  }catch(error){toast(error.message||'Location is unavailable.');}
}

const notifBtn = document.getElementById('notificationsBtn');
if (notifBtn) {
  notifBtn.addEventListener('click', () => {
    openModal(`<h2>🔔 Notifications & News Alerts</h2>
      <div class="activity-list" style="margin-top:12px">
        <div class="activity-item"><div class="activity-icon">🗳</div><div><b>Society Vote Closing</b><p>Clean-water filtration unit proposal closes today.</p><div class="meta-row"><span class="tag green">Society</span><span class="tag gold">Action Required</span></div></div></div>
        <div class="activity-item"><div class="activity-icon">📍</div><div><b>City Service Request</b><p>Video Editing & AI Automation request posted near G-11/4.</p><div class="meta-row"><span class="tag">City</span></div></div></div>
        <div class="activity-item"><div class="activity-icon">📢</div><div><b>National Creator Mission</b><p>Pakistan Creator Crew is seeking 4 new video explainers.</p><div class="meta-row"><span class="tag gold">Country</span></div></div></div>
        <div class="activity-item"><div class="activity-icon">🌊</div><div><b>Global Emergency Alert</b><p>Northern Flood Response relief wallet reaches ₨8.2M.</p><div class="meta-row"><span class="tag red">Global</span></div></div></div>
      </div>`);
  });
}

if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
render();
