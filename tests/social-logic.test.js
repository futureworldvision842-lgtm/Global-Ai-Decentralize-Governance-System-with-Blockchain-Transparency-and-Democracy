const test=require('node:test');
const assert=require('node:assert/strict');
const logic=require('../gaigs/social-logic.js');
test('reaction cycle is deterministic',()=>{assert.equal(logic.nextReaction(undefined),'Support');assert.equal(logic.nextReaction('Support'),'Useful');assert.equal(logic.nextReaction('Important'),'Support');});
test('phone validation requires international format',()=>{assert.equal(logic.validatePhone('+92 300 1234567'),true);assert.equal(logic.validatePhone('03001234567'),false);assert.equal(logic.validatePhone('+1'),false);});
test('feed filters and pagination are stable',()=>{const posts=[{id:'1',authorId:'a',scope:'City',location:'Islamabad'},{id:'2',authorId:'b',scope:'Global',location:'Global'},{id:'3',authorId:'a',scope:'Society',location:'Islamabad'}];assert.deepEqual(logic.filterPosts(posts,'Following',{following:['a']}).map(p=>p.id),['1','3']);assert.deepEqual(logic.filterPosts(posts,'Nearby',{city:'Islamabad'}).map(p=>p.id),['1','3']);assert.deepEqual(logic.paginate(posts,2,2),{items:[posts[2]],page:2,pages:2});});
