const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "dist-web");
const output = path.join(root, "dist");
const client = path.join(output, "client");
const server = path.join(output, "server");

if (!fs.existsSync(path.join(source, "index.html"))) {
  throw new Error("dist-web is missing. Run npm run build:web first.");
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(server, { recursive: true });
fs.cpSync(source, client, { recursive: true });

const worker = `const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=900, s-maxage=21600",
  "x-content-type-options": "nosniff",
  "access-control-allow-origin": "*",
};

const heartbeatHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "access-control-allow-origin": "*",
};

function jsonResponse(value, status = 200, headers = heartbeatHeaders) {
  return new Response(JSON.stringify(value), { status, headers });
}

async function ensureHeartbeatSchema(db) {
  await db.prepare(\`CREATE TABLE IF NOT EXISTS jarvis_heartbeat (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    updated_at INTEGER NOT NULL,
    payload TEXT NOT NULL
  )\`).run();
}

function plainText(value, limit = 320) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function safeAgent(agent) {
  const status = ["online", "ready", "offline", "degraded"].includes(String(agent?.status || "").toLowerCase())
    ? String(agent.status).toLowerCase()
    : "offline";
  return {
    id: plainText(agent?.id, 60) || "agent",
    name: plainText(agent?.name, 80) || "JARVIS service",
    status,
    detail: plainText(agent?.detail, 220) || "No status detail received.",
    ...(agent?.lastSeen ? { lastSeen: plainText(agent.lastSeen, 60) } : {}),
  };
}

function safeHeartbeat(raw) {
  return {
    name: plainText(raw?.name, 80) || "Muhammad's JARVIS",
    generatedAt: plainText(raw?.generatedAt, 60) || new Date().toISOString(),
    privacy: "status-only",
    agents: Array.isArray(raw?.agents) ? raw.agents.slice(0, 20).map(safeAgent) : [],
  };
}

async function tokenMatches(request, expected) {
  if (!expected) return false;
  const supplied = (request.headers.get("authorization") || "").replace(/^Bearer\\s+/i, "");
  if (!supplied) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function receiveHeartbeat(request, env) {
  if (!env.DB) return jsonResponse({ error: "Heartbeat storage is unavailable." }, 503);
  if (!(await tokenMatches(request, env.JARVIS_HEARTBEAT_TOKEN))) return jsonResponse({ error: "Unauthorized." }, 401);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 65536) return jsonResponse({ error: "Heartbeat is too large." }, 413);
  let body;
  try { body = await request.json(); } catch (error) { return jsonResponse({ error: "Invalid JSON." }, 400); }
  const heartbeat = safeHeartbeat(body);
  if (!heartbeat.agents.length) return jsonResponse({ error: "At least one service status is required." }, 400);
  await ensureHeartbeatSchema(env.DB);
  const now = Date.now();
  await env.DB.prepare(\`INSERT INTO jarvis_heartbeat (id, updated_at, payload)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, payload = excluded.payload\`)
    .bind(now, JSON.stringify(heartbeat))
    .run();
  return jsonResponse({ ok: true, acceptedAt: new Date(now).toISOString() });
}

async function readHeartbeat(env) {
  if (!env.DB) return jsonResponse({ name: "Muhammad's JARVIS", privacy: "status-only", online: false, agents: [], message: "Cloud heartbeat storage is not configured." });
  await ensureHeartbeatSchema(env.DB);
  const row = await env.DB.prepare("SELECT updated_at, payload FROM jarvis_heartbeat WHERE id = 1").first();
  if (!row) return jsonResponse({ name: "Muhammad's JARVIS", privacy: "status-only", online: false, agents: [], message: "Waiting for the first JARVIS PC heartbeat." });
  const ageMs = Math.max(0, Date.now() - Number(row.updated_at || 0));
  let payload;
  try { payload = safeHeartbeat(JSON.parse(row.payload)); } catch (error) { payload = safeHeartbeat({}); }
  const online = ageMs < 120000;
  if (!online) payload.agents = payload.agents.map(agent => ({ ...agent, status: "offline", detail: agent.id === "heartbeat" ? "Cloud heartbeat is stale; the PC supervisor may be stopped." : agent.detail }));
  return jsonResponse({ ...payload, online, heartbeatAgeSeconds: Math.round(ageMs / 1000), receivedAt: new Date(Number(row.updated_at || 0)).toISOString() });
}

function romanUrduPrompt(value) {
  return /\\b(kya|kiya|kaise|kaisey|mujhe|mujhey|mera|merey|humara|hamara|karo|kerna|batao|bataow|chahiye|hai|hain|main)\\b/i.test(value);
}

function assistAnswer(prompt) {
  const value = String(prompt || "").toLowerCase();
  const urdu = romanUrduPrompt(prompt);
  if (/^(hi|hello|hey|salam|assalam)/.test(value)) {
    return urdu
      ? "Salam. Main aap ka GAIGS JARVIS hoon. Main app navigate kar sakta hoon, device status samjha sakta hoon, verified mission sources dikha sakta hoon aur draft tayyar kar sakta hoon; publish, vote aur funds hamesha aap approve karte hain."
      : "Hello. I am your GAIGS JARVIS. I can navigate the app, explain device status, surface verified mission sources and prepare drafts; you always approve publishing, votes and funds.";
  }
  if (/what.*(can you do|are you)|platform|gaigs|mission|vision/.test(value)) {
    return urdu
      ? "GAIGS social connection, nearby skills aur work, societies, maps, public problems, transparent projects, voting, wallet records aur JARVIS ko aik jagah jorta hai. Maqsad attention ko verified collective action mein badalna hai."
      : "GAIGS joins social connection, nearby skills and work, communities, maps, public problems, transparent projects, voting, wallet records and JARVIS in one place—turning attention into verified collective action.";
  }
  if (/battery|charging|internet|network|device status|mobile status/.test(value)) {
    return urdu
      ? "Android app ka Mobile Command Center battery, charging, internet, background presence aur last sync real device se dikhata hai. JARVIS Hub khol kar Check status dabayen."
      : "The Android Mobile Command Center reads battery, charging, internet, background presence and last sync from the real device. Open JARVIS Hub and tap Check status.";
  }
  if (/stop jarvis|turn.*off|band.*jarvis/.test(value)) {
    return urdu
      ? "PC par STOP JARVIS ya voice stop poora local supervisor band karta hai. Mobile par visible notification ka Pause ya JARVIS Hub ka background toggle mobile presence rokta hai."
      : "On PC, STOP JARVIS or the voice stop command shuts down the full local supervisor. On mobile, use Pause in the visible notification or the JARVIS Hub background toggle.";
  }
  if (/news|emergency|flood|earthquake|disaster|world monitor|global problem/.test(value)) {
    return urdu
      ? "Mission Desk NASA EONET aur GDACS ke public feeds se current signals lata hai. Har signal ka original source khol kar local authorities se verify karein, phir measurable response mission banayen."
      : "Mission Desk reads current signals from NASA EONET and GDACS public feeds. Open the original source, verify locally with responsible authorities, then create a measurable response mission.";
  }
  if (/wallet|crypto|money|fund|transfer|bank/.test(value)) {
    return urdu
      ? "Wallet ledger aur DAO records inspect kiye ja sakte hain, lekin real money ya crypto transfer user-controlled wallet, licensed settlement aur aap ki final confirmation ke baghair nahi hota."
      : "You can inspect wallet ledger and DAO records, but real money or crypto cannot move without a user-controlled wallet, compliant settlement and your final confirmation.";
  }
  if (/vote|proposal|governance|dao/.test(value)) {
    return urdu
      ? "JARVIS proposal ko explain, compare aur draft kar sakta hai. Vote sirf eligible member deta hai; JARVIS ya admin ballot cast, edit ya secretly finalize nahi kar sakte."
      : "JARVIS can explain, compare and draft a proposal. Only an eligible member casts a ballot; neither JARVIS nor an administrator can cast, edit or secretly finalize it.";
  }
  if (/job|work|skill|service|freelance/.test(value)) {
    return urdu
      ? "Skills & Work section declared skills, location radius aur availability se nearby matches dikhata hai. Exact home location public nahi hoti aur final contact dono log approve karte hain."
      : "Skills & Work matches declared skills, location radius and availability. Exact home location is not public, and both people approve final contact.";
  }
  if (/community|society|nearby|join/.test(value)) {
    return urdu
      ? "Communities section nearby societies dikhata hai. Join request residence evidence aur society ke transparent membership rules ke mutabiq review hoti hai; admin clerk hai, owner nahi."
      : "Communities shows nearby societies. A join request is reviewed against transparent membership rules and appropriate residence evidence; administrators act as clerks, not owners.";
  }
  if (/remember|memory|know about me/.test(value)) {
    return urdu
      ? "Aap ki approved JARVIS memory AES-256-GCM se isi device par encrypted rehti hai. Aap dekh, add ya erase kar sakte hain; cloud par silently upload nahi hoti."
      : "Your approved JARVIS memory is AES-256-GCM encrypted on this device. You can inspect, add or erase it, and it is not silently uploaded to the cloud.";
  }
  return urdu
    ? "Main is request ko samjhane, app ka sahi section kholne ya review ke liye draft banane mein madad kar sakta hoon. Sensitive device control, publication, vote aur funds ke liye aap ki visible confirmation zaroori hai."
    : "I can help explain this request, open the right workspace, or prepare a draft for review. Sensitive device control, publishing, voting and funds require your visible confirmation.";
}

async function jarvisAssist(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 16384) return jsonResponse({ error: "Request is too large." }, 413);
  let body;
  try { body = await request.json(); } catch (error) { return jsonResponse({ error: "Invalid JSON." }, 400); }
  const prompt = plainText(body?.prompt, 3000);
  if (!prompt) return jsonResponse({ error: "Prompt is required." }, 400);
  return jsonResponse({
    answer: assistAnswer(prompt),
    auditId: crypto.randomUUID(),
    mode: "public-mission-assistant",
    allowedActions: ["explain", "navigate", "draft", "read-device-status", "open-approved-settings"],
  });
}

function priorityFor(text) {
  const value = String(text || "").toLowerCase();
  if (/earthquake|tsunami|wildfire|cyclone|hurricane|cholera|mass displacement/.test(value)) return "high";
  if (/flood|storm|drought|conflict|food insecurity|disease|volcano/.test(value)) return "high";
  return "watch";
}

function actionFor(text) {
  const value = String(text || "").toLowerCase();
  if (/flood|water|storm|cyclone|hurricane/.test(value)) {
    return "Confirm affected areas with local authorities; map safe water, shelter and transport needs; then open a source-linked local response discussion.";
  }
  if (/wildfire|fire/.test(value)) {
    return "Follow official evacuation guidance first; identify verified shelter and transport gaps; share only location-safe evidence with responders.";
  }
  if (/cholera|disease|health|medical/.test(value)) {
    return "Check public-health guidance, identify verified medicine, clean-water or clinic gaps, and route volunteers through recognized health responders.";
  }
  if (/conflict|displacement|refugee|protection/.test(value)) {
    return "Contact recognized humanitarian organizations, protect personal location data, document verified needs and avoid exposing vulnerable people.";
  }
  if (/drought|food insecurity|hunger/.test(value)) {
    return "Verify local food and water indicators, map trusted distribution partners and frame a measurable supply or resilience mission.";
  }
  return "Open the original source, verify whether the signal affects your area, identify responsible people and prepare a measurable community response.";
}

function nasaSignals(payload) {
  return (payload.events || []).slice(0, 8).map((event, index) => {
    const categories = (event.categories || []).map(item => item.title).filter(Boolean);
    const geometry = (event.geometry || []).at(-1) || {};
    const source = (event.sources || [])[0] || {};
    const combined = [event.title, event.description, ...categories].join(" ");
    return {
      id: "nasa-" + String(event.id || index),
      title: plainText(event.title, 180),
      problem: plainText(event.description, 280) || "NASA EONET lists this as an active natural event. Open the source and confirm local conditions with responsible authorities.",
      category: categories.join(", ") || "Natural event",
      location: "Global natural event",
      priority: priorityFor(combined),
      suggestedAction: actionFor(combined),
      publishedAt: geometry.date || null,
      url: source.url || event.link || "https://eonet.gsfc.nasa.gov/",
      source: { name: "NASA EONET", kind: "official public event feed" },
    };
  });
}

function gdacsSignals(payload) {
  const categoryNames = { EQ: "Earthquake", TC: "Tropical cyclone", FL: "Flood", VO: "Volcano", DR: "Drought", WF: "Wildfire" };
  return (payload.features || []).slice(0, 10).map((feature, index) => {
    const fields = feature.properties || {};
    const category = categoryNames[fields.eventtype] || fields.eventtype || "Disaster alert";
    const combined = [fields.name, fields.description, fields.htmldescription, category, fields.country].join(" ");
    const alert = String(fields.alertlevel || "").toLowerCase();
    return {
      id: "gdacs-" + String(fields.eventtype || "event") + "-" + String(fields.eventid || index),
      title: plainText(fields.name || fields.description, 180),
      problem: plainText(fields.htmldescription || fields.description, 280) || "GDACS lists a current disaster alert. Open the official report and confirm local instructions.",
      category,
      location: fields.country || "Global",
      priority: alert === "red" ? "urgent" : alert === "orange" ? "high" : priorityFor(combined),
      suggestedAction: actionFor(combined),
      publishedAt: fields.datemodified || fields.fromdate || null,
      url: fields.url && fields.url.report || "https://www.gdacs.org/",
      source: { name: "GDACS", kind: "Global Disaster Alert and Coordination System" },
    };
  });
}

async function readJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "GAIGS-Humanity-Mission-Desk/1.0" },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.json();
}

async function missionBrief(request) {
  const [nasa, gdacs] = await Promise.allSettled([
    readJson("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=8&days=30"),
    readJson("https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP"),
  ]);
  const sourceStatus = [];
  let signals = [];
  if (nasa.status === "fulfilled") {
    const items = nasaSignals(nasa.value);
    signals.push(...items);
    sourceStatus.push({ name: "NASA EONET", ok: true, count: items.length });
  } else {
    sourceStatus.push({ name: "NASA EONET", ok: false, message: "Source temporarily unavailable" });
  }
  if (gdacs.status === "fulfilled") {
    const items = gdacsSignals(gdacs.value);
    signals.push(...items);
    sourceStatus.push({ name: "GDACS", ok: true, count: items.length });
  } else {
    sourceStatus.push({ name: "GDACS", ok: false, message: "Source temporarily unavailable" });
  }

  signals = signals
    .filter(item => item.title && item.url)
    .sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")))
    .slice(0, 12);
  const unavailable = sourceStatus.every(item => !item.ok);
  const body = JSON.stringify({
    generatedAt: new Date().toISOString(),
    mission: "Turn verified public signals into locally accountable, member-approved action.",
    signals,
    sourceStatus,
    limitations: "This brief is informational. Follow local authorities and field responders for urgent instructions.",
    ...(unavailable ? { error: "Official mission sources are temporarily unavailable." } : {}),
  });
  const response = new Response(body, { status: unavailable ? 503 : 200, headers: jsonHeaders });
  return response;
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/jarvis-heartbeat" && request.method === "POST") {
      return receiveHeartbeat(request, env);
    }
    if (url.pathname === "/api/agent-hub" && request.method === "GET") {
      return readHeartbeat(env);
    }
    if (url.pathname === "/api/jarvis-heartbeat" && request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...heartbeatHeaders, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "authorization, content-type" } });
    }
    if (request.method === "GET" && url.pathname === "/api/mission-brief") {
      return missionBrief(request);
    }
    if (request.method === "POST" && url.pathname === "/api/jarvis-assist") {
      return jarvisAssist(request);
    }
    if (request.method === "OPTIONS" && url.pathname === "/api/jarvis-assist") {
      return new Response(null, { status: 204, headers: { ...heartbeatHeaders, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "authorization, content-type" } });
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== "GET") return response;
    const accept = request.headers.get("accept") || "";
    if (!accept.includes("text/html")) return response;
    const fallback = new URL("/index.html", request.url);
    return env.ASSETS.fetch(new Request(fallback, request));
  },
};

export default worker;
`;

fs.writeFileSync(path.join(server, "index.js"), worker, "utf8");
console.log("Prepared GAIGS static worker bundle in dist.");
