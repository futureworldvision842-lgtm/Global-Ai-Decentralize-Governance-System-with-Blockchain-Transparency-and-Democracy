const https=require('https');
const crypto=require('crypto');
const {cert,getApps,initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');

const buckets=new Map();
const knowledge=[
  {id:'governance-boundary',terms:['proposal','vote','quorum','governance'],text:'GAIGS proposals move through evidence, discussion, voting and server-finalized outcome. One verified member gets one private ballot. JARVIS and administrators cannot cast, edit or finalize a user ballot.'},
  {id:'wallet-boundary',terms:['wallet','money','fund','crypto','bank'],text:'A GAIGS platform account is an application ledger. Real PKR or crypto settlement stays disabled until a licensed provider or user-controlled wallet, reconciliation, disputes, KYC/AML and security controls are connected.'},
  {id:'humanity-lab-boundary',terms:['science','game','simulation','lab'],text:'A Humanity Lab run can create a reproducible learning receipt. Scientific validity, field deployment, bounties and financial rewards require independent review and a separately approved funding workflow.'},
  {id:'emergency-boundary',terms:['flood','emergency','relief','donation'],text:'Emergency reports require verification. A relief ledger links donations, allocations, receipts and delivery evidence while protecting beneficiary privacy. A browser cannot create or settle real funds.'}
];
function cors(origin,host){const allowed=(process.env.GAIGS_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);let sameOrigin=false;try{sameOrigin=Boolean(origin&&host&&new URL(origin).host===host);}catch(error){}const safe=allowed.includes(origin)||sameOrigin?origin:(allowed[0]||'https://example.invalid');return {'Content-Type':'application/json','Access-Control-Allow-Origin':safe,'Vary':'Origin'};}
function rateLimit(key){const now=Date.now(),recent=(buckets.get(key)||[]).filter(t=>now-t<60000);if(recent.length>=20)return false;recent.push(now);buckets.set(key,recent);return true;}
function initAdmin(){if(getApps().length)return;const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;if(raw)initializeApp({credential:cert(JSON.parse(raw))});else initializeApp({projectId:process.env.FIREBASE_PROJECT_ID});}
async function identity(event){
  const token=String(event.headers.authorization||event.headers.Authorization||'').replace(/^Bearer\s+/i,'');
  if(!token){if(process.env.GAIGS_ALLOW_ANONYMOUS_JARVIS==='true')return {uid:'anonymous'};throw new Error('Authentication required');}
  initAdmin();return getAuth().verifyIdToken(token);
}
function safeContext(raw){const allowed=['city','country','community','skills','proposal','treasurySummary','emergencySummary','view','scope'],out={};for(const key of allowed)if(raw&&raw[key]!==undefined)out[key]=raw[key];return out;}
function generate(body){return new Promise((resolve,reject)=>{
  const request=https.request({hostname:'generativelanguage.googleapis.com',path:`/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL||'gemini-2.5-flash')}:generateContent?key=${encodeURIComponent(process.env.GEMINI_KEY||'')}`,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},response=>{let data='';response.on('data',chunk=>data+=chunk);response.on('end',()=>{try{const parsed=JSON.parse(data);if(response.statusCode<200||response.statusCode>=300)return reject(new Error(parsed.error?.message||`AI upstream ${response.statusCode}`));resolve(parsed);}catch(error){reject(error);}});});request.on('error',reject);request.write(body);request.end();
  });}
exports.handler=async event=>{
  const origin=event.headers.origin||'',headers=cors(origin,event.headers.host||'');
  if(event.httpMethod==='OPTIONS')return {statusCode:204,headers:{...headers,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'},body:''};
  if(event.httpMethod!=='POST')return {statusCode:405,headers,body:JSON.stringify({error:'POST only'})};
  try{
    const account=await identity(event);if(!rateLimit(account.uid||event.headers['x-forwarded-for']||'unknown'))return {statusCode:429,headers,body:JSON.stringify({error:'Rate limit exceeded'})};
    const input=JSON.parse(event.body||'{}'),prompt=String(input.prompt||'').trim();if(!prompt||prompt.length>3000)return {statusCode:400,headers,body:JSON.stringify({error:'Prompt must contain 1-3000 characters'})};
    const scope=['personal','society','city','country','global'].includes(input.scope)?input.scope:'personal',context=safeContext(input.context||{}),matches=knowledge.filter(item=>item.terms.some(term=>prompt.toLowerCase().includes(term))).slice(0,3);
    if(process.env.GAIGS_JARVIS_BRIDGE_URL&&process.env.GAIGS_JARVIS_BRIDGE_TOKEN){try{const response=await fetch(process.env.GAIGS_JARVIS_BRIDGE_URL.replace(/\/$/,'')+'/v1/ask',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.GAIGS_JARVIS_BRIDGE_TOKEN},body:JSON.stringify({prompt,uid:account.uid,scope,context})});if(response.ok){const value=await response.json();return {statusCode:200,headers,body:JSON.stringify({answer:value.answer,auditId:value.auditId,allowedActions:value.allowedActions,sourceIds:['safe-jarvis-bridge']})};}}catch(error){console.warn('[JARVIS] Private safe bridge unavailable.');}}
    if(!process.env.GEMINI_KEY)throw new Error('Server AI credentials are not configured');
    const system='You are JARVIS inside GAIGS. Explain records, compare evidence, translate, draft for review, search permitted context, match services, remind and navigate. Never vote, approve identity or membership, publish, change rules, move money, conceal sources, claim legal authority, or treat simulation output as scientific proof. Say when data is missing. Answer in the user language (including Roman Urdu).';
    const requestBody=JSON.stringify({system_instruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:`Scope: ${scope}\nPermitted context: ${JSON.stringify(context).slice(0,5000)}\nPolicy context: ${matches.map(x=>x.text).join('\n')}\n\nRequest: ${prompt}`}]}]});
    const result=await generate(requestBody),answer=(result.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();if(!answer)throw new Error('AI returned no answer');
    const auditId=crypto.createHash('sha256').update(`${account.uid}:${scope}:${Date.now()}`).digest('hex').slice(0,20);
    return {statusCode:200,headers,body:JSON.stringify({answer,auditId,allowedActions:['explain','compare','translate','draft','search','match','remind','navigate'],sourceIds:matches.map(x=>x.id)})};
  }catch(error){const unauthorized=/Authentication|required|token/i.test(error.message);return {statusCode:unauthorized?401:500,headers,body:JSON.stringify({error:String(error.message||error).slice(0,180)})};}
};
