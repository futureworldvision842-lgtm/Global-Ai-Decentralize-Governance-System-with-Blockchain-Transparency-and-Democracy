const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

(async () => {
  const workerPath = path.resolve(__dirname, "..", "dist", "server", "index.js");
  const source = fs.readFileSync(workerPath, "utf8");
  const encoded = Buffer.from(source).toString("base64");
  const { default: worker } = await import(`data:text/javascript;base64,${encoded}`);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("eonet.gsfc.nasa.gov")) {
      return new Response(JSON.stringify({
        events: [{
          id: "EONET_TEST",
          title: "Flood test event",
          description: "Flooding affects roads and drinking-water access.",
          categories: [{ title: "Floods" }],
          sources: [{ url: "https://example.org/nasa-source" }],
          geometry: [{ date: "2026-07-22T00:00:00Z" }],
        }],
      }), { headers: { "content-type": "application/json" } });
    }
    if (url.includes("gdacs.org")) {
      return new Response(JSON.stringify({
        type: "FeatureCollection",
        features: [{ properties: {
          eventtype: "TC",
          eventid: 42,
          name: "Cyclone test event",
          description: "Cyclone near Test country",
          htmldescription: "Orange cyclone alert with shelter needs.",
          country: "Test country",
          alertlevel: "Orange",
          datemodified: "2026-07-21T00:00:00Z",
          url: { report: "https://example.org/gdacs-source" },
        } }],
      }), { headers: { "content-type": "application/json" } });
    }
    throw new Error("Unexpected source URL: " + url);
  };

  const missionResponse = await worker.fetch(
    new Request("https://gaigs.example/api/mission-brief", {
      headers: { accept: "application/json" },
    }),
    {},
  );
  globalThis.fetch = originalFetch;
  assert.equal(missionResponse.status, 200);
  assert.equal(missionResponse.headers.get("access-control-allow-origin"), "*");
  const missionBrief = await missionResponse.json();
  assert.equal(missionBrief.signals.length, 2);
  assert.match(missionBrief.signals[0].suggestedAction, /local authorities/i);
  assert.deepEqual(missionBrief.sourceStatus.map(item => item.ok), [true, true]);

  const response = await worker.fetch(
    new Request("https://gaigs.example/community/society", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          if (url.pathname === "/index.html") {
            return new Response("<!doctype html><title>GAIGS</title>", {
              headers: { "content-type": "text/html; charset=utf-8" },
            });
          }
          return new Response("Not found", { status: 404 });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.match(await response.text(), /<title>GAIGS<\/title>/);
  console.log("Sites worker serves GAIGS, application routes, and source-backed mission briefs.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
