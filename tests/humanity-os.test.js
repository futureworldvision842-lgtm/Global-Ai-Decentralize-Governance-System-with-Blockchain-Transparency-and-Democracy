const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("../humanity-os/integrity-logic.js");

test("Humanity OS canonical JSON is stable across object key order", () => {
  assert.equal(H.canonicalize({ z: 1, a: { y: 2, x: 3 } }), H.canonicalize({ a: { x: 3, y: 2 }, z: 1 }));
});

test("device event chains reject a broken previous hash", () => {
  const events = [
    { id: "a", deviceId: "one", sequence: 1, previousHash: "GENESIS", hash: "aaa" },
    { id: "b", deviceId: "one", sequence: 2, previousHash: "wrong", hash: "bbb" },
  ];
  const result = H.checkLinks(events);
  assert.equal(result.valid, false);
  assert.match(result.failures[0].reason, /previous hash/i);
});

test("protocol actions require unique verified devices and a live expiry", () => {
  const action = { id: "p1", threshold: 2, status: "awaiting_approvals", expires: "2099-01-01" };
  assert.equal(H.canExecute(action, [{ actionId: "p1", deviceId: "d1", verified: true }, { actionId: "p1", deviceId: "d1", verified: true }]).allowed, false);
  assert.equal(H.canExecute(action, [{ actionId: "p1", deviceId: "d1", verified: true }, { actionId: "p1", deviceId: "d2", verified: true }]).allowed, true);
});

test("expired protocol actions cannot execute even with threshold approval", () => {
  const result = H.canExecute({ id: "p1", threshold: 2, status: "awaiting_approvals", expires: "2020-01-01" }, [{ actionId: "p1", deviceId: "d1", verified: true }, { actionId: "p1", deviceId: "d2", verified: true }]);
  assert.equal(result.allowed, false);
});
