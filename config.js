// Safe local defaults. AI credentials belong only in the Netlify/Firebase/server environment.
// platformApiBase: live GAIGS account API (Cloudflare Worker + D1). No trailing slash.
// jarvisProxyUrl stays on the external explainer. The UI calls that host an external demo that may be unavailable.
window.NDCONF={
  jarvisProxyUrl:'https://gaigs-jarvis-v2.qw01.chatgpt.site/api/jarvis-assist',
  platformApiBase:'https://gaigs-api.gaigs.workers.dev',
  showSampleData:false,
  firebaseDemoSync:false,
  firebaseProductionMode:false,
  firebase:{
    apiKey:'YOUR_FIREBASE_WEB_API_KEY',
    authDomain:'YOUR_PROJECT_ID.firebaseapp.com',
    projectId:'YOUR_PROJECT_ID',
    storageBucket:'YOUR_PROJECT_ID.appspot.com',
    messagingSenderId:'YOUR_SENDER_ID',
    appId:'YOUR_APP_ID'
  },
  ethereum:{
    chainId:'11155111',
    chainName:'Sepolia',
    governorAddress:'',
    registryAddress:'',
    projectVaultAddress:'',
    outcomeAnchorAddress:'',
    mainnetEnabled:false
  }
};
