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

function plainText(value, limit = 320) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\\s+/g, " ")
    .trim()
    .slice(0, limit);
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
  const edgeCache = globalThis.caches && globalThis.caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });
  if (edgeCache) {
    const hit = await edgeCache.match(cacheKey);
    if (hit) return hit;
  }

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
  if (edgeCache && !unavailable) await edgeCache.put(cacheKey, response.clone());
  return response;
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/mission-brief") {
      return missionBrief(request);
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
