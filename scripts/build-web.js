const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const source=path.join(root,'mobile','dist');
const target=path.join(root,'dist-web');

if(path.dirname(target)!==root||path.basename(target)!=='dist-web')throw new Error('Refusing to replace an unexpected directory');
if(!fs.existsSync(path.join(source,'gaigs','index.html')))throw new Error('Run the reviewed web sync before building deployment assets');
fs.rmSync(target,{recursive:true,force:true});
fs.cpSync(source,target,{recursive:true});
const downloadsSource=path.join(root,'downloads');
if(fs.existsSync(downloadsSource))fs.cpSync(downloadsSource,path.join(target,'downloads'),{recursive:true});
console.log('Built allow-listed web deployment in dist-web.');
