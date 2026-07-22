const fs = require("node:fs");
const path = require("node:path");

(async () => {
  const root = path.resolve(__dirname, "..");
  const workerPath = path.join(root, "dist", "server", "index.js");
  const workerSource = fs.readFileSync(workerPath, "utf8");
  const encoded = Buffer.from(workerSource).toString("base64");
  const { default: worker } = await import(`data:text/javascript;base64,${encoded}`);
  const response = await worker.fetch(new Request("https://gaigs.local/api/mission-brief"), {});
  const body = await response.text();
  const payload = JSON.parse(body);
  if (!Array.isArray(payload.signals) || !Array.isArray(payload.sourceStatus)) {
    throw new Error("Mission snapshot did not return the expected source-labelled structure.");
  }

  for (const base of [path.join(root, "dist-web"), path.join(root, "dist", "client")]) {
    const apiDir = path.join(base, "api");
    fs.mkdirSync(apiDir, { recursive: true });
    fs.writeFileSync(path.join(apiDir, "mission-brief"), body);
  }
  console.log(`Prepared Pages mission snapshot with ${payload.signals.length} current signals.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
