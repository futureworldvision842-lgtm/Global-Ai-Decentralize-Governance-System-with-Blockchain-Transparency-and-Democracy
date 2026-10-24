// Safe local defaults. AI credentials belong only in the Netlify/Firebase/server environment.
// platformApiBase is the one switch for account sign-in. Leave YOUR_SUBDOMAIN in
// place to keep the current backend. After `wrangler deploy`, replace the whole
// URL with the printed workers.dev origin and no trailing slash. See DEPLOY.md.
window.NDCONF={
  jarvisProxyUrl:'https://gaigs-jarvis-v2.qw01.chatgpt.site/api/jarvis-assist',
  platformApiBase:'https://gaigs-api.YOUR_SUBDOMAIN.workers.dev',
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
