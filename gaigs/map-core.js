/* Real map records only: user location, registered community centers, and opted-in approximate post pins. */
(function(){
  'use strict';
  const cloudReady=()=>Boolean(firebaseAvailable&&window.NDCONF?.firebaseProductionMode===true&&fbAuth?.currentUser&&fbDb);
  const finite=value=>Number.isFinite(Number(value));
  function records(){
    const communities=(state.communities||[]).filter(c=>finite(c.lat)&&finite(c.lng)).map(c=>({id:c.id,type:'community',lat:Number(c.lat),lng:Number(c.lng),title:c.name,detail:`${c.level||'Society'} · ${c.location||''}`,status:c.status||'registered'}));
    const posts=(state.posts||[]).filter(p=>finite(p.lat)&&finite(p.lng)).map((p,i)=>({id:p.id||`post-${i}`,type:'post',lat:Number(p.lat),lng:Number(p.lng),title:p.type||'Public post',detail:`${p.scope||''} · ${p.location||''}`,status:'approximate location'}));
    return [...communities,...posts];
  }
  function mapSummary(){
    const data=records(),communityCount=data.filter(x=>x.type==='community').length,postCount=data.filter(x=>x.type==='post').length,hasMe=finite(state.user?.lat)&&finite(state.user?.lng);
    return `<div class="map-real-summary"><div><small>Registered centers with coordinates</small><b>${communityCount}</b></div><div><small>Opted-in approximate post pins</small><b>${postCount}</b></div><div><small>Your device location</small><b>${hasMe?'AVAILABLE':'NOT SHARED'}</b></div></div>`;
  }
  views.map=function(){
    const data=records();return `${pageHead('Community & action map','Pins come only from registered centers or posts whose author opted in to an approximate location.',`<button class="ghost-btn" data-live-location>📍 Use my device location</button><button class="action-btn" data-action="community">＋ Register society center</button>`)}<div class="capability-strip"><span class="tag ${cloudReady()?'green':'gold'}">${cloudReady()?'SHARED MAP DATA':'OFFLINE MAP DATA'}</span><b>${data.length} public pin${data.length===1?'':'s'}</b><span>Exact residence evidence never appears on this map.</span></div><div class="dashboard-grid"><section class="card span-12"><div class="card-body"><div class="map-shell real-map-shell"><div id="gaigsLeaflet"></div>${data.length?'':'<div class="map-empty-overlay"><b>No public pins in this workspace yet</b><span>Share device location privately or register a society center with consent.</span></div>'}</div>${mapSummary()}</div></section></div>`;
  };
  initGaigsLeafletMap=function(){
    const container=document.getElementById('gaigsLeaflet');if(!container||!window.L)return;
    if(gaigsMapInstance){try{gaigsMapInstance.remove();}catch(error){}gaigsMapInstance=null;}
    const hasMe=finite(state.user?.lat)&&finite(state.user?.lng),data=records(),first=data[0],center=hasMe?[Number(state.user.lat),Number(state.user.lng)]:first?[first.lat,first.lng]:[20,0],zoom=hasMe?14:first?12:2;
    gaigsMapInstance=L.map(container,{zoomControl:true}).setView(center,zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(gaigsMapInstance);
    if(hasMe)L.circleMarker([Number(state.user.lat),Number(state.user.lng)],{radius:8,color:'#19e0ff',fillColor:'#19e0ff',fillOpacity:.7}).addTo(gaigsMapInstance).bindPopup('<b>Your private device position</b><br><small>Not published by viewing this map.</small>');
    data.forEach(item=>{const color=item.type==='community'?'#39ff9c':'#ffd166';L.circleMarker([item.lat,item.lng],{radius:item.type==='community'?9:7,color,fillColor:color,fillOpacity:.72}).addTo(gaigsMapInstance).bindPopup(`<b>${esc(item.title)}</b><br><small>${esc(item.detail)}</small><br><small>${esc(item.status)}</small>`);});
  };
  async function loadCloudCenters(){
    if(!cloudReady()||!state.user?.city)return;
    try{const snapshot=await fbDb.collection('communities').where('city','==',state.user.city).limit(200).get(),remote=[];snapshot.forEach(doc=>remote.push({id:doc.id,...doc.data()}));const ids=new Set(remote.map(x=>x.id));state.communities=[...remote,...(state.communities||[]).filter(x=>!ids.has(x.id))];save();if(state.view==='map')render();}catch(error){console.warn('[GAIGS] Map centers unavailable:',error.message);}
  }
  if(firebaseAvailable&&fbAuth)fbAuth.onAuthStateChanged(user=>{if(user)loadCloudCenters();});
})();
