(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GAIGSSocialLogic=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const reactionOrder=['Support','Useful','Important'];
  function nextReaction(current){const i=reactionOrder.indexOf(current);return reactionOrder[(i+1)%reactionOrder.length];}
  function validatePhone(value){return /^\+[1-9]\d{7,14}$/.test(String(value||'').replace(/[\s()-]/g,''));}
  function paginate(items,page,pageSize){const size=Math.max(1,Number(pageSize)||5),pages=Math.max(1,Math.ceil(items.length/size)),safe=Math.min(Math.max(1,Number(page)||1),pages);return {items:items.slice((safe-1)*size,safe*size),page:safe,pages};}
  function filterPosts(posts,filter,context={}){
    const city=String(context.city||''),following=context.following||[],saved=context.saved||[];
    if(filter==='Following')return posts.filter(p=>following.includes(p.authorId));
    if(filter==='Saved')return posts.filter(p=>saved.includes(p.id));
    if(filter==='My society')return posts.filter(p=>String(p.scope).toLowerCase()==='society');
    if(filter==='City')return posts.filter(p=>String(p.scope).toLowerCase()==='city'||String(p.location||'').includes(city));
    if(filter==='Country')return posts.filter(p=>String(p.scope).toLowerCase()==='country');
    if(filter==='Global')return posts.filter(p=>String(p.scope).toLowerCase()==='global');
    if(filter==='Nearby')return posts.filter(p=>String(p.location||'').includes(city)||['society','city'].includes(String(p.scope).toLowerCase()));
    return posts;
  }
  return {reactionOrder,nextReaction,validatePhone,paginate,filterPosts};
});
