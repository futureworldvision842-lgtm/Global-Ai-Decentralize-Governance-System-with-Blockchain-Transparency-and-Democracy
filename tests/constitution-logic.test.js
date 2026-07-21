const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../gaigs/constitution-logic.js');

const founders=Array.from({length:10},(_,i)=>({memberId:`m${i}`,residenceVerified:true,inBoundary:true}));

test('formation requires verified unique founders, boundary evidence, no overlap and supermajority',()=>{
  const result=C.evaluateFormation({founders,boundaryEvidence:[{verified:true},{verified:true}],overlapResolved:true,vote:{yes:8,no:1,abstain:1,eligible:10}});
  assert.equal(result.passed,true);
  assert.equal(result.vote.quorumMet,true);
});

test('duplicate or unverified founders block formation',()=>{
  const bad=[...founders.slice(0,9),{memberId:'m0',residenceVerified:false,inBoundary:true}];
  assert.equal(C.validateFounders(bad).valid,false);
});

test('clerks can coordinate but cannot vote, release funds or edit outcomes',()=>{
  assert.equal(C.clerkPermission('publish_agenda').allowed,true);
  for(const action of ['cast_member_vote','release_funds','declare_outcome','edit_audit_record'])assert.equal(C.clerkPermission(action).allowed,false);
});

test('recall requires petition, cooling period, quorum and majority',()=>{
  const result=C.evaluateRecall({eligible:100,petitionSignatures:20,daysSinceElection:60,vote:{yes:40,no:20,abstain:0}});
  assert.equal(result.passed,true);
  assert.equal(C.evaluateRecall({eligible:100,petitionSignatures:10,daysSinceElection:60,vote:{yes:40,no:20}}).passed,false);
});

test('clerk election rejects ties and low turnout',()=>{
  assert.equal(C.electClerk([{memberId:'a',votes:20},{memberId:'b',votes:20}],100).elected,null);
  assert.equal(C.electClerk([{memberId:'a',votes:40},{memberId:'b',votes:5}],100).elected.memberId,'a');
});
