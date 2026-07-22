const fs=require('node:fs');
const path=require('node:path');
const mobileRoot=path.resolve(__dirname,'..');
const projectRoot=path.resolve(mobileRoot,'..');
const dist=path.resolve(mobileRoot,'dist');
if(path.dirname(dist)!==mobileRoot||path.basename(dist)!=='dist')throw new Error('Refusing to replace an unexpected directory');
fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist,{recursive:true});
for(const name of ['config.js','privacy.html','delete-account.html','terms.html','science-game.html','science-world.html','agency.html','manifest.webmanifest','sw.js']){
  const source=path.join(projectRoot,name);if(fs.existsSync(source))fs.copyFileSync(source,path.join(dist,name));
}
const visionSource=path.join(projectRoot,'index.html');if(fs.existsSync(visionSource))fs.copyFileSync(visionSource,path.join(dist,'vision.html'));
fs.writeFileSync(path.join(dist,'index.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=gaigs/index.html"><title>Opening GAIGS</title></head><body><p><a href="gaigs/index.html">Open GAIGS</a></p><script>location.replace("gaigs/index.html")<\/script></body></html>');
fs.cpSync(path.join(projectRoot,'gaigs'),path.join(dist,'gaigs'),{recursive:true});
const humanitySource=path.join(projectRoot,'humanity-os');
if(fs.existsSync(humanitySource))fs.cpSync(humanitySource,path.join(dist,'humanity-os'),{recursive:true});
console.log('Synced reviewed GAIGS web assets into the Android bundle.');
