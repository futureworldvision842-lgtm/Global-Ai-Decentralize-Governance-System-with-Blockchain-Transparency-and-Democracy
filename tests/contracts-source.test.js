const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..','contracts',name),'utf8');

test('governor uses one eligible address one ballot without token weights',()=>{
  const source=read('CivicGovernorV1.sol');
  assert.match(source,/mapping\(uint256 => mapping\(address => bool\)\) public hasVoted/);
  assert.doesNotMatch(source,/balanceOf\(|delegate\(|ERC20Votes/);
});

test('project release can only be approved by governor and uses pull withdrawal',()=>{
  const source=read('CivicProjectVault.sol');
  assert.match(source,/approveRelease[\s\S]*onlyGovernor/);
  assert.match(source,/claimable\[milestone\.provider\] \+= milestone\.amount/);
  assert.match(source,/function withdraw\(\) external nonReentrant/);
});

test('identity fields are absent from on-chain registry',()=>{
  const source=read('VerifiedMemberRegistry.sol').toLowerCase();
  const executable=source.replace(/\/\/.*$/gm,'').replace(/\/\*[\s\S]*?\*\//g,'');
  for(const field of ['cnic','phone','email','homeaddress'])assert.equal(executable.includes(field),false);
  assert.match(source,/never put cnic/);
});
