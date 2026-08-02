const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

test("JARVIS v2 scripts are wired into the isolated app shell", () => {
  const html = read("gaigs/index.html");
  for (const asset of ["peer-mesh-v2.js", "video-feed-v2.js", "personal-jarvis-v2.js"]) assert.match(html, new RegExp(asset.replaceAll(".", "\\.")));
  assert.match(html, /data-view="jarvisHub"/);
  assert.match(html, /data-view="videoFeed"/);
});

test("personal memory uses non-extractable AES-GCM encryption", () => {
  const source = read("gaigs/personal-jarvis-v2.js");
  assert.match(source, /AES-GCM/);
  assert.match(source, /generateKey\([^;]+false, \["encrypt", "decrypt"\]/s);
  assert.match(source, /Erase every encrypted JARVIS memory/);
  assert.doesNotMatch(source, /localStorage\.setItem\([^\n]+prompt/);
  assert.match(source, /gaigs-jarvis-v2\.qw01\.chatgpt\.site/);
  assert.match(source, /\/api\/agent-hub/);
  assert.match(source, /setInterval/);
});

test("peer sync signs packets and requires explicit WebRTC pairing", () => {
  const source = read("gaigs/peer-mesh-v2.js");
  assert.match(source, /ECDSA/);
  assert.match(source, /RTCPeerConnection/);
  assert.match(source, /createInvite/);
  assert.match(source, /acceptAnswer/);
  assert.match(source, /Signature check failed/);
});

test("Drive video feed retains source links and a substantial public index", () => {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read("gaigs/creator-library-data.js"), context);
  const library = context.window.GAIGSCreatorLibrary;
  const items = [...library.rootFiles, ...library.folders.flatMap(folder => folder.items || [])];
  assert.ok(items.filter(item => item.type === "video").length >= 250);
  assert.ok(items.filter(item => item.type === "video").every(item => /^https:\/\/drive\.google\.com\/file\/d\//.test(item.url)));
  assert.match(read("gaigs/video-feed-v2.js"), /drive\.google\.com\/thumbnail/);
});

test("Android background mode is visible and never always-listening", () => {
  const service = read("mobile/android/app/src/main/java/com/futureworldvision/gaigs/JarvisForegroundService.java");
  const plugin = read("mobile/android/app/src/main/java/com/futureworldvision/gaigs/JarvisDevicePlugin.java");
  const config = JSON.parse(read("mobile/capacitor.config.json"));
  assert.match(service, /startForeground/);
  assert.match(service, /scheduleWithFixedDelay/);
  assert.match(service, /\/api\/agent-hub/);
  assert.match(service, /5, TimeUnit\.MINUTES/);
  assert.match(service, /ACTION_STOP/);
  assert.match(service, /ACTION_REFRESH/);
  assert.match(service, /START_STICKY/);
  assert.match(plugin, /alwaysListening", false/);
  assert.match(plugin, /executeSafeCommand/);
  assert.match(plugin, /open_wifi_settings/);
  assert.doesNotMatch(plugin, /Runtime\.getRuntime|ProcessBuilder|\bsu\b/);
  assert.equal(config.appId, "com.futureworldvision.gaigs.jarvis");
  assert.equal(config.android.allowMixedContent, false);
  assert.equal(config.android.webContentsDebuggingEnabled, false);
});

test("mobile command center uses verified APIs and a reviewed release channel", () => {
  const personal = read("gaigs/personal-jarvis-v2.js");
  const builder = read("scripts/build-sites.js");
  const release = JSON.parse(read("gaigs/jarvis-release.json"));
  assert.match(personal, /MOBILE COMMAND CENTER/);
  assert.match(personal, /\/api\/mission-brief/);
  assert.match(personal, /executeSafeCommand/);
  assert.match(personal, /jarvis-release\.json/);
  assert.match(builder, /\/api\/jarvis-assist/);
  assert.equal(release.versionCode, 5);
  assert.match(release.downloadUrl, /^https:\/\/gaigs-jarvis-v2\.qw01\.chatgpt\.site\//);
});
