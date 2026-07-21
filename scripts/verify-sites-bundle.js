const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

(async () => {
  const workerPath = path.resolve(__dirname, "..", "dist", "server", "index.js");
  const source = fs.readFileSync(workerPath, "utf8");
  const encoded = Buffer.from(source).toString("base64");
  const { default: worker } = await import(`data:text/javascript;base64,${encoded}`);

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
  console.log("Sites worker serves GAIGS and supports application routes.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
