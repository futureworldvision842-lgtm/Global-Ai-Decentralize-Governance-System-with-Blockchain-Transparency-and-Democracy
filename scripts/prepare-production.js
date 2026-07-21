const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const target=path.join(root,'dist-web');
const required=name=>{const value=String(process.env[name]||'').trim();if(!value)throw new Error(`Missing required production environment variable: ${name}`);return value;};
const optional=(name,fallback='')=>String(process.env[name]||fallback).trim();
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

if(!fs.existsSync(path.join(target,'gaigs','index.html')))throw new Error('Run build:web before preparing production assets');

const config={
  jarvisProxyUrl:optional('GAIGS_JARVIS_PROXY_URL','/.netlify/functions/jarvis-v2'),
  showSampleData:false,
  firebaseDemoSync:false,
  firebaseProductionMode:true,
  firebase:{
    apiKey:required('GAIGS_FIREBASE_API_KEY'),
    authDomain:required('GAIGS_FIREBASE_AUTH_DOMAIN'),
    projectId:required('GAIGS_FIREBASE_PROJECT_ID'),
    storageBucket:required('GAIGS_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId:required('GAIGS_FIREBASE_MESSAGING_SENDER_ID'),
    appId:required('GAIGS_FIREBASE_APP_ID')
  },
  ethereum:{
    chainId:optional('GAIGS_ETHEREUM_CHAIN_ID','11155111'),
    chainName:optional('GAIGS_ETHEREUM_CHAIN_NAME','Sepolia'),
    governorAddress:optional('GAIGS_GOVERNOR_ADDRESS'),
    registryAddress:optional('GAIGS_REGISTRY_ADDRESS'),
    projectVaultAddress:optional('GAIGS_PROJECT_VAULT_ADDRESS'),
    outcomeAnchorAddress:optional('GAIGS_OUTCOME_ANCHOR_ADDRESS'),
    mainnetEnabled:false
  }
};

const configSource=`// Generated from public deployment configuration. No private keys or server secrets belong here.\nwindow.NDCONF=${JSON.stringify(config,null,2)};\n`;
const releaseTargets=[target,path.join(root,'mobile','dist')].filter(directory=>fs.existsSync(path.join(directory,'gaigs','index.html')));
for(const directory of releaseTargets)fs.writeFileSync(path.join(directory,'config.js'),configSource);

const operator=escapeHtml(required('GAIGS_OPERATOR_NAME'));
const email=escapeHtml(required('GAIGS_PRIVACY_EMAIL'));
const address=escapeHtml(required('GAIGS_POSTAL_ADDRESS'));
for(const directory of releaseTargets){
  const privacyPath=path.join(directory,'privacy.html');
  if(!fs.existsSync(privacyPath))continue;
  let privacy=fs.readFileSync(privacyPath,'utf8');
  privacy=privacy.replace(/<div class="notice"><b>Operator identification before public launch:<\/b>[\s\S]*?<\/div>/,`<div class="notice"><b>Data controller:</b> ${operator}<br><b>Postal address:</b> ${address}<br><b>Privacy contact:</b> <a href="mailto:${email}">${email}</a></div>`);
  privacy=privacy.replace(/Until the final legal operator contact is supplied,[\s\S]*?before production launch\./,`Privacy and deletion requests may be sent to <a href="mailto:${email}">${email}</a>.`);
  fs.writeFileSync(privacyPath,privacy);
}
console.log(`Prepared production account configuration and operator privacy contact for ${releaseTargets.length} release target(s).`);
