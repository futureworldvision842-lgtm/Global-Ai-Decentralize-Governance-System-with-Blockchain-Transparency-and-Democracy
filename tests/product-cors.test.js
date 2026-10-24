const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");
const { DatabaseSync } = require("node:sqlite");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const PAGES = "https://futureworldvision842-lgtm.github.io";
const WORKER = "https://gaigs-api.example.workers.dev";

let api;
let worker;

test.before(async () => {
  api = await import(pathToFileURL(path.join(root, "sites/product-api.js")).href);
  worker = await import(pathToFileURL(path.join(root, "cloudflare/src/index.js")).href);
});

function memoryDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  function statement(sql) {
    const state = { params: [] };
    const prepared = {
      bind(...params) { state.params = params; return prepared; },
      async run() {
        db.prepare(sql).run(...state.params);
        return { success: true };
      },
      async first() {
        return db.prepare(sql).get(...state.params) ?? null;
      },
      async all() {
        return { results: db.prepare(sql).all(...state.params) };
      },
    };
    return prepared;
  }
  return {
    prepare: statement,
    async batch(statements) {
      db.exec("BEGIN");
      try {
        for (const item of statements) await item.run();
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

function preflight(origin, extraHeaders = {}) {
  return new Request(`${WORKER}/api/auth/login`, {
    method: "OPTIONS",
    headers: {
      origin,
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization,content-type,x-gaigs-request,x-gaigs-client",
      ...extraHeaders,
    },
  });
}

const account = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+923001234567",
  password: "long-password-1",
  cnic: "1234567890123",
  country: "Pakistan",
  city: "Lahore",
};

test("product preflight allows Pages, localhost, Capacitor, and configured origins", async () => {
  const pages = await api.handleProductRequest(preflight(PAGES), {});
  assert.equal(pages.status, 204);
  assert.equal(pages.headers.get("access-control-allow-origin"), PAGES);
  assert.equal(pages.headers.get("access-control-allow-credentials"), "true");
  assert.equal(pages.headers.get("access-control-allow-origin") === "*", false);
  assert.match(pages.headers.get("access-control-allow-headers"), /authorization/);
  assert.match(pages.headers.get("access-control-allow-headers"), /content-type/);
  assert.match(pages.headers.get("access-control-allow-headers"), /x-gaigs-request/);
  assert.match(pages.headers.get("access-control-allow-headers"), /x-gaigs-client/);
  assert.match(pages.headers.get("access-control-allow-methods"), /POST/);
  assert.equal(pages.headers.get("vary"), "Origin");

  for (const origin of ["http://localhost:5173", "https://127.0.0.1:8787", "https://localhost", "capacitor://localhost", "ionic://localhost"]) {
    const response = await api.handleProductRequest(preflight(origin), {});
    assert.equal(response.headers.get("access-control-allow-origin"), origin, origin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  }

  const custom = await api.handleProductRequest(preflight("https://gaigs.example"), { GAIGS_ALLOWED_ORIGINS: "https://other.example, https://gaigs.example/" });
  assert.equal(custom.headers.get("access-control-allow-origin"), "https://gaigs.example");

  const same = await api.handleProductRequest(preflight(WORKER), {});
  assert.equal(same.headers.get("access-control-allow-origin"), WORKER);
});

test("product preflight rejects origins outside the allowlist", async () => {
  for (const origin of [
    "https://evil.example",
    "https://futureworldvision842-lgtm.github.io.evil.example",
    "https://notgithub.io",
    "http://localhost.evil.example",
    "null",
  ]) {
    const response = await api.handleProductRequest(preflight(origin), { GAIGS_ALLOWED_ORIGINS: "*" });
    assert.equal(response.status, 403, origin);
    assert.equal(response.headers.get("access-control-allow-origin"), null, origin);
    assert.equal(response.headers.get("access-control-allow-credentials"), null, origin);
    const body = await response.json();
    assert.equal(body.error, "Origin is not allowed.");
  }
});

test("cross-site register and login set a credentialed cookie and bearer preflight still works", async () => {
  const env = { DB: memoryDb(), APP_KYC_PEPPER: "test-pepper" };
  const missingPepper = await api.handleProductRequest(new Request(`${WORKER}/api/auth/register`, {
    method: "POST",
    headers: { origin: PAGES, "content-type": "application/json" },
    body: JSON.stringify(account),
  }), { DB: env.DB });
  assert.equal(missingPepper.status, 503);
  assert.equal(missingPepper.headers.get("access-control-allow-origin"), PAGES);

  const registered = await api.handleProductRequest(new Request(`${WORKER}/api/auth/register`, {
    method: "POST",
    headers: {
      origin: PAGES,
      "content-type": "application/json",
      "x-gaigs-request": "app",
      "x-gaigs-client": "web",
    },
    body: JSON.stringify(account),
  }), env);
  assert.equal(registered.status, 201);
  assert.equal(registered.headers.get("access-control-allow-origin"), PAGES);
  assert.equal(registered.headers.get("access-control-allow-credentials"), "true");
  const cookie = registered.headers.get("set-cookie");
  assert.match(cookie, /gaigs_session=[a-f0-9]+/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=None/);
  assert.match(cookie, /Partitioned/);
  const payload = await registered.json();
  assert.equal(payload.user.email, account.email);
  assert.equal(payload.wallet.available, 100);
  assert.equal(payload.sessionToken, undefined);

  const token = /gaigs_session=([^;]+)/.exec(cookie)[1];
  const me = await api.handleProductRequest(new Request(`${WORKER}/api/auth/me`, {
    headers: { origin: PAGES, cookie: `gaigs_session=${token}` },
  }), env);
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.email, account.email);

  const loggedIn = await api.handleProductRequest(new Request(`${WORKER}/api/auth/login`, {
    method: "POST",
    headers: { origin: "capacitor://localhost", "content-type": "application/json", "x-gaigs-client": "native" },
    body: JSON.stringify({ email: account.email, password: account.password }),
  }), env);
  assert.equal(loggedIn.status, 200);
  assert.match(loggedIn.headers.get("set-cookie"), /SameSite=None/);
  assert.match(loggedIn.headers.get("set-cookie"), /Partitioned/);
  const native = await loggedIn.json();
  assert.ok(native.sessionToken);

  const bearer = await api.handleProductRequest(new Request(`${WORKER}/api/auth/me`, {
    headers: { origin: "capacitor://localhost", authorization: `Bearer ${native.sessionToken}` },
  }), env);
  assert.equal(bearer.status, 200);
  assert.equal(bearer.headers.get("access-control-allow-origin"), "capacitor://localhost");

  const sameSite = await api.handleProductRequest(new Request(`${WORKER}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password }),
  }), env);
  assert.equal(sameSite.status, 200);
  const lax = sameSite.headers.get("set-cookie");
  assert.match(lax, /HttpOnly; Secure; SameSite=Lax/);
  assert.doesNotMatch(lax, /SameSite=None/);
  assert.doesNotMatch(lax, /Partitioned/);

  const loggedOut = await api.handleProductRequest(new Request(`${WORKER}/api/auth/logout`, {
    method: "POST",
    headers: { origin: PAGES, cookie: `gaigs_session=${token}`, "x-gaigs-request": "app" },
  }), env);
  assert.equal(loggedOut.status, 200);
  assert.match(loggedOut.headers.get("set-cookie"), /SameSite=None/);
  assert.match(loggedOut.headers.get("set-cookie"), /Max-Age=0/);
  assert.match(loggedOut.headers.get("set-cookie"), /Partitioned/);
});

test("worker entrypoint applies the same origin rules", async () => {
  const health = await worker.default.fetch(new Request(`${WORKER}/api/health`, { headers: { origin: PAGES } }), {});
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("access-control-allow-origin"), PAGES);
  assert.equal((await health.json()).service, "gaigs-api");

  const rootResponse = await worker.default.fetch(new Request(`${WORKER}/`, { headers: { origin: PAGES } }), {});
  assert.equal(rootResponse.status, 200);
  assert.equal((await rootResponse.json()).health, "/api/health");

  const denied = await worker.default.fetch(new Request(`${WORKER}/api/health`, { headers: { origin: "https://evil.example" } }), {});
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("access-control-allow-origin"), null);

  const missing = await worker.default.fetch(new Request(`${WORKER}/api/missing`, { headers: { origin: PAGES } }), {});
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("access-control-allow-origin"), PAGES);
});

test("platformApiBase points Pages at the live Worker and a placeholder still falls back", () => {
  const configContext = { window: {} };
  vm.createContext(configContext);
  vm.runInContext(read("config.js"), configContext);
  const live = "https://gaigs-api.gaigs.workers.dev";
  assert.equal(configContext.window.NDCONF.platformApiBase, live);
  assert.equal(configContext.window.NDCONF.jarvisProxyUrl, "https://gaigs-jarvis-v2.qw01.chatgpt.site/api/jarvis-assist");
  assert.match(read("scripts/prepare-production.js"), /platformApiBase:optional\('GAIGS_PLATFORM_API_BASE','https:\/\/gaigs-api\.gaigs\.workers\.dev'\)/);

  function baseFor(ndconf, location) {
    const context = {
      window: { NDCONF: ndconf },
      location,
      localStorage: { getItem() { return ""; }, setItem() {}, removeItem() {} },
      queueMicrotask() {},
      console,
      Headers: globalThis.Headers,
      URLSearchParams: globalThis.URLSearchParams,
      FormData: globalThis.FormData,
    };
    vm.createContext(context);
    vm.runInContext(read("gaigs/network-core.js"), context);
    return context.window.gaigsApi.base;
  }

  const legacy = "https://gaigs-jarvis-v2.qw01.chatgpt.site";
  const pages = { protocol: "https:", hostname: "futureworldvision842-lgtm.github.io" };
  assert.equal(baseFor(configContext.window.NDCONF, pages), live);
  assert.equal(baseFor({ platformApiBase: "https://gaigs-api.YOUR_SUBDOMAIN.workers.dev" }, pages), legacy);
  assert.equal(baseFor({ platformApiBase: "https://gaigs-api.real-name.workers.dev/" }, { protocol: "https:", hostname: "localhost" }), "https://gaigs-api.real-name.workers.dev");
  assert.equal(baseFor({}, { protocol: "https:", hostname: "example.com" }), "");
  assert.equal(baseFor({}, { protocol: "http:", hostname: "localhost" }), legacy);
  assert.match(read("gaigs/index.html"), /config\.js\?v=2/);
  assert.match(read("gaigs/index.html"), /network-core\.js\?v=37/);
  assert.match(read("gaigs/sw.js"), /network-core\.js\?v=37/);
});

test("Cloudflare config, migration, and workflow are ready to fill in", () => {
  const toml = read("wrangler.toml");
  const migration = read("cloudflare/d1/migrations/0001_gaigs_product.sql");
  const workflow = read(".github/workflows/deploy-cloudflare.yml");
  const guide = read("DEPLOY.md");
  const apiSource = read("sites/product-api.js");
  assert.match(toml, /name = "gaigs-api"/);
  assert.match(toml, /binding = "DB"/);
  assert.match(toml, /database_name = "gaigs"/);
  assert.match(toml, /database_id = "9852a8b3-ab59-4f73-a3ec-a5b6870ad214"/);
  assert.match(toml, /# \[\[r2_buckets\]\]/);
  assert.match(toml, /# binding = "UPLOADS"/);
  assert.match(toml, /# bucket_name = "gaigs-uploads"/);
  assert.doesNotMatch(toml, /^\[\[r2_buckets\]\]/m);
  assert.match(toml, /GAIGS_ALLOWED_ORIGINS/);
  assert.doesNotMatch(toml, /^account_id\s*=/m);
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID/);
  assert.match(workflow, /d1 migrations apply gaigs --remote/);
  assert.match(workflow, /command: deploy/);
  assert.match(guide, /npx wrangler d1 migrations apply gaigs --remote/);
  assert.match(guide, /npx wrangler deploy/);
  assert.match(guide, /APP_KYC_PEPPER/);
  assert.match(guide, /https:\/\/gaigs-api\.gaigs\.workers\.dev/);
  assert.match(guide, /gaigs-uploads/);
  assert.match(read("README.md"), /https:\/\/gaigs-api\.gaigs\.workers\.dev/);
  for (const table of ["gaigs_users", "gaigs_profiles", "gaigs_sessions", "gaigs_wallets", "gaigs_ledger_entries", "gaigs_uploads", "gaigs_posts", "gaigs_reward_events", "gaigs_proposals", "gaigs_votes", "gaigs_project_wallets", "gaigs_device_keys", "gaigs_private_messages", "gaigs_room_messages"]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
    assert.match(apiSource, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  assert.doesNotMatch(migration, /PRAGMA/i);
  assert.doesNotMatch(read("cloudflare/.dev.vars.example"), /APP_KYC_PEPPER=(?!replace-with)/);
});
