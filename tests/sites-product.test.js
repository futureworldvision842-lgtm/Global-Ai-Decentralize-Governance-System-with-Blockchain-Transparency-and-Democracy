const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'sites', 'product-api.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'gaigs', 'app.js'), 'utf8');
const network = fs.readFileSync(path.join(root, 'gaigs', 'network-core.js'), 'utf8');
const hosting = JSON.parse(fs.readFileSync(path.join(root, '.openai', 'hosting.json'), 'utf8'));

test('Sites product API exposes durable identity, media and account routes', () => {
  for (const route of ['/api/auth/register', '/api/auth/login', '/api/auth/me', '/api/profile/avatar', '/api/uploads', '/api/posts', '/api/wallet/transfer', '/api/ledger/verify', '/api/governance/proposals']) {
    assert.ok(api.includes(route), `missing ${route}`);
  }
  assert.equal(hosting.d1, 'DB');
  assert.equal(hosting.r2, 'UPLOADS');
});

test('credentials and CNIC use server-side protection', () => {
  assert.match(api, /PBKDF2/);
  assert.match(api, /PASSWORD_ITERATIONS = 100000/);
  assert.match(api, /APP_KYC_PEPPER/);
  assert.match(api, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(api, /cnic_hash/);
  assert.match(api, /cnic_last4/);
  assert.doesNotMatch(api, /raw CNIC/i);
});

test('wallet is closed-loop and tamper-evident rather than fake cryptocurrency', () => {
  assert.match(api, /closed-loop GAIGS Credits/i);
  assert.match(api, /previous_hash/);
  assert.match(api, /entry_hash/);
  assert.match(api, /publicBlockchainAnchor: null/);
  assert.match(api, /never fiat, deposits, withdrawals or crypto/i);
});

test('web and native clients use the same authenticated API', () => {
  assert.match(network, /credentials:'include'/);
  assert.match(network, /x-gaigs-client/);
  assert.match(network, /GaigsSecureStore/);
  assert.doesNotMatch(network, /let sessionToken=native\?localStorage/);
  assert.match(app, /gaigsApi\.register/);
  assert.match(app, /gaigsApi\.login/);
  assert.match(app, /gaigsApi\.createPost/);
  assert.match(app, /gaigsApi\.updateProfile/);
});
