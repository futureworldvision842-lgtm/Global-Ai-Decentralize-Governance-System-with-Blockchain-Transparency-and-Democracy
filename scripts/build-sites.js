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

const worker = `const worker = {
  async fetch(request, env) {
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
