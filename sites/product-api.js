/* GAIGS Sites-native product API.
 * Durable records live in D1; public media lives in R2. Financial values are
 * closed-loop GAIGS Credits (GCR), never fiat, deposits, withdrawals or crypto.
 */

let productSchemaReady = false;
const PRODUCT_COOKIE = "gaigs_session";
const SESSION_DAYS = 30;
// Cloudflare Workers Web Crypto currently caps PBKDF2 at 100,000 iterations.
const PASSWORD_ITERATIONS = 100000;
const ZERO_HASH = "0".repeat(64);

const PRODUCT_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS gaigs_users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL, password_iterations INTEGER NOT NULL,
    full_name TEXT NOT NULL, phone TEXT NOT NULL, cnic_hash TEXT NOT NULL UNIQUE,
    cnic_last4 TEXT NOT NULL, country TEXT NOT NULL, city TEXT NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 0, kyc_status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL, last_login_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS gaigs_profiles (
    user_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, bio TEXT NOT NULL DEFAULT '',
    skills TEXT NOT NULL DEFAULT '', avatar_key TEXT, location_public INTEGER NOT NULL DEFAULT 0,
    lat_approx REAL, lng_approx REAL, updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS gaigs_sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL, FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS gaigs_wallets (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, currency TEXT NOT NULL DEFAULT 'GCR',
    available INTEGER NOT NULL DEFAULT 0, reserved INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'mvp', created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS gaigs_ledger_entries (
    id TEXT PRIMARY KEY, wallet_id TEXT NOT NULL, direction TEXT NOT NULL,
    amount INTEGER NOT NULL, entry_type TEXT NOT NULL, counterparty_wallet_id TEXT,
    reference_id TEXT, description TEXT NOT NULL, previous_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL,
    FOREIGN KEY(wallet_id) REFERENCES gaigs_wallets(id)
  )`,
  `CREATE TABLE IF NOT EXISTS gaigs_uploads (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE,
    media_type TEXT NOT NULL, original_name TEXT NOT NULL, byte_size INTEGER NOT NULL,
    purpose TEXT NOT NULL, created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS gaigs_posts (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, display_name TEXT NOT NULL,
    post_type TEXT NOT NULL, scope TEXT NOT NULL, body TEXT NOT NULL,
    location_label TEXT NOT NULL DEFAULT '', lat_approx REAL, lng_approx REAL,
    upload_id TEXT, reward_credits INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES gaigs_users(id),
    FOREIGN KEY(upload_id) REFERENCES gaigs_uploads(id)
  )`,
  `CREATE TABLE IF NOT EXISTS gaigs_reward_events (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, post_id TEXT NOT NULL UNIQUE,
    amount INTEGER NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS gaigs_proposals (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, scope TEXT NOT NULL,
    description TEXT NOT NULL, evidence TEXT NOT NULL, budget_credits INTEGER NOT NULL DEFAULT 0,
    rules_version TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'voting',
    yes_count INTEGER NOT NULL DEFAULT 0, no_count INTEGER NOT NULL DEFAULT 0,
    abstain_count INTEGER NOT NULL DEFAULT 0, project_wallet_id TEXT,
    created_at INTEGER NOT NULL, closes_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS gaigs_votes (
    proposal_id TEXT NOT NULL, user_id TEXT NOT NULL, choice TEXT NOT NULL,
    vote_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL,
    PRIMARY KEY(proposal_id, user_id),
    FOREIGN KEY(proposal_id) REFERENCES gaigs_proposals(id),
    FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS gaigs_project_wallets (
    id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL UNIQUE, currency TEXT NOT NULL DEFAULT 'GCR',
    available INTEGER NOT NULL DEFAULT 0, reserved INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'approved-unfunded', created_at INTEGER NOT NULL,
    FOREIGN KEY(proposal_id) REFERENCES gaigs_proposals(id)
  )`,
  `CREATE TABLE IF NOT EXISTS gaigs_device_keys (
    user_id TEXT NOT NULL, device_id TEXT NOT NULL, device_label TEXT NOT NULL,
    encryption_public_jwk TEXT NOT NULL, signing_public_jwk TEXT NOT NULL,
    created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, revoked_at INTEGER,
    PRIMARY KEY(user_id, device_id), FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS gaigs_private_messages (
    id TEXT PRIMARY KEY, client_message_id TEXT NOT NULL, conversation_id TEXT NOT NULL,
    sender_user_id TEXT NOT NULL, recipient_user_id TEXT NOT NULL, sender_device_id TEXT NOT NULL,
    message_kind TEXT NOT NULL, recipient_envelope TEXT NOT NULL, sender_envelope TEXT NOT NULL,
    reply_to TEXT, previous_hash TEXT NOT NULL, message_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL, delivered_at INTEGER, read_at INTEGER,
    FOREIGN KEY(sender_user_id) REFERENCES gaigs_users(id),
    FOREIGN KEY(recipient_user_id) REFERENCES gaigs_users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS gaigs_room_messages (
    id TEXT PRIMARY KEY, room_type TEXT NOT NULL, room_key TEXT NOT NULL,
    user_id TEXT NOT NULL, display_name TEXT NOT NULL, body TEXT NOT NULL,
    reply_to TEXT, previous_hash TEXT NOT NULL, message_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL, FOREIGN KEY(user_id) REFERENCES gaigs_users(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_gaigs_sessions_user_expiry ON gaigs_sessions(user_id, expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_gaigs_ledger_wallet_time ON gaigs_ledger_entries(wallet_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_gaigs_posts_scope_time ON gaigs_posts(scope, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_gaigs_proposals_scope_time ON gaigs_proposals(scope, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_gaigs_device_keys_user_seen ON gaigs_device_keys(user_id, last_seen_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_gaigs_private_client_sender ON gaigs_private_messages(sender_user_id, client_message_id)`,
  `CREATE INDEX IF NOT EXISTS idx_gaigs_private_recipient_time ON gaigs_private_messages(recipient_user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_gaigs_private_sender_time ON gaigs_private_messages(sender_user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_gaigs_private_conversation_time ON gaigs_private_messages(conversation_id, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_gaigs_private_chain_tip ON gaigs_private_messages(conversation_id, previous_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_gaigs_rooms_scope_time ON gaigs_room_messages(room_type, room_key, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_gaigs_rooms_chain_tip ON gaigs_room_messages(room_type, room_key, previous_hash)`,
];

function allowedProductOrigin(request) {
  const origin = request.headers.get("origin") || "";
  const own = new URL(request.url).origin;
  return origin === own || origin === "https://localhost" || origin === "capacitor://localhost" || origin === "http://localhost" ? origin : own;
}

function productHeaders(request, extra = {}) {
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "access-control-allow-origin": allowedProductOrigin(request),
    "access-control-allow-credentials": "true",
    "vary": "Origin",
    ...extra,
  };
}

function productJson(request, value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), { status, headers: productHeaders(request, extra) });
}

function clean(value, limit = 300) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalizedEmail(value) {
  return clean(value, 254).toLowerCase();
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function randomHex(size = 24) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(size)));
}

function productId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${randomHex(8)}`;
}

async function sha256(value) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value))));
}

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

async function passwordDigest(password, saltHex, iterations = PASSWORD_ITERATIONS) {
  const passwordKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = new Uint8Array((saltHex.match(/.{1,2}/g) || []).map(part => parseInt(part, 16)));
  return bytesToHex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, passwordKey, 256));
}

async function constantEqual(left, right) {
  const [a, b] = await Promise.all([sha256(left), sha256(right)]);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

async function ensureProductSchema(env) {
  if (productSchemaReady) return;
  if (!env.DB) throw new Error("Product database is unavailable.");
  await env.DB.batch(PRODUCT_SCHEMA.map(statement => env.DB.prepare(statement)));
  productSchemaReady = true;
}

function sessionCookie(token, maxAge) {
  return `${PRODUCT_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function readCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

function readBearer(request) {
  return (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

async function createSession(env, userId) {
  const token = randomHex(32);
  const tokenHash = await sha256(token);
  const now = Date.now();
  const expiresAt = now + SESSION_DAYS * 86400000;
  await env.DB.prepare("INSERT INTO gaigs_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)")
    .bind(tokenHash, userId, now, expiresAt).run();
  return { token, expiresAt };
}

async function authenticatedUser(request, env) {
  const token = readBearer(request) || readCookie(request, PRODUCT_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = Date.now();
  const row = await env.DB.prepare(`SELECT u.id,u.email,u.full_name,u.phone,u.cnic_last4,u.country,u.city,
      u.email_verified,u.kyc_status,p.display_name,p.bio,p.skills,p.avatar_key,p.location_public,p.lat_approx,p.lng_approx
    FROM gaigs_sessions s JOIN gaigs_users u ON u.id=s.user_id
    JOIN gaigs_profiles p ON p.user_id=u.id
    WHERE s.token_hash=? AND s.expires_at>?`).bind(tokenHash, now).first();
  return row ? { ...row, sessionHash: tokenHash } : null;
}

function publicUser(row) {
  return {
    uid: row.id,
    name: row.display_name || row.full_name,
    email: row.email,
    phone: row.phone,
    country: row.country,
    city: row.city,
    skills: row.skills || "",
    bio: row.bio || "",
    avatarUrl: row.avatar_key ? `/api/media/${encodeURIComponent(row.avatar_key)}` : "",
    locationPublic: Boolean(row.location_public),
    lat: row.lat_approx == null ? null : Number(row.lat_approx),
    lng: row.lng_approx == null ? null : Number(row.lng_approx),
    cnicLast4: row.cnic_last4,
    emailVerified: Boolean(row.email_verified),
    kycStatus: row.kyc_status,
    accountMode: "sites",
  };
}

function publicWallet(row) {
  return row ? { id: row.id, currency: row.currency, available: Number(row.available), reserved: Number(row.reserved), status: row.status, createdAt: new Date(Number(row.created_at)).toISOString() } : null;
}

async function walletForUser(env, userId) {
  return env.DB.prepare("SELECT * FROM gaigs_wallets WHERE user_id=?").bind(userId).first();
}

async function latestLedgerHash(env, walletId) {
  const row = await env.DB.prepare("SELECT entry_hash FROM gaigs_ledger_entries WHERE wallet_id=? ORDER BY created_at DESC,id DESC LIMIT 1").bind(walletId).first();
  return row?.entry_hash || ZERO_HASH;
}

async function ledgerRecord({ id, walletId, direction, amount, type, counterpartyWalletId = null, referenceId = null, description, previousHash, createdAt }) {
  const canonical = [id, walletId, direction, amount, type, counterpartyWalletId || "", referenceId || "", description, previousHash, createdAt].join("|");
  return { id, walletId, direction, amount, type, counterpartyWalletId, referenceId, description, previousHash, entryHash: await sha256(canonical), createdAt };
}

function ledgerInsert(env, record) {
  return env.DB.prepare(`INSERT INTO gaigs_ledger_entries
    (id,wallet_id,direction,amount,entry_type,counterparty_wallet_id,reference_id,description,previous_hash,entry_hash,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(record.id, record.walletId, record.direction, record.amount, record.type,
      record.counterpartyWalletId, record.referenceId, record.description, record.previousHash, record.entryHash, record.createdAt);
}

async function requestBody(request, limit = 20000) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > limit) throw new Error("Request is too large.");
  return request.json();
}

function requireAppRequest(request) {
  return request.headers.get("x-gaigs-request") === "app" || Boolean(readBearer(request));
}

async function registerAccount(request, env) {
  if (!env.APP_KYC_PEPPER) return productJson(request, { error: "Identity protection is not configured." }, 503);
  let body;
  try { body = await requestBody(request); } catch (error) { return productJson(request, { error: error.message || "Invalid registration." }, 400); }
  const fullName = clean(body.fullName, 100), email = normalizedEmail(body.email), phone = clean(body.phone, 30);
  const password = String(body.password || ""), cnic = String(body.cnic || "").replace(/\D/g, "");
  const country = clean(body.country, 80), city = clean(body.city, 80);
  if (fullName.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || phone.length < 7 || password.length < 10 || cnic.length !== 13 || !country || !city) {
    return productJson(request, { error: "Use a valid name, email, phone, 13-digit CNIC, city and a password of at least 10 characters." }, 400);
  }
  const cnicHash = await hmacHex(env.APP_KYC_PEPPER, cnic);
  const existing = await env.DB.prepare("SELECT id FROM gaigs_users WHERE email=? OR cnic_hash=?").bind(email, cnicHash).first();
  if (existing) return productJson(request, { error: "An account already exists for this email or identity." }, 409);
  const now = Date.now(), userId = productId("usr"), walletId = `GAIGS-${randomHex(6).toUpperCase()}`;
  const salt = randomHex(16), passwordHash = await passwordDigest(password, salt);
  const sessionToken = randomHex(32), sessionHash = await sha256(sessionToken), sessionExpiry = now + SESSION_DAYS * 86400000;
  const genesis = await ledgerRecord({ id: productId("led"), walletId, direction: "credit", amount: 100, type: "welcome", referenceId: userId, description: "Founding account impact credits", previousHash: ZERO_HASH, createdAt: now });
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO gaigs_users
        (id,email,password_hash,password_salt,password_iterations,full_name,phone,cnic_hash,cnic_last4,country,city,email_verified,kyc_status,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(userId, email, passwordHash, salt, PASSWORD_ITERATIONS, fullName, phone, cnicHash, cnic.slice(-4), country, city, 0, "pending", now),
      env.DB.prepare("INSERT INTO gaigs_profiles (user_id,display_name,bio,skills,location_public,updated_at) VALUES (?,?,?,?,?,?)").bind(userId, fullName, "", "", 0, now),
      env.DB.prepare("INSERT INTO gaigs_wallets (id,user_id,currency,available,reserved,status,created_at) VALUES (?,?,?,?,?,?,?)").bind(walletId, userId, "GCR", 100, 0, "mvp", now),
      ledgerInsert(env, genesis),
      env.DB.prepare("INSERT INTO gaigs_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)").bind(sessionHash, userId, now, sessionExpiry),
    ]);
  } catch (error) {
    return productJson(request, { error: "Account could not be created. Check whether the email is already registered." }, 409);
  }
  const userRow = await env.DB.prepare(`SELECT u.*,p.display_name,p.bio,p.skills,p.avatar_key,p.location_public,p.lat_approx,p.lng_approx FROM gaigs_users u JOIN gaigs_profiles p ON p.user_id=u.id WHERE u.id=?`).bind(userId).first();
  const payload = { ok: true, user: publicUser(userRow), wallet: publicWallet({ id: walletId, currency: "GCR", available: 100, reserved: 0, status: "mvp", created_at: now }), verification: { email: "pending-provider", identity: "pending-review" }, ...(request.headers.get("x-gaigs-client") === "native" ? { sessionToken } : {}) };
  return productJson(request, payload, 201, { "set-cookie": sessionCookie(sessionToken, SESSION_DAYS * 86400) });
}

async function loginAccount(request, env) {
  let body;
  try { body = await requestBody(request); } catch (error) { return productJson(request, { error: "Invalid login request." }, 400); }
  const email = normalizedEmail(body.email), password = String(body.password || "");
  const row = await env.DB.prepare(`SELECT u.*,p.display_name,p.bio,p.skills,p.avatar_key,p.location_public,p.lat_approx,p.lng_approx FROM gaigs_users u JOIN gaigs_profiles p ON p.user_id=u.id WHERE u.email=?`).bind(email).first();
  if (!row) return productJson(request, { error: "Email or password is incorrect." }, 401);
  const candidate = await passwordDigest(password, row.password_salt, Number(row.password_iterations));
  if (!(await constantEqual(candidate, row.password_hash))) return productJson(request, { error: "Email or password is incorrect." }, 401);
  const session = await createSession(env, row.id);
  await env.DB.prepare("UPDATE gaigs_users SET last_login_at=? WHERE id=?").bind(Date.now(), row.id).run();
  const wallet = await walletForUser(env, row.id);
  return productJson(request, { ok: true, user: publicUser(row), wallet: publicWallet(wallet), ...(request.headers.get("x-gaigs-client") === "native" ? { sessionToken: session.token } : {}) }, 200, { "set-cookie": sessionCookie(session.token, SESSION_DAYS * 86400) });
}

async function accountSnapshot(request, env, user) {
  const wallet = await walletForUser(env, user.id);
  const ledger = await env.DB.prepare("SELECT * FROM gaigs_ledger_entries WHERE wallet_id=? ORDER BY created_at DESC,id DESC LIMIT 50").bind(wallet.id).all();
  return productJson(request, { ok: true, user: publicUser(user), wallet: publicWallet(wallet), transactions: (ledger.results || []).map(row => ({ id: row.id, date: new Date(Number(row.created_at)).toLocaleDateString("en-GB"), type: row.entry_type, desc: row.description, amount: row.direction === "credit" ? Number(row.amount) : -Number(row.amount), proof: `SHA-256 ${String(row.entry_hash).slice(0, 16)}…`, entryHash: row.entry_hash, previousHash: row.previous_hash, currency: "GCR" })) });
}

async function updateProfile(request, env, user) {
  let body;
  try { body = await requestBody(request); } catch (error) { return productJson(request, { error: "Invalid profile update." }, 400); }
  const name = clean(body.name || user.display_name, 100), city = clean(body.city || user.city, 80), country = clean(body.country || user.country, 80);
  const skills = clean(body.skills, 800), bio = clean(body.bio, 1500), locationPublic = body.locationPublic ? 1 : 0;
  const lat = Number.isFinite(Number(body.lat)) ? Math.round(Number(body.lat) * 1000) / 1000 : null;
  const lng = Number.isFinite(Number(body.lng)) ? Math.round(Number(body.lng) * 1000) / 1000 : null;
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE gaigs_users SET full_name=?,city=?,country=? WHERE id=?").bind(name, city, country, user.id),
    env.DB.prepare("UPDATE gaigs_profiles SET display_name=?,bio=?,skills=?,location_public=?,lat_approx=?,lng_approx=?,updated_at=? WHERE user_id=?").bind(name, bio, skills, locationPublic, lat, lng, now, user.id),
  ]);
  const updated = await env.DB.prepare(`SELECT u.*,p.display_name,p.bio,p.skills,p.avatar_key,p.location_public,p.lat_approx,p.lng_approx FROM gaigs_users u JOIN gaigs_profiles p ON p.user_id=u.id WHERE u.id=?`).bind(user.id).first();
  return productJson(request, { ok: true, user: publicUser(updated) });
}

async function uploadMedia(request, env, user, purpose = "post") {
  if (!env.UPLOADS) return productJson(request, { error: "Media storage is unavailable." }, 503);
  let form;
  try { form = await request.formData(); } catch (error) { return productJson(request, { error: "Invalid upload." }, 400); }
  const file = form.get("file");
  if (!file || typeof file.stream !== "function") return productJson(request, { error: "Choose an image or video." }, 400);
  const type = String(file.type || "").toLowerCase();
  const allowed = purpose === "avatar" ? type.startsWith("image/") : (type.startsWith("image/") || type.startsWith("video/"));
  const limit = purpose === "avatar" ? 5 * 1024 * 1024 : (type.startsWith("video/") ? 40 * 1024 * 1024 : 12 * 1024 * 1024);
  if (!allowed || file.size < 1 || file.size > limit) return productJson(request, { error: `Use a supported ${purpose === "avatar" ? "image" : "image/video"} within ${Math.round(limit / 1048576)} MB.` }, 400);
  const extension = (clean(file.name, 160).split(".").pop() || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
  const uploadId = productId("upl"), objectKey = `public/${user.id}/${uploadId}.${extension}`;
  await env.UPLOADS.put(objectKey, file.stream(), { httpMetadata: { contentType: type, cacheControl: "public, max-age=86400" }, customMetadata: { owner: user.id, purpose } });
  await env.DB.prepare("INSERT INTO gaigs_uploads (id,user_id,object_key,media_type,original_name,byte_size,purpose,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .bind(uploadId, user.id, objectKey, type, clean(file.name, 160), Number(file.size), purpose, Date.now()).run();
  if (purpose === "avatar") await env.DB.prepare("UPDATE gaigs_profiles SET avatar_key=?,updated_at=? WHERE user_id=?").bind(objectKey, Date.now(), user.id).run();
  return productJson(request, { ok: true, upload: { id: uploadId, mediaType: type, name: clean(file.name, 160), size: Number(file.size), url: `/api/media/${encodeURIComponent(objectKey)}` }, ...(purpose === "avatar" ? { avatarUrl: `/api/media/${encodeURIComponent(objectKey)}` } : {}) }, 201);
}

async function serveMedia(request, env, encodedKey) {
  if (!env.UPLOADS) return new Response("Media storage unavailable", { status: 503 });
  const key = decodeURIComponent(encodedKey || "");
  if (!key.startsWith("public/") || key.includes("..")) return new Response("Not found", { status: 404 });
  const record = await env.DB.prepare("SELECT media_type FROM gaigs_uploads WHERE object_key=?").bind(key).first();
  if (!record) return new Response("Not found", { status: 404 });
  const object = await env.UPLOADS.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers(); object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag); headers.set("cache-control", "public, max-age=86400"); headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}

function rewardForPost(type) {
  const key = String(type || "").toLowerCase();
  if (key === "solution") return 20;
  if (key === "problem") return 10;
  if (key === "evidence") return 5;
  return 0;
}

async function createPost(request, env, user) {
  let body;
  try { body = await requestBody(request, 30000); } catch (error) { return productJson(request, { error: error.message || "Invalid post." }, 400); }
  const postType = clean(body.type, 40), scope = clean(body.scope, 30), text = clean(body.text, 5000), location = clean(body.location, 180);
  if (!postType || !["Society", "City", "Country", "Global"].includes(scope) || text.length < 3) return productJson(request, { error: "Choose a valid type, scope and message." }, 400);
  let upload = null;
  if (body.uploadId) {
    upload = await env.DB.prepare("SELECT * FROM gaigs_uploads WHERE id=? AND user_id=? AND purpose='post'").bind(clean(body.uploadId, 100), user.id).first();
    if (!upload) return productJson(request, { error: "The media upload is invalid." }, 400);
  }
  const now = Date.now(), postId = productId("post"), wallet = await walletForUser(env, user.id);
  const requestedReward = rewardForPost(postType);
  const since = now - 86400000;
  const rewarded = await env.DB.prepare("SELECT COALESCE(SUM(amount),0) total FROM gaigs_reward_events WHERE user_id=? AND created_at>?").bind(user.id, since).first();
  const reward = Math.max(0, Math.min(requestedReward, 50 - Number(rewarded?.total || 0)));
  const statements = [env.DB.prepare(`INSERT INTO gaigs_posts
      (id,user_id,display_name,post_type,scope,body,location_label,lat_approx,lng_approx,upload_id,reward_credits,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(postId, user.id, user.display_name, postType, scope, text, location,
        Number.isFinite(Number(body.lat)) ? Math.round(Number(body.lat) * 1000) / 1000 : null,
        Number.isFinite(Number(body.lng)) ? Math.round(Number(body.lng) * 1000) / 1000 : null,
        upload?.id || null, reward, now)];
  let ledger = null;
  if (reward > 0) {
    ledger = await ledgerRecord({ id: productId("led"), walletId: wallet.id, direction: "credit", amount: reward, type: "impact-reward", referenceId: postId, description: `${postType} contribution reward`, previousHash: await latestLedgerHash(env, wallet.id), createdAt: now });
    statements.push(env.DB.prepare("UPDATE gaigs_wallets SET available=available+? WHERE id=?").bind(reward, wallet.id));
    statements.push(ledgerInsert(env, ledger));
    statements.push(env.DB.prepare("INSERT INTO gaigs_reward_events (id,user_id,post_id,amount,reason,created_at) VALUES (?,?,?,?,?,?)").bind(productId("reward"), user.id, postId, reward, `${postType} contribution`, now));
  }
  await env.DB.batch(statements);
  const updatedWallet = await walletForUser(env, user.id);
  return productJson(request, { ok: true, post: { id: postId, name: user.display_name, initials: user.display_name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(), scope, time: "Just now", type: postType, text, location, media: upload?.original_name || "No media attached", mediaUrl: upload ? `/api/media/${encodeURIComponent(upload.object_key)}` : "", mediaType: upload?.media_type || "", reward }, wallet: publicWallet(updatedWallet), ledgerReceipt: ledger?.entryHash || null }, 201);
}

async function listPosts(request, env) {
  const url = new URL(request.url), scope = clean(url.searchParams.get("scope"), 30);
  const query = scope ? `SELECT p.*,u.object_key,u.media_type,u.original_name FROM gaigs_posts p LEFT JOIN gaigs_uploads u ON u.id=p.upload_id WHERE p.scope=? ORDER BY p.created_at DESC LIMIT 100` : `SELECT p.*,u.object_key,u.media_type,u.original_name FROM gaigs_posts p LEFT JOIN gaigs_uploads u ON u.id=p.upload_id ORDER BY p.created_at DESC LIMIT 100`;
  const rows = scope ? await env.DB.prepare(query).bind(scope).all() : await env.DB.prepare(query).all();
  return productJson(request, { posts: (rows.results || []).map(row => ({ id: row.id, name: row.display_name, initials: row.display_name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(), scope: row.scope, time: new Date(Number(row.created_at)).toLocaleString("en-GB"), type: row.post_type, text: row.body, location: row.location_label, media: row.original_name || "No media attached", mediaUrl: row.object_key ? `/api/media/${encodeURIComponent(row.object_key)}` : "", mediaType: row.media_type || "", reward: Number(row.reward_credits || 0) })) });
}

async function transferCredits(request, env, user) {
  let body;
  try { body = await requestBody(request); } catch (error) { return productJson(request, { error: "Invalid transfer." }, 400); }
  const recipientId = clean(body.recipientWalletId, 60).toUpperCase(), amount = Math.floor(Number(body.amount)), purpose = clean(body.purpose, 180);
  if (!recipientId || !Number.isSafeInteger(amount) || amount < 1 || amount > 100000 || purpose.length < 3) return productJson(request, { error: "Enter a valid wallet, amount and purpose." }, 400);
  const sender = await walletForUser(env, user.id), recipient = await env.DB.prepare("SELECT * FROM gaigs_wallets WHERE id=?").bind(recipientId).first();
  if (!recipient || recipient.id === sender.id) return productJson(request, { error: "Recipient wallet was not found." }, 404);
  if (Number(sender.available) < amount) return productJson(request, { error: "Insufficient GAIGS Credits." }, 409);
  const now = Date.now(), transferId = productId("transfer");
  const debit = await ledgerRecord({ id: productId("led"), walletId: sender.id, direction: "debit", amount, type: "transfer", counterpartyWalletId: recipient.id, referenceId: transferId, description: purpose, previousHash: await latestLedgerHash(env, sender.id), createdAt: now });
  const credit = await ledgerRecord({ id: productId("led"), walletId: recipient.id, direction: "credit", amount, type: "transfer", counterpartyWalletId: sender.id, referenceId: transferId, description: purpose, previousHash: await latestLedgerHash(env, recipient.id), createdAt: now });
  await env.DB.batch([
    env.DB.prepare("UPDATE gaigs_wallets SET available=available-? WHERE id=? AND available>=?").bind(amount, sender.id, amount),
    env.DB.prepare("UPDATE gaigs_wallets SET available=available+? WHERE id=?").bind(amount, recipient.id),
    ledgerInsert(env, debit), ledgerInsert(env, credit),
  ]);
  return productJson(request, { ok: true, transferId, wallet: publicWallet(await walletForUser(env, user.id)), receipt: debit.entryHash, notice: "Closed-loop GAIGS Credits only; no fiat or cryptocurrency moved." });
}

async function verifyWalletLedger(request, env, user) {
  const wallet = await walletForUser(env, user.id);
  const rows = await env.DB.prepare("SELECT * FROM gaigs_ledger_entries WHERE wallet_id=? ORDER BY created_at ASC,id ASC").bind(wallet.id).all();
  let previous = ZERO_HASH, valid = true, checked = 0;
  for (const row of rows.results || []) {
    const expected = await ledgerRecord({ id: row.id, walletId: row.wallet_id, direction: row.direction, amount: Number(row.amount), type: row.entry_type, counterpartyWalletId: row.counterparty_wallet_id, referenceId: row.reference_id, description: row.description, previousHash: row.previous_hash, createdAt: Number(row.created_at) });
    if (row.previous_hash !== previous || expected.entryHash !== row.entry_hash) valid = false;
    previous = row.entry_hash; checked += 1;
  }
  return productJson(request, { ok: true, valid, checked, headHash: previous, ledger: "D1 append-only SHA-256 chain", publicBlockchainAnchor: null, notice: "This MVP ledger is tamper-evident but not yet anchored to a public blockchain." });
}

async function createProposalRecord(request, env, user) {
  let body;
  try { body = await requestBody(request, 30000); } catch (error) { return productJson(request, { error: "Invalid proposal." }, 400); }
  const title = clean(body.title, 160), scope = clean(body.scope, 30), description = clean(body.description, 5000), evidence = clean(body.evidence, 1200);
  const budget = Math.max(0, Math.floor(Number(body.budget || 0)));
  if (title.length < 5 || !["Society", "City", "Country", "Global"].includes(scope) || description.length < 20 || evidence.length < 5) return productJson(request, { error: "Add a clear title, scope, problem/solution and evidence." }, 400);
  const now = Date.now(), id = productId("proposal"), closes = now + 7 * 86400000;
  await env.DB.prepare(`INSERT INTO gaigs_proposals
    (id,user_id,title,scope,description,evidence,budget_credits,rules_version,status,created_at,closes_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id, user.id, title, scope, description, evidence, budget, "GAIGS-GOV-2026-1", "voting", now, closes).run();
  return productJson(request, { ok: true, proposal: { id, title, scope, summary: description, evidence: 1, budget, rulesVersion: "GAIGS-GOV-2026-1", status: "Voting", yes: 0, no: 0, abstain: 0, eligibleCount: 0, turnout: 0, deadline: new Date(closes).toLocaleString("en-GB"), closesAt: new Date(closes).toISOString(), risk: "JARVIS review pending" } }, 201);
}

async function listProposals(request, env) {
  const rows = await env.DB.prepare("SELECT * FROM gaigs_proposals ORDER BY created_at DESC LIMIT 100").all();
  return productJson(request, { proposals: (rows.results || []).map(row => ({ id: row.id, title: row.title, scope: row.scope, summary: row.description, evidence: 1, budget: Number(row.budget_credits), rulesVersion: row.rules_version, status: row.status === "voting" ? "Voting" : row.status === "approved" ? "Approved" : row.status, yes: Number(row.yes_count), no: Number(row.no_count), abstain: Number(row.abstain_count), eligibleCount: Math.max(2, Number(row.yes_count) + Number(row.no_count) + Number(row.abstain_count)), turnout: 0, deadline: new Date(Number(row.closes_at)).toLocaleString("en-GB"), closesAt: new Date(Number(row.closes_at)).toISOString(), risk: "Rules engine", projectWalletId: row.project_wallet_id || null })) });
}

async function castVote(request, env, user, proposalId) {
  let body;
  try { body = await requestBody(request); } catch (error) { return productJson(request, { error: "Invalid ballot." }, 400); }
  const choice = clean(body.choice, 20).toLowerCase();
  if (!["yes", "no", "abstain"].includes(choice)) return productJson(request, { error: "Invalid ballot choice." }, 400);
  const proposal = await env.DB.prepare("SELECT * FROM gaigs_proposals WHERE id=?").bind(proposalId).first();
  if (!proposal || proposal.status !== "voting" || Number(proposal.closes_at) <= Date.now()) return productJson(request, { error: "This proposal is not open for voting." }, 409);
  const now = Date.now(), voteHash = await sha256([proposalId, user.id, choice, now, randomHex(8)].join("|"));
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO gaigs_votes (proposal_id,user_id,choice,vote_hash,created_at) VALUES (?,?,?,?,?)").bind(proposalId, user.id, choice, voteHash, now),
      env.DB.prepare(`UPDATE gaigs_proposals SET ${choice === "yes" ? "yes_count=yes_count+1" : choice === "no" ? "no_count=no_count+1" : "abstain_count=abstain_count+1"} WHERE id=?`).bind(proposalId),
    ]);
  } catch (error) {
    return productJson(request, { error: "This account already voted on this proposal." }, 409);
  }
  let updated = await env.DB.prepare("SELECT * FROM gaigs_proposals WHERE id=?").bind(proposalId).first();
  const cast = Number(updated.yes_count) + Number(updated.no_count) + Number(updated.abstain_count);
  if (cast >= 2 && Number(updated.yes_count) > Number(updated.no_count) && !updated.project_wallet_id) {
    const projectWalletId = `PROJECT-${randomHex(6).toUpperCase()}`;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO gaigs_project_wallets (id,proposal_id,currency,available,reserved,status,created_at) VALUES (?,?,?,?,?,?,?)").bind(projectWalletId, proposalId, "GCR", 0, 0, "approved-unfunded", now),
      env.DB.prepare("UPDATE gaigs_proposals SET status='approved',project_wallet_id=? WHERE id=?").bind(projectWalletId, proposalId),
    ]);
    updated = await env.DB.prepare("SELECT * FROM gaigs_proposals WHERE id=?").bind(proposalId).first();
  }
  return productJson(request, { ok: true, receipt: voteHash, tally: { yes: Number(updated.yes_count), no: Number(updated.no_count), abstain: Number(updated.abstain_count) }, status: updated.status, projectWalletId: updated.project_wallet_id || null, rulesVersion: updated.rules_version });
}

function safeJwk(value, purpose) {
  if (!value || typeof value !== "object" || value.kty !== "EC" || value.crv !== "P-256" || !value.x || !value.y || value.d) {
    throw new Error(`A public P-256 ${purpose} key is required.`);
  }
  const jwk = { kty: "EC", crv: "P-256", x: clean(value.x, 200), y: clean(value.y, 200), ext: true };
  if (purpose === "signing") jwk.key_ops = ["verify"];
  else jwk.key_ops = [];
  return JSON.stringify(jwk);
}

function safeEnvelope(value) {
  if (!value || typeof value !== "object" || Number(value.v) !== 1 || value.alg !== "ECDH-P256-AESGCM") throw new Error("Unsupported encrypted message envelope.");
  const ciphertext = String(value.ciphertext || ""), iv = String(value.iv || ""), salt = String(value.salt || "");
  if (!/^[A-Za-z0-9+/=_-]{16,60000}$/.test(ciphertext) || !/^[A-Za-z0-9+/=_-]{12,80}$/.test(iv) || !/^[A-Za-z0-9+/=_-]{12,100}$/.test(salt)) throw new Error("Encrypted message envelope is malformed.");
  const ephemeralKey = JSON.parse(safeJwk(value.ephemeralKey, "encryption"));
  const envelope = { v: 1, alg: "ECDH-P256-AESGCM", ciphertext, iv, salt, ephemeralKey };
  const encoded = JSON.stringify(envelope);
  if (encoded.length > 70000) throw new Error("Encrypted message is too large.");
  return encoded;
}

async function registerMessagingDevice(request, env, user) {
  let body;
  try { body = await requestBody(request, 20000); } catch (error) { return productJson(request, { error: error.message || "Invalid device key." }, 400); }
  const deviceId = clean(body.deviceId, 120), deviceLabel = clean(body.deviceLabel, 100) || "GAIGS device";
  if (!/^[A-Za-z0-9_.:-]{8,120}$/.test(deviceId)) return productJson(request, { error: "A stable device ID is required." }, 400);
  let encryptionKey, signingKey;
  try { encryptionKey = safeJwk(body.encryptionPublicKey, "encryption"); signingKey = safeJwk(body.signingPublicKey, "signing"); }
  catch (error) { return productJson(request, { error: error.message }, 400); }
  const now = Date.now();
  await env.DB.prepare(`INSERT INTO gaigs_device_keys
    (user_id,device_id,device_label,encryption_public_jwk,signing_public_jwk,created_at,last_seen_at,revoked_at)
    VALUES (?,?,?,?,?,?,?,NULL)
    ON CONFLICT(user_id,device_id) DO UPDATE SET device_label=excluded.device_label,
      encryption_public_jwk=excluded.encryption_public_jwk,signing_public_jwk=excluded.signing_public_jwk,
      last_seen_at=excluded.last_seen_at,revoked_at=NULL`)
    .bind(user.id, deviceId, deviceLabel, encryptionKey, signingKey, now, now).run();
  return productJson(request, { ok: true, device: { deviceId, deviceLabel, registeredAt: new Date(now).toISOString() } });
}

async function listMessagingContacts(request, env, user) {
  const url = new URL(request.url), query = clean(url.searchParams.get("q"), 80), like = `%${query.replace(/[%_]/g, "")} %`.replace(" %", "%");
  const rows = query
    ? await env.DB.prepare(`SELECT u.id,u.country,u.city,p.display_name,p.skills,p.avatar_key,
        COUNT(k.device_id) AS device_count FROM gaigs_users u JOIN gaigs_profiles p ON p.user_id=u.id
        LEFT JOIN gaigs_device_keys k ON k.user_id=u.id AND k.revoked_at IS NULL
        WHERE u.id<>? AND (p.display_name LIKE ? OR p.skills LIKE ? OR u.city LIKE ?)
        GROUP BY u.id ORDER BY p.display_name LIMIT 30`).bind(user.id, like, like, like).all()
    : await env.DB.prepare(`SELECT u.id,u.country,u.city,p.display_name,p.skills,p.avatar_key,
        COUNT(k.device_id) AS device_count FROM gaigs_users u JOIN gaigs_profiles p ON p.user_id=u.id
        LEFT JOIN gaigs_device_keys k ON k.user_id=u.id AND k.revoked_at IS NULL
        WHERE u.id<>? AND (u.city=? OR u.country=?) GROUP BY u.id
        ORDER BY CASE WHEN u.city=? THEN 0 ELSE 1 END,p.display_name LIMIT 30`).bind(user.id, user.city, user.country, user.city).all();
  return productJson(request, { contacts: (rows.results || []).map(row => ({
    id: row.id, name: row.display_name, city: row.city, country: row.country,
    skills: row.skills || "", avatarUrl: row.avatar_key ? `/api/media/${encodeURIComponent(row.avatar_key)}` : "",
    encryptedMessagingReady: Number(row.device_count || 0) > 0,
  })) });
}

async function messagingKeys(request, env, userId) {
  const target = await env.DB.prepare("SELECT id FROM gaigs_users WHERE id=?").bind(userId).first();
  if (!target) return productJson(request, { error: "Member not found." }, 404);
  const rows = await env.DB.prepare(`SELECT device_id,device_label,encryption_public_jwk,signing_public_jwk,last_seen_at
    FROM gaigs_device_keys WHERE user_id=? AND revoked_at IS NULL ORDER BY last_seen_at DESC LIMIT 8`).bind(userId).all();
  return productJson(request, { userId, devices: (rows.results || []).map(row => ({
    deviceId: row.device_id, deviceLabel: row.device_label,
    encryptionPublicKey: JSON.parse(row.encryption_public_jwk), signingPublicKey: JSON.parse(row.signing_public_jwk),
    lastSeenAt: new Date(Number(row.last_seen_at)).toISOString(),
  })) });
}

async function sendPrivateMessage(request, env, user) {
  let body;
  try { body = await requestBody(request, 160000); } catch (error) { return productJson(request, { error: error.message || "Invalid encrypted message." }, 400); }
  const recipientId = clean(body.recipientId, 120), senderDeviceId = clean(body.senderDeviceId, 120);
  const clientMessageId = clean(body.clientMessageId, 160), kind = clean(body.kind || "text", 30), replyTo = clean(body.replyTo, 160) || null;
  if (!recipientId || recipientId === user.id || !clientMessageId || !senderDeviceId || !["text", "problem", "proposal", "location", "system"].includes(kind)) return productJson(request, { error: "Invalid private message metadata." }, 400);
  const [recipient, senderDevice] = await Promise.all([
    env.DB.prepare("SELECT id FROM gaigs_users WHERE id=?").bind(recipientId).first(),
    env.DB.prepare("SELECT device_id FROM gaigs_device_keys WHERE user_id=? AND device_id=? AND revoked_at IS NULL").bind(user.id, senderDeviceId).first(),
  ]);
  if (!recipient) return productJson(request, { error: "Recipient not found." }, 404);
  if (!senderDevice) return productJson(request, { error: "Register this device before sending encrypted messages." }, 409);
  let recipientEnvelope, senderEnvelope;
  try { recipientEnvelope = safeEnvelope(body.recipientEnvelope); senderEnvelope = safeEnvelope(body.senderEnvelope); }
  catch (error) { return productJson(request, { error: error.message }, 400); }
  const pair = [user.id, recipientId].sort(), conversationId = `dm_${(await sha256(pair.join("|"))).slice(0, 32)}`;
  const prior = await env.DB.prepare("SELECT message_hash FROM gaigs_private_messages WHERE conversation_id=? ORDER BY created_at DESC,id DESC LIMIT 1").bind(conversationId).first();
  const previousHash = prior?.message_hash || ZERO_HASH, now = Date.now(), id = productId("msg");
  const envelopeHash = await sha256(`${recipientEnvelope}|${senderEnvelope}`);
  const messageHash = await sha256([id, conversationId, user.id, recipientId, senderDeviceId, kind, envelopeHash, replyTo || "", previousHash, now].join("|"));
  try {
    await env.DB.prepare(`INSERT INTO gaigs_private_messages
      (id,client_message_id,conversation_id,sender_user_id,recipient_user_id,sender_device_id,message_kind,
       recipient_envelope,sender_envelope,reply_to,previous_hash,message_hash,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, clientMessageId, conversationId, user.id, recipientId, senderDeviceId,
        kind, recipientEnvelope, senderEnvelope, replyTo, previousHash, messageHash, now).run();
  } catch (error) {
    const existing = await env.DB.prepare("SELECT id,conversation_id,message_hash,created_at FROM gaigs_private_messages WHERE sender_user_id=? AND client_message_id=?").bind(user.id, clientMessageId).first();
    if (existing) return productJson(request, { ok: true, duplicate: true, message: { id: existing.id, conversationId: existing.conversation_id, receipt: existing.message_hash, createdAt: new Date(Number(existing.created_at)).toISOString() } });
    return productJson(request, { error: "Encrypted message could not be queued." }, 409);
  }
  return productJson(request, { ok: true, message: { id, clientMessageId, conversationId, receipt: messageHash, previousHash, status: "queued", createdAt: new Date(now).toISOString() } }, 201);
}

async function listPrivateMessages(request, env, user) {
  const url = new URL(request.url), after = Math.max(0, Number(url.searchParams.get("after") || 0));
  const rows = await env.DB.prepare(`SELECT m.*,sp.display_name AS sender_name,rp.display_name AS recipient_name
    FROM gaigs_private_messages m JOIN gaigs_profiles sp ON sp.user_id=m.sender_user_id
    JOIN gaigs_profiles rp ON rp.user_id=m.recipient_user_id
    WHERE (m.sender_user_id=? OR m.recipient_user_id=?) AND m.created_at>? ORDER BY m.created_at ASC LIMIT 500`).bind(user.id, user.id, after).all();
  const receivedIds = (rows.results || []).filter(row => row.recipient_user_id === user.id && !row.delivered_at).map(row => row.id);
  if (receivedIds.length) await env.DB.batch(receivedIds.map(id => env.DB.prepare("UPDATE gaigs_private_messages SET delivered_at=COALESCE(delivered_at,?) WHERE id=?").bind(Date.now(), id)));
  return productJson(request, { messages: (rows.results || []).map(row => ({
    id: row.id, clientMessageId: row.client_message_id, conversationId: row.conversation_id,
    senderId: row.sender_user_id, senderName: row.sender_name, recipientId: row.recipient_user_id,
    recipientName: row.recipient_name, senderDeviceId: row.sender_device_id, kind: row.message_kind,
    envelope: JSON.parse(row.sender_user_id === user.id ? row.sender_envelope : row.recipient_envelope), replyTo: row.reply_to,
    receipt: row.message_hash, previousHash: row.previous_hash,
    status: row.read_at ? "read" : row.delivered_at || row.recipient_user_id === user.id ? "delivered" : "sent",
    createdAt: new Date(Number(row.created_at)).toISOString(),
  })) });
}

async function markMessageRead(request, env, user, messageId) {
  const row = await env.DB.prepare("SELECT recipient_user_id FROM gaigs_private_messages WHERE id=?").bind(messageId).first();
  if (!row || row.recipient_user_id !== user.id) return productJson(request, { error: "Message not found." }, 404);
  const now = Date.now();
  await env.DB.prepare("UPDATE gaigs_private_messages SET delivered_at=COALESCE(delivered_at,?),read_at=COALESCE(read_at,?) WHERE id=?").bind(now, now, messageId).run();
  return productJson(request, { ok: true, readAt: new Date(now).toISOString() });
}

async function verifyConversation(request, env, user, conversationId) {
  const rows = await env.DB.prepare(`SELECT * FROM gaigs_private_messages WHERE conversation_id=?
    AND (sender_user_id=? OR recipient_user_id=?) ORDER BY created_at ASC,id ASC`).bind(conversationId, user.id, user.id).all();
  let previous = ZERO_HASH, valid = true;
  for (const row of rows.results || []) {
    const envelopeHash = await sha256(`${row.recipient_envelope}|${row.sender_envelope}`);
    const expected = await sha256([row.id, row.conversation_id, row.sender_user_id, row.recipient_user_id, row.sender_device_id,
      row.message_kind, envelopeHash, row.reply_to || "", row.previous_hash, Number(row.created_at)].join("|"));
    if (row.previous_hash !== previous || expected !== row.message_hash) valid = false;
    previous = row.message_hash;
  }
  return productJson(request, { ok: true, valid, checked: (rows.results || []).length, headHash: previous, ledger: "Conversation SHA-256 receipt chain", publicBlockchainAnchor: null });
}

async function listRoomMessages(request, env, user) {
  const url = new URL(request.url), type = clean(url.searchParams.get("type") || "city", 30).toLowerCase();
  const allowed = ["city", "country", "global", "proposal"];
  if (!allowed.includes(type)) return productJson(request, { error: "Unsupported room type." }, 400);
  let key = clean(url.searchParams.get("key"), 180);
  if (type === "city") key = `${user.country}:${user.city}`;
  if (type === "country") key = user.country;
  if (type === "global") key = "global";
  if (type === "proposal" && !await env.DB.prepare("SELECT id FROM gaigs_proposals WHERE id=?").bind(key).first()) return productJson(request, { error: "Proposal room not found." }, 404);
  const rows = await env.DB.prepare("SELECT * FROM gaigs_room_messages WHERE room_type=? AND room_key=? ORDER BY created_at DESC LIMIT 200").bind(type, key).all();
  return productJson(request, { room: { type, key, privacy: "public-auditable" }, messages: (rows.results || []).reverse().map(row => ({ id: row.id, senderId: row.user_id, senderName: row.display_name, text: row.body, replyTo: row.reply_to, receipt: row.message_hash, previousHash: row.previous_hash, createdAt: new Date(Number(row.created_at)).toISOString() })) });
}

async function postRoomMessage(request, env, user) {
  let body;
  try { body = await requestBody(request, 30000); } catch (error) { return productJson(request, { error: "Invalid room message." }, 400); }
  const type = clean(body.type || "city", 30).toLowerCase(), text = clean(body.text, 5000), replyTo = clean(body.replyTo, 160) || null;
  if (!["city", "country", "global", "proposal"].includes(type) || !text) return productJson(request, { error: "Choose a valid public room and enter a message." }, 400);
  let key = clean(body.key, 180);
  if (type === "city") key = `${user.country}:${user.city}`;
  if (type === "country") key = user.country;
  if (type === "global") key = "global";
  if (type === "proposal" && !await env.DB.prepare("SELECT id FROM gaigs_proposals WHERE id=?").bind(key).first()) return productJson(request, { error: "Proposal room not found." }, 404);
  const prior = await env.DB.prepare("SELECT message_hash FROM gaigs_room_messages WHERE room_type=? AND room_key=? ORDER BY created_at DESC,id DESC LIMIT 1").bind(type, key).first();
  const previousHash = prior?.message_hash || ZERO_HASH, now = Date.now(), id = productId("room");
  const messageHash = await sha256([id, type, key, user.id, text, replyTo || "", previousHash, now].join("|"));
  await env.DB.prepare(`INSERT INTO gaigs_room_messages
    (id,room_type,room_key,user_id,display_name,body,reply_to,previous_hash,message_hash,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id, type, key, user.id, user.display_name, text, replyTo, previousHash, messageHash, now).run();
  return productJson(request, { ok: true, message: { id, senderId: user.id, senderName: user.display_name, text, replyTo, receipt: messageHash, previousHash, createdAt: new Date(now).toISOString() } }, 201);
}

async function handleProductRequest(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;
  const productRoute = /^\/api\/(auth|profile|uploads|posts|wallet|ledger|governance|media|messaging)(\/|$)/.test(url.pathname);
  if (!productRoute) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: productHeaders(request, { "access-control-allow-methods": "GET,POST,PUT,PATCH,OPTIONS", "access-control-allow-headers": "authorization,content-type,x-gaigs-request,x-gaigs-client" }) });
  try { await ensureProductSchema(env); } catch (error) { return productJson(request, { error: "Shared product database is unavailable." }, 503); }

  if (url.pathname === "/api/media" || url.pathname.startsWith("/api/media/")) return serveMedia(request, env, url.pathname.slice("/api/media/".length));
  if (url.pathname === "/api/auth/register" && request.method === "POST") return registerAccount(request, env);
  if (url.pathname === "/api/auth/login" && request.method === "POST") return loginAccount(request, env);
  if (url.pathname === "/api/posts" && request.method === "GET") return listPosts(request, env);
  if (url.pathname === "/api/governance/proposals" && request.method === "GET") return listProposals(request, env);

  const user = await authenticatedUser(request, env);
  if (!user) return productJson(request, { error: "Please log in to continue." }, 401);
  if (!["GET", "HEAD"].includes(request.method) && !requireAppRequest(request)) return productJson(request, { error: "Request confirmation is missing." }, 403);

  if (url.pathname === "/api/auth/me" && request.method === "GET") return accountSnapshot(request, env, user);
  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    await env.DB.prepare("DELETE FROM gaigs_sessions WHERE token_hash=?").bind(user.sessionHash).run();
    return productJson(request, { ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
  }
  if (url.pathname === "/api/profile" && request.method === "PATCH") return updateProfile(request, env, user);
  if (url.pathname === "/api/profile/avatar" && request.method === "POST") return uploadMedia(request, env, user, "avatar");
  if (url.pathname === "/api/uploads" && request.method === "POST") return uploadMedia(request, env, user, "post");
  if (url.pathname === "/api/posts" && request.method === "POST") return createPost(request, env, user);
  if (url.pathname === "/api/wallet" && request.method === "GET") return accountSnapshot(request, env, user);
  if (url.pathname === "/api/wallet/transfer" && request.method === "POST") return transferCredits(request, env, user);
  if (url.pathname === "/api/ledger/verify" && request.method === "GET") return verifyWalletLedger(request, env, user);
  if (url.pathname === "/api/governance/proposals" && request.method === "POST") return createProposalRecord(request, env, user);
  const voteMatch = url.pathname.match(/^\/api\/governance\/proposals\/([^/]+)\/vote$/);
  if (voteMatch && request.method === "POST") return castVote(request, env, user, decodeURIComponent(voteMatch[1]));
  if (url.pathname === "/api/messaging/devices" && request.method === "PUT") return registerMessagingDevice(request, env, user);
  if (url.pathname === "/api/messaging/contacts" && request.method === "GET") return listMessagingContacts(request, env, user);
  const keysMatch = url.pathname.match(/^\/api\/messaging\/keys\/([^/]+)$/);
  if (keysMatch && request.method === "GET") return messagingKeys(request, env, decodeURIComponent(keysMatch[1]));
  if (url.pathname === "/api/messaging/messages" && request.method === "GET") return listPrivateMessages(request, env, user);
  if (url.pathname === "/api/messaging/messages" && request.method === "POST") return sendPrivateMessage(request, env, user);
  const readMatch = url.pathname.match(/^\/api\/messaging\/messages\/([^/]+)\/read$/);
  if (readMatch && request.method === "POST") return markMessageRead(request, env, user, decodeURIComponent(readMatch[1]));
  const verifyConversationMatch = url.pathname.match(/^\/api\/messaging\/conversations\/([^/]+)\/verify$/);
  if (verifyConversationMatch && request.method === "GET") return verifyConversation(request, env, user, decodeURIComponent(verifyConversationMatch[1]));
  if (url.pathname === "/api/messaging/rooms" && request.method === "GET") return listRoomMessages(request, env, user);
  if (url.pathname === "/api/messaging/rooms" && request.method === "POST") return postRoomMessage(request, env, user);
  return productJson(request, { error: "Not found." }, 404);
}
