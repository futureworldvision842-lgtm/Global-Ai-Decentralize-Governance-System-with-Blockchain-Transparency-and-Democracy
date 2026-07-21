const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../gaigs/project-logic.js');

test('milestone release needs evidence, independent verification and matched vote',()=>{
  const milestone={id:'m1',status:'verification',evidenceHash:'0xabc',providerId:'provider',verifierId:'member-2',createdBy:'member-1',amount:100};
  assert.equal(P.releaseEligibility({projectStatus:'active',milestone,approval:{proposalId:'p1',milestoneId:'m1',passed:true}}).eligible,true);
});

test('provider cannot verify own milestone',()=>{
  const milestone={id:'m1',status:'verification',evidenceHash:'0xabc',providerId:'provider',verifierId:'provider',amount:100};
  const result=P.releaseEligibility({projectStatus:'active',milestone,approval:{proposalId:'p1',milestoneId:'m1',passed:true}});
  assert.equal(result.eligible,false);
  assert.match(result.reasons.join(' '),/cannot verify/i);
});

test('release cannot proceed without an independent verifier',()=>{
  const milestone={id:'m1',status:'verification',evidenceHash:'0xabc',providerId:'provider',amount:100};
  const result=P.releaseEligibility({projectStatus:'active',milestone,approval:{proposalId:'p1',milestoneId:'m1',passed:true}});
  assert.equal(result.eligible,false);
  assert.match(result.reasons.join(' '),/independent verifier/i);
});

test('funding summary counts confirmed settlement only',()=>{
  assert.deepEqual(P.fundingSummary([{amount:20,status:'confirmed'},{amount:80,status:'awaiting_settlement'}],100),{confirmed:20,target:100,remaining:80,percent:20});
});
