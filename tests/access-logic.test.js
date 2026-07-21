const test=require('node:test');
const assert=require('node:assert/strict');
const logic=require('../gaigs/access-logic.js');

test('administrators cannot vote for another person or move user money',()=>{
  assert.equal(logic.can('system_admin','vote_for_other'),false);
  assert.equal(logic.can('society_admin','move_user_money'),false);
});
test('society assignment is limited to its exact scope',()=>{
  const assignments=[{role:'society_admin',scope:'society',scopeId:'s1',status:'active'}];
  assert.equal(logic.authorized(assignments,'manage_members',{scope:'society',scopeId:'s1'}),true);
  assert.equal(logic.authorized(assignments,'manage_members',{scope:'society',scopeId:'s2'}),false);
});
test('expired assignments stop granting access',()=>{
  const assignments=[{role:'city_operator',scope:'city',scopeId:'isb',status:'active',expiresAt:'2020-01-01'}];
  assert.equal(logic.authorized(assignments,'manage_scope_directory',{scope:'city',scopeId:'isb'}),false);
});
