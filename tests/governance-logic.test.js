const test=require('node:test');
const assert=require('node:assert/strict');
const logic=require('../gaigs/governance-logic.js');

test('duplicate voter records never increase a tally',()=>{
  const result=logic.tally([{voterId:'a',choice:'yes'},{voterId:'a',choice:'no'},{voterId:'b',choice:'abstain'}],10);
  assert.deepEqual({yes:result.yes,no:result.no,abstain:result.abstain,cast:result.cast},{yes:1,no:0,abstain:1,cast:2});
});
test('standard outcome requires quorum and majority',()=>{
  assert.equal(logic.tally({yes:30,no:10},100).outcome,'approved');
  assert.equal(logic.tally({yes:20,no:19},100).outcome,'no_quorum');
  assert.equal(logic.tally({yes:20,no:25},100).outcome,'rejected');
});
test('constitutional amendment uses two-thirds threshold',()=>{
  assert.equal(logic.tally({yes:39,no:21},100,'constitutional').outcome,'rejected');
  assert.equal(logic.tally({yes:41,no:19},100,'constitutional').outcome,'approved');
});
test('discussion cannot advance without time and evidence',()=>{
  assert.equal(logic.canTransition('discussion','voting',{ruleKey:'standard',discussionClosed:true,evidenceCount:0}).allowed,false);
  assert.equal(logic.canTransition('discussion','voting',{ruleKey:'standard',discussionClosed:true,evidenceCount:1}).allowed,true);
});
test('vote validation enforces status, scope eligibility, and deadline',()=>{
  assert.equal(logic.validateVote({voterId:'u1',choice:'yes',status:'Voting',isEligible:true,closesAt:'2099-01-01'}).valid,true);
  assert.equal(logic.validateVote({voterId:'u1',choice:'yes',status:'Discussion',isEligible:true}).valid,false);
  assert.equal(logic.validateVote({voterId:'u1',choice:'yes',status:'Voting',isEligible:false}).valid,false);
});
