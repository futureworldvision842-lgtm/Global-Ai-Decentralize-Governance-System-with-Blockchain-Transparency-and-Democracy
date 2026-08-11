const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const api = read('sites/product-api.js');
const web = read('gaigs/hybrid-messaging-v3.js');
const feed = read('gaigs/transparent-feed-v1.js');
const native = read('mobile/android/app/src/main/java/com/futureworldvision/gaigs/GaigsNearbyPlugin.java');
const manifest = read('mobile/android/app/src/main/AndroidManifest.xml');
const gradle = read('mobile/android/app/build.gradle');

test('hosted messaging persists encrypted envelopes and exposes receipt-chain routes', () => {
  for (const route of ['/api/messaging/devices', '/api/messaging/contacts', '/api/messaging/messages', '/api/messaging/rooms']) {
    assert.ok(api.includes(route), `missing ${route}`);
  }
  assert.match(api, /keysMatch = url\.pathname\.match/);
  assert.match(api, /verifyConversationMatch = url\.pathname\.match/);
  assert.match(api, /recipient_envelope TEXT NOT NULL/);
  assert.match(api, /sender_envelope TEXT NOT NULL/);
  assert.match(api, /previous_hash TEXT NOT NULL/);
  assert.match(api, /message_hash TEXT NOT NULL UNIQUE/);
  assert.doesNotMatch(api, /private_messages[\s\S]{0,400}plaintext/i);
});

test('private chat uses per-device ECDH, HKDF and AES-GCM', () => {
  assert.match(web, /ECDH-P256-AESGCM/);
  assert.match(web, /name: "ECDH"/);
  assert.match(web, /name: "HKDF"/);
  assert.match(web, /name: "AES-GCM"/);
  assert.match(web, /signPacket/);
  assert.match(web, /verifyPacket/);
  assert.match(web, /ttl: type === "hello" \? 1 : 6/);
  assert.match(web, /Intermediate phones carry ciphertext only/);
});

test('Android nearby transport requires visible verification and modern permissions', () => {
  assert.match(native, /Strategy\.P2P_CLUSTER/);
  assert.match(native, /nearbyConnectionRequest/);
  assert.match(native, /getAuthenticationDigits/);
  assert.match(native, /public void accept/);
  assert.doesNotMatch(native, /onConnectionInitiated[\s\S]{0,500}acceptConnection\(/);
  for (const permission of ['BLUETOOTH_ADVERTISE', 'BLUETOOTH_CONNECT', 'BLUETOOTH_SCAN', 'NEARBY_WIFI_DEVICES']) assert.match(manifest, new RegExp(permission));
  assert.match(gradle, /play-services-nearby:19\.3\.0/);
  assert.match(gradle, /versionCode 9/);
});

test('feed ranking is inspectable and excludes sensitive private data', () => {
  assert.match(feed, /relevance: 30/);
  assert.match(feed, /proximity: 25/);
  assert.match(feed, /evidence: 20/);
  assert.match(feed, /trust: 15/);
  assert.match(feed, /freshness: 10/);
  assert.match(feed, /CNIC, private messages, phone contacts/);
  assert.match(feed, /chronological Latest/);
});
