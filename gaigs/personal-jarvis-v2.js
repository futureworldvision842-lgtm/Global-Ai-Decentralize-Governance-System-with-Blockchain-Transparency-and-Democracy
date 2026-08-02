/* Personal JARVIS v2: encrypted device memory, adaptive UI, agent telemetry and safe updates. */
(function () {
  "use strict";

  const DB_NAME = "gaigs-personal-jarvis-v2";
  const DB_VERSION = 1;
  const usageKey = "gaigsJarvisUsageV2";
  const preferencesKey = "gaigsJarvisPreferencesV2";
  const CLOUD_HUB_URL = "https://gaigs-jarvis-v2.qw01.chatgpt.site";
  const hub = {
    checking: false,
    lastChecked: 0,
    agents: {},
    memoryCount: 0,
    mesh: { state: "offline", queued: 0, received: 0 },
    device: { native: false, enabled: false, networkAvailable: navigator.onLine, batteryPercent: -1, appVersion: "web" },
    missionBrief: { signals: [], sourceStatus: [], generatedAt: null },
    message: "Your private device workspace is ready. Pair a PC bridge only when you want local agents here."
  };
  let lastJarvisAction = null;
  document.addEventListener("click", event => { const source = event.target.closest("[data-jarvis-action]"); if (source) lastJarvisAction = source; }, true);

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
        if (!db.objectStoreNames.contains("memory")) db.createObjectStore("memory", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Private memory could not open."));
    });
  }

  async function dbOperation(storeName, mode, operation) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let request;
      try { request = operation(store); } catch (error) { db.close(); reject(error); return; }
      tx.oncomplete = () => { db.close(); resolve(request && "result" in request ? request.result : undefined); };
      tx.onerror = () => { db.close(); reject(tx.error || new Error("Private memory operation failed.")); };
    });
  }

  async function memoryKey() {
    let key = await dbOperation("meta", "readonly", store => store.get("aes-key"));
    if (!key) {
      key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      await dbOperation("meta", "readwrite", store => store.put(key, "aes-key"));
    }
    return key;
  }

  function toBase64(bytes) {
    let binary = "";
    const view = new Uint8Array(bytes);
    for (let index = 0; index < view.length; index += 1) binary += String.fromCharCode(view[index]);
    return btoa(binary);
  }

  function fromBase64(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const vault = {
    async remember(kind, value, tags = []) {
      const key = await memoryKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const id = crypto.randomUUID();
      const body = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(value)));
      await dbOperation("memory", "readwrite", store => store.put({ id, kind, tags, iv: toBase64(iv), body: toBase64(body), createdAt: new Date().toISOString() }));
      return id;
    },
    async recent(limit = 8) {
      const records = await dbOperation("memory", "readonly", store => store.getAll()) || [];
      const key = await memoryKey();
      const output = [];
      for (const record of records.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, limit)) {
        try {
          const body = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(record.iv) }, key, fromBase64(record.body));
          output.push({ ...record, value: JSON.parse(decoder.decode(body)) });
        } catch (error) { output.push({ ...record, value: { text: "Unreadable encrypted record" } }); }
      }
      return output;
    },
    async count() { return (await dbOperation("memory", "readonly", store => store.count())) || 0; },
    async clear() { await dbOperation("memory", "readwrite", store => store.clear()); }
  };

  function preferences() {
    const defaults = { proactiveBrief: true, rememberPrompts: true, background: false, bridgeUrl: CLOUD_HUB_URL };
    try {
      const stored = { ...defaults, ...JSON.parse(localStorage.getItem(preferencesKey) || "{}") };
      if (stored.bridgeUrl === "http://192.168.100.238:8090") stored.bridgeUrl = CLOUD_HUB_URL;
      return stored;
    }
    catch (error) { return defaults; }
  }

  function savePreferences(next) { localStorage.setItem(preferencesKey, JSON.stringify({ ...preferences(), ...next })); }

  function usage() {
    try { return JSON.parse(localStorage.getItem(usageKey) || "{}"); } catch (error) { return {}; }
  }

  function recordUsage(view) {
    const current = usage();
    current[view] = (current[view] || 0) + 1;
    current.lastView = view;
    current.updatedAt = new Date().toISOString();
    localStorage.setItem(usageKey, JSON.stringify(current));
  }

  function topWorkspaces() {
    const names = { feed: "Action Feed", mission: "Mission Desk", videoFeed: "Video Feed", services: "Skills & Work", governance: "Governance", communities: "Communities", map: "Nearby Map", messages: "Messages", science: "Humanity Lab", treasury: "Wallet" };
    return Object.entries(usage()).filter(([key, value]) => names[key] && Number.isFinite(value)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([view, visits]) => ({ view, label: names[view], visits }));
  }

  async function nativeAgentHub(endpoint) {
    const plugin = window.Capacitor?.Plugins?.JarvisBridge;
    if (!plugin) return null;
    const result = await plugin.getAgentHub({ endpoint });
    return result && (result.data || result);
  }

  async function refreshDeviceStatus() {
    const plugin = window.Capacitor?.Plugins?.JarvisDevice;
    if (!plugin) {
      hub.device = { native: false, enabled: false, networkAvailable: navigator.onLine, batteryPercent: -1, appVersion: "web/PWA", status: "Open the Android app for real device controls." };
      return hub.device;
    }
    const status = await plugin.getStatus();
    hub.device = { native: true, ...status };
    return hub.device;
  }

  async function refreshMissionBrief(force = false) {
    if (!force && hub.missionBrief.generatedAt && Date.now() - new Date(hub.missionBrief.generatedAt).getTime() < 15 * 60 * 1000) return hub.missionBrief;
    try {
      const response = await fetch(`${CLOUD_HUB_URL}/api/mission-brief`, { headers: { accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(12000) });
      const brief = await response.json();
      if (!response.ok && !brief.signals?.length) throw new Error(brief.error || `Mission sources returned ${response.status}.`);
      hub.missionBrief = brief;
    } catch (error) {
      hub.missionBrief = { ...hub.missionBrief, error: error.message || "Mission sources are temporarily unavailable." };
    }
    return hub.missionBrief;
  }

  function isPrivateBridge(endpoint) {
    try {
      const host = new URL(endpoint).hostname;
      return host === "localhost" || host === "127.0.0.1" || host === "::1" || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    } catch (error) { return false; }
  }

  async function webAgentHub(endpoint) {
    const url = new URL(endpoint, location.href);
    if (!/^https?:$/.test(url.protocol)) throw new Error("Use an HTTP or HTTPS bridge URL.");
    const response = await fetch(new URL("/api/agent-hub", url).href, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!response.ok) throw new Error(`Bridge returned ${response.status}.`);
    return response.json();
  }

  async function refreshAgents(force = false) {
    if (hub.checking || (!force && Date.now() - hub.lastChecked < 20000)) return;
    hub.checking = true;
    const prefs = preferences();
    const localCapabilities = {
      personal: { name: "Personal JARVIS", status: "ready", detail: "Voice, navigation and encrypted device memory" },
      world: { name: "World Monitor", status: navigator.onLine ? "ready" : "offline", detail: navigator.onLine ? "Official mission sources available on demand" : "Cached brief remains available offline" },
      mesh: { name: "Peer Mesh", status: window.GAIGSPeerMesh ? "ready" : "unavailable", detail: "Signed local queue and consent-based WebRTC pairing" },
      moltbot: { name: "MoltBot", status: "not-paired", detail: "Pair your PC bridge to check the local gateway" },
      hermes: { name: "Hermes Agent", status: "not-paired", detail: "Pair your PC bridge to delegate approved research tasks" }
    };
    hub.agents = localCapabilities;
    try {
      let remote = null;
      if (window.Capacitor && isPrivateBridge(prefs.bridgeUrl)) remote = await nativeAgentHub(prefs.bridgeUrl).catch(() => null);
      if (!remote) remote = await webAgentHub(prefs.bridgeUrl);
      for (const agent of remote.agents || []) hub.agents[agent.id || agent.name.toLowerCase()] = agent;
      hub.message = remote.online === false
        ? (remote.message || "JARVIS cloud heartbeat is waiting for the PC supervisor.")
        : `Live heartbeat received from ${remote.name || "your JARVIS PC bridge"}. Commands still require confirmation.`;
    } catch (error) {
      hub.message = window.Capacitor ? `Personal mobile JARVIS is active. PC agents are not paired: ${error.message}` : "Personal web JARVIS is active. A local PC bridge can be paired from the Android app or a secure HTTPS endpoint.";
    }
    await Promise.all([refreshDeviceStatus().catch(() => hub.device), refreshMissionBrief(false).catch(() => hub.missionBrief)]);
    hub.memoryCount = await vault.count().catch(() => 0);
    if (window.GAIGSPeerMesh) hub.mesh = await window.GAIGSPeerMesh.stats().catch(() => hub.mesh);
    hub.checking = false;
    hub.lastChecked = Date.now();
    if (state.view === "jarvisHub") render();
  }

  function statusClass(value) { return value === "online" || value === "ready" || value === "connected" ? "online" : value === "checking" ? "checking" : "offline"; }
  function agentCards() {
    return Object.values(hub.agents).map(agent => `<article class="jarvis-agent-card"><div class="agent-card-top"><span class="agent-mark ${statusClass(agent.status)}">${esc((agent.name || "A").split(" ").map(word => word[0]).join("").slice(0, 2))}</span><span class="agent-state ${statusClass(agent.status)}">${esc(agent.status || "unknown")}</span></div><h3>${esc(agent.name || "Agent")}</h3><p>${esc(agent.detail || "No telemetry received.")}</p><small>${agent.lastSeen ? `Last seen ${esc(agent.lastSeen)}` : "No hidden authority · human approval required"}</small></article>`).join("");
  }

  function memoryRows(records = []) {
    if (!records.length) return '<div class="empty-state compact"><h3>No private memories yet</h3><p>Add a preference, goal or working note. It stays encrypted on this device.</p></div>';
    return records.map(record => { const value = record.value || {}, label = value.text || value.prompt || value.title || "Private memory"; return `<div class="jarvis-memory-row"><span>${esc(record.kind || "note")}</span><div><b>${esc(String(label).slice(0, 130))}</b><small>${esc(new Date(record.createdAt).toLocaleString())}</small></div></div>`; }).join("");
  }

  function adaptiveRows() {
    const top = topWorkspaces();
    if (!top.length) return '<p class="muted">Use the app and JARVIS will place your most-used workspaces here—only on this device.</p>';
    return top.map((item, index) => `<button data-view="${esc(item.view)}"><span>0${index + 1}</span><div><b>${esc(item.label)}</b><small>${item.visits} device visit${item.visits === 1 ? "" : "s"}</small></div><i>→</i></button>`).join("");
  }

  function devicePanel() {
    const device = hub.device || {};
    const syncLabel = device.lastSyncAt ? new Date(Number(device.lastSyncAt)).toLocaleString() : "Not synced yet";
    const battery = Number(device.batteryPercent) >= 0 ? `${device.batteryPercent}%${device.charging ? " · charging" : ""}` : "Web view";
    return `<div class="jarvis-device-grid">
      <div><span>DEVICE</span><b>${esc(device.device || (device.native ? "Android" : "Browser / PWA"))}</b></div>
      <div><span>BATTERY</span><b>${esc(battery)}</b></div>
      <div><span>NETWORK</span><b class="${device.networkAvailable ? "device-good" : "device-warn"}">${device.networkAvailable ? "Connected" : "Offline"}</b></div>
      <div><span>MOBILE CORE</span><b class="${device.enabled ? "device-good" : "device-warn"}">${device.enabled ? "Visible & active" : "Paused"}</b></div>
      <div><span>PC HUB</span><b class="${device.hubOnline ? "device-good" : "device-warn"}">${device.hubOnline ? `${Number(device.readyAgents || 0)} agents ready` : "Independent / offline"}</b></div>
      <div><span>LAST SYNC</span><b>${esc(syncLabel)}</b></div>
    </div>`;
  }

  function missionSignalRows() {
    const brief = hub.missionBrief || {};
    const signals = (brief.signals || []).slice(0, 3);
    if (!signals.length) return `<p class="muted">${esc(brief.error || "Checking NASA EONET and GDACS public mission sources...")}</p>`;
    return signals.map(signal => `<a class="jarvis-signal-row" href="${esc(signal.url)}" target="_blank" rel="noopener"><span class="tag ${signal.priority === "urgent" ? "red" : signal.priority === "high" ? "gold" : ""}">${esc(signal.priority || "watch")}</span><div><b>${esc(signal.title)}</b><small>${esc(signal.location || signal.category || "Global")} · ${esc(signal.source?.name || "Official source")}</small></div><i>↗</i></a>`).join("");
  }

  function assistantResponse(text) {
    const chat = $("#jarvisChat");
    if (chat) {
      const bubble = document.createElement("div");
      bubble.className = "ai-msg";
      bubble.textContent = text;
      chat.appendChild(bubble);
      chat.scrollTop = chat.scrollHeight;
    }
    jarvisSpeak(text);
  }

  async function executeDeviceCommand(action) {
    const plugin = window.Capacitor?.Plugins?.JarvisDevice;
    if (!plugin) throw new Error("This owner-approved device command is available in the Android app.");
    await plugin.executeSafeCommand({ action });
    if (action === "refresh_presence") setTimeout(() => refreshDeviceStatus().then(() => { if (state.view === "jarvisHub") render(); }), 1000);
    toast("Owner-approved device action opened.");
  }

  async function runMobileCommand(prompt) {
    const text = String(prompt || "").trim();
    if (!text) return;
    if (/battery|charging|internet|network|device status|mobile status/i.test(text)) {
      const device = await refreshDeviceStatus();
      const battery = Number(device.batteryPercent) >= 0 ? `${device.batteryPercent}%${device.charging ? " and charging" : ""}` : "not available in the web view";
      assistantResponse(`Device status: battery ${battery}; network ${device.networkAvailable ? "connected" : "offline"}; mobile core ${device.enabled ? "active" : "paused"}; PC hub ${device.hubOnline ? "linked" : "independent or offline"}.`);
      if (state.view === "jarvisHub") render();
      return;
    }
    if (/global|news|emergency|flood|earthquake|disaster|mission brief/i.test(text)) {
      const brief = await refreshMissionBrief(true);
      const top = (brief.signals || []).slice(0, 3);
      assistantResponse(top.length ? `Latest verified public signals: ${top.map(item => `${item.title} (${item.location || item.category})`).join("; ")}. Open Mission Desk or the source links before acting.` : (brief.error || "Mission sources are temporarily unavailable."));
      if (state.view === "jarvisHub") render();
      return;
    }
    const setting = /wi-?fi/i.test(text) ? "open_wifi_settings" : /bluetooth/i.test(text) ? "open_bluetooth_settings" : /location settings/i.test(text) ? "open_location_settings" : /battery settings|battery optimization/i.test(text) ? "open_battery_settings" : /notification settings/i.test(text) ? "open_notification_settings" : /app settings/i.test(text) ? "open_app_settings" : "";
    if (setting) { await executeDeviceCommand(setting); return; }
    $("#jarvisPanel")?.classList.add("open");
    return askJarvis(text);
  }

  function meshPanel() {
    const stats = hub.mesh || {};
    return `<div class="mesh-summary"><div><span class="mesh-live ${statusClass(stats.state)}"></span><p><b>${esc(stats.state || "offline")}</b><small>${stats.queued || 0} queued · ${stats.received || 0} received</small></p></div><span>Device-only keys · signed packets</span></div>
      <div class="mesh-pair-grid"><label><span>Pairing code / answer</span><textarea id="meshPairCode" rows="4" placeholder="Create an invite here, or paste a code from the other device."></textarea></label><div class="mesh-actions"><button class="ghost-btn" data-jarvis-action="meshInvite">Create invite</button><button class="ghost-btn" data-jarvis-action="meshAccept">Accept invite</button><button class="ghost-btn" data-jarvis-action="meshComplete">Complete pairing</button></div></div>
      <div class="rule-actions"><button class="mini-btn" data-jarvis-action="meshTest">Send signed test</button><button class="mini-btn" data-jarvis-action="meshExport">Export offline bundle</button><label class="mini-btn file-action">Import bundle<input id="meshBundleInput" type="file" accept="application/json"></label></div>
      <p class="fine-print">Direct WebRTC uses manual pairing and local network candidates; it does not silently scan Bluetooth or nearby devices. Bundle export keeps store-and-forward useful when no live path exists.</p>`;
  }

  views.jarvisHub = function () {
    const prefs = preferences();
    return `${pageHead("Personal JARVIS", "A private assistant that learns your chosen preferences, speaks, remembers locally and connects approved agents without taking human authority.", '<button class="ghost-btn" data-jarvis-action="refreshAgents">Refresh agents</button><button class="action-btn" data-jarvis-action="openAssistant">Talk to JARVIS</button>')}
      <section class="jarvis-v2-hero"><div><span class="overview-kicker"><b>YOUR DEVICE · YOUR MEMORY</b> PERSONAL INTELLIGENCE</span><h2>Always available.<br><em>Never above you.</em></h2><p>JARVIS adapts navigation and assistance to your habits on this device. Publishing, voting, wallet transfers, agent delegation and sensitive access always need your action.</p><div class="jarvis-v2-hero-actions"><button data-jarvis-action="openAssistant">Start voice conversation</button><button data-jarvis-action="connectBridge">Pair PC agents</button></div></div><div class="jarvis-core-visual" aria-hidden="true"><span></span><span></span><span></span><b>J</b><small>LOCAL CORE</small></div></section>
      <div class="capability-strip"><span class="tag green">PRIVATE BY DEFAULT</span><b>${hub.memoryCount} encrypted memories</b><span>${esc(hub.message)}</span></div>
      <div class="dashboard-grid">
        <section class="card span-8"><div class="card-head"><div class="card-title">AGENT DIRECTORY</div><span class="tag ${hub.checking ? "gold" : "green"}">${hub.checking ? "CHECKING" : "CONSENT GATE ACTIVE"}</span></div><div class="card-body"><div class="jarvis-agent-grid">${agentCards()}</div></div></section>
        <section class="card span-4"><div class="card-head"><div class="card-title">ADAPTIVE HOME</div><span class="tag">DEVICE SIGNALS ONLY</span></div><div class="card-body"><div class="adaptive-workspaces">${adaptiveRows()}</div></div></section>
        <section class="card span-6"><div class="card-head"><div class="card-title">ENCRYPTED MEMORY VAULT</div><span class="tag green">AES-256-GCM</span></div><div class="card-body"><form id="jarvisMemoryForm" class="jarvis-memory-form"><label>What should your JARVIS remember?<textarea id="jarvisMemoryText" rows="3" maxlength="500" placeholder="Example: Prefer concise Urdu briefings and show local community missions first."></textarea></label><button class="action-btn" type="submit">Save only on this device</button></form><div id="jarvisMemoryRows" class="jarvis-memory-list"><div class="mission-loading"><span></span><span></span><span></span><p>Opening encrypted memory…</p></div></div><button class="text-danger" data-jarvis-action="clearMemory">Erase my local JARVIS memory</button></div></section>
        <section class="card span-6"><div class="card-head"><div class="card-title">OFFLINE PEER SYNC</div><span class="tag">MANUAL CONSENT</span></div><div class="card-body">${meshPanel()}</div></section>
        <section class="card span-6"><div class="card-head"><div class="card-title">MOBILE COMMAND CENTER</div><span class="tag ${hub.device?.native ? "green" : "gold"}">${hub.device?.native ? "REAL DEVICE" : "ANDROID APP REQUIRED"}</span></div><div class="card-body">${devicePanel()}<form id="mobileCommandForm" class="mobile-command-form"><input id="mobileCommandInput" maxlength="500" placeholder="Try: check battery, global brief, open Wi-Fi settings"><button class="action-btn" type="submit">Run</button></form><div class="device-command-row"><button class="mini-btn" data-device-command="refresh_presence">Refresh core</button><button class="mini-btn" data-device-command="open_wifi_settings">Wi-Fi</button><button class="mini-btn" data-device-command="open_battery_settings">Battery</button><button class="mini-btn" data-device-command="open_notification_settings">Notifications</button></div><p class="fine-print">Only visible, allow-listed device actions run. No arbitrary shell, hidden microphone, silent posting or unrestricted device control.</p></div></section>
        <section class="card span-6"><div class="card-head"><div class="card-title">LIVE MISSION SIGNALS</div><span class="tag green">PUBLIC APIs</span></div><div class="card-body"><div class="jarvis-signal-list">${missionSignalRows()}</div><button class="ghost-btn" data-jarvis-action="missionBrief">Refresh verified signals</button><p class="fine-print">Sources: NASA EONET and GDACS. Verify locally before creating a response or sharing sensitive locations.</p></div></section>
        <section class="card span-6"><div class="card-head"><div class="card-title">MOBILE PRESENCE</div><span class="tag ${prefs.background ? "green" : "gold"}">${prefs.background ? "OPTED IN" : "OFF BY DEFAULT"}</span></div><div class="card-body"><div class="jarvis-control-list"><label><input type="checkbox" data-jarvis-toggle="proactiveBrief" ${prefs.proactiveBrief ? "checked" : ""}><div><b>Proactive daily briefing</b><small>Prepared when the app opens; no hidden posting.</small></div></label><label><input type="checkbox" data-jarvis-toggle="rememberPrompts" ${prefs.rememberPrompts ? "checked" : ""}><div><b>Remember my prompts locally</b><small>Encrypted on this device and erasable at any time.</small></div></label><label><input type="checkbox" data-jarvis-toggle="background" ${prefs.background ? "checked" : ""}><div><b>Opt-in Android node presence</b><small>Visible notification checks JARVIS status about every five minutes. It uses a small amount of data and battery, never keeps the microphone open, and can be stopped here at any time.</small></div></label></div><p class="muted">Android can pause background work under extreme battery saving. The phone remains a user-controlled client/peer—not a hidden server and not an unrestricted executor.</p></div></section>
        <section class="card span-6"><div class="card-head"><div class="card-title">SAFE EVOLUTION</div><span class="tag green">SIGNED RELEASES</span></div><div class="card-body"><div class="evolution-card"><span>v2</span><div><h3>JARVIS can adapt, not secretly rewrite itself.</h3><p>Usage changes local recommendations. App code updates arrive through reviewed, signed releases with a visible version and rollback path.</p><button class="ghost-btn" data-jarvis-action="checkUpdate">Check for a reviewed update</button></div></div></div></section>
      </div>`;
  };
  viewNames.jarvisHub = "Personal JARVIS";

  async function renderMemory() {
    const target = $("#jarvisMemoryRows");
    if (!target) return;
    const records = await vault.recent().catch(() => []);
    hub.memoryCount = await vault.count().catch(() => records.length);
    if (target.isConnected) target.innerHTML = memoryRows(records);
  }

  async function setBackground(enabled) {
    const plugin = window.Capacitor?.Plugins?.JarvisDevice;
    if (!plugin) {
      savePreferences({ background: false });
      toast("Foreground presence is available in the Android app. The website cannot stay alive after the browser closes.");
      return false;
    }
    if (enabled) await plugin.startBackground(); else await plugin.stopBackground();
    savePreferences({ background: enabled });
    await refreshDeviceStatus().catch(() => {});
    toast(enabled ? "Visible JARVIS foreground presence enabled." : "JARVIS foreground presence stopped.");
    return true;
  }

  async function handleJarvisAction(actionName) {
    if (actionName === "openAssistant") { $("#jarvisPanel")?.classList.add("open"); $("#jarvisInput")?.focus(); return; }
    if (actionName === "refreshAgents") { hub.lastChecked = 0; await refreshAgents(true); return; }
    if (actionName === "connectBridge") {
      const prefs = preferences();
      openModal(`<h2>Choose your JARVIS connection</h2><p class="muted">The public GAIGS cloud URL receives status-only heartbeats. On your home Wi-Fi, you may instead enter the private PC bridge address for direct status checks.</p><label class="modal-label">Bridge address<input id="jarvisBridgeUrl" value="${esc(prefs.bridgeUrl)}" placeholder="${CLOUD_HUB_URL}"></label><button class="action-btn" data-jarvis-action="saveBridge">Save and test</button>`);
      return;
    }
    if (actionName === "saveBridge") {
      const value = $("#jarvisBridgeUrl")?.value.trim();
      if (!value) return toast("Enter your bridge address.");
      savePreferences({ bridgeUrl: value }); hub.lastChecked = 0; await refreshAgents(true); $("#actionModal")?.classList.remove("open"); return;
    }
    if (actionName === "clearMemory") {
      if (!confirm("Erase every encrypted JARVIS memory stored on this device? This cannot be undone.")) return;
      await vault.clear(); hub.memoryCount = 0; await renderMemory(); toast("Local JARVIS memory erased."); return;
    }
    if (actionName === "missionBrief") {
      await refreshMissionBrief(true);
      if (state.view === "jarvisHub") render();
      toast((hub.missionBrief.signals || []).length ? "Verified public mission signals refreshed." : (hub.missionBrief.error || "Mission sources are temporarily unavailable."));
      return;
    }
    if (actionName === "checkUpdate") {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration) await registration.update();
      try {
        const [release, device] = await Promise.all([
          fetch(`${CLOUD_HUB_URL}/gaigs/jarvis-release.json?ts=${Date.now()}`, { cache: "no-store" }).then(response => { if (!response.ok) throw new Error(`Release channel returned ${response.status}.`); return response.json(); }),
          refreshDeviceStatus().catch(() => hub.device),
        ]);
        const updateAvailable = Number(release.versionCode || 0) > Number(device.versionCode || 0);
        openModal(`<h2>${updateAvailable ? "Reviewed update available" : "JARVIS is up to date"}</h2><p class="muted">Installed: ${esc(device.appVersion || "web/PWA")} · Release: ${esc(release.versionName || "unknown")}</p><div class="identity-shield"><span>✓</span><div><b>Published checksum</b><small>${esc(release.sha256 || "Checksum pending")}</small></div></div>${updateAvailable || !device.native ? `<a class="action-btn release-download" href="${esc(release.downloadUrl)}" target="_blank" rel="noopener">Download reviewed APK</a>` : ""}<p class="fine-print">Android shows the installation screen; JARVIS never silently installs or rewrites itself.</p>`);
      } catch (error) { toast(error.message || "Reviewed release channel is unavailable."); }
      return;
    }
    const mesh = window.GAIGSPeerMesh;
    if (!mesh) return toast("Peer sync is unavailable on this device.");
    const textArea = $("#meshPairCode");
    if (actionName === "meshInvite") { textArea.value = await mesh.createInvite(); textArea.select(); await navigator.clipboard?.writeText(textArea.value).catch(() => {}); toast("Invite created and copied. Share it directly with the device you trust."); return; }
    if (actionName === "meshAccept") { textArea.value = await mesh.acceptInvite(textArea.value); textArea.select(); await navigator.clipboard?.writeText(textArea.value).catch(() => {}); toast("Answer created. Return it to the inviting device."); return; }
    if (actionName === "meshComplete") { await mesh.acceptAnswer(textArea.value); toast("Pairing answer accepted. Waiting for the direct channel."); return; }
    if (actionName === "meshTest") { await mesh.send("test", { text: "Signed GAIGS peer test", from: state.user?.name || "Member" }, state.scope); hub.mesh = await mesh.stats(); render(); return; }
    if (actionName === "meshExport") { const count = await mesh.exportBundle(); toast(`${count} queued signed record${count === 1 ? "" : "s"} exported.`); return; }
  }

  const priorNavigate = navigate;
  navigate = function (view) { recordUsage(view); return priorNavigate(view); };

  const priorAskJarvis = askJarvis;
  askJarvis = async function (prompt) {
    const prefs = preferences();
    if (prefs.rememberPrompts) await vault.remember("prompt", { prompt: String(prompt).slice(0, 800) }, [state.view, state.scope]).catch(() => {});
    if (/what do you (remember|know)|show my memor/i.test(prompt)) {
      const records = await vault.recent(5).catch(() => []);
      const summary = records.length ? `I have ${await vault.count()} encrypted device memories. Recent items: ${records.map(item => item.value.text || item.value.prompt || item.kind).join("; ")}.` : "I do not have any saved private memories yet.";
      const bubble = document.createElement("div"); bubble.className = "ai-msg"; bubble.textContent = summary; $("#jarvisChat")?.appendChild(bubble); jarvisSpeak(summary); return;
    }
    return priorAskJarvis(prompt);
  };

  const priorBindDynamic = bindDynamic;
  bindDynamic = function () {
    priorBindDynamic();
    $$('[data-jarvis-action]').forEach(button => {
      if (button.dataset.jarvisV2Bound) return;
      button.dataset.jarvisV2Bound = "1";
      button.addEventListener("click", event => { event.preventDefault(); lastJarvisAction = button; handleJarvisAction(button.dataset.jarvisAction).catch(error => toast(error.message || "JARVIS action failed.")); });
    });
    $$('[data-device-command]').forEach(button => {
      if (button.dataset.jarvisDeviceBound) return;
      button.dataset.jarvisDeviceBound = "1";
      button.addEventListener("click", event => { event.preventDefault(); executeDeviceCommand(button.dataset.deviceCommand).catch(error => toast(error.message || "Device action failed.")); });
    });
    $$('[data-jarvis-toggle]').forEach(input => {
      if (input.dataset.jarvisV2Bound) return;
      input.dataset.jarvisV2Bound = "1";
      input.addEventListener("change", async () => {
        const key = input.dataset.jarvisToggle;
        if (key === "background") { const ok = await setBackground(input.checked).catch(error => { toast(error.message); return false; }); if (!ok) input.checked = false; return; }
        savePreferences({ [key]: input.checked }); toast("JARVIS preference saved on this device.");
      });
    });
    const form = $("#jarvisMemoryForm");
    if (form && !form.dataset.bound) {
      form.dataset.bound = "1";
      form.addEventListener("submit", async event => {
        event.preventDefault(); const input = $("#jarvisMemoryText"), text = input?.value.trim(); if (!text) return;
        await vault.remember("preference", { text }, ["user-approved"]); input.value = ""; await renderMemory(); toast("Encrypted memory saved only on this device.");
      });
    }
    const mobileCommandForm = $("#mobileCommandForm");
    if (mobileCommandForm && !mobileCommandForm.dataset.bound) {
      mobileCommandForm.dataset.bound = "1";
      mobileCommandForm.addEventListener("submit", async event => {
        event.preventDefault();
        const input = $("#mobileCommandInput"), text = input?.value.trim();
        if (!text) return;
        input.value = "";
        await runMobileCommand(text).catch(error => toast(error.message || "Mobile command failed."));
      });
    }
    const bundleInput = $("#meshBundleInput");
    if (bundleInput && !bundleInput.dataset.bound) {
      bundleInput.dataset.bound = "1";
      bundleInput.addEventListener("change", async () => { const file = bundleInput.files?.[0]; if (!file) return; const added = await window.GAIGSPeerMesh.importBundle(JSON.parse(await file.text())); hub.mesh = await window.GAIGSPeerMesh.stats(); toast(`${added} signed records imported.`); render(); });
    }
    if (state.view === "jarvisHub") { renderMemory(); refreshAgents(false); }
  };

  const priorOverview = views.overview;
  views.overview = function () {
    const top = topWorkspaces();
    const strip = `<section class="jarvis-adaptive-strip"><div class="jarvis-adaptive-orb">J</div><div><span>PERSONAL JARVIS</span><b>${top.length ? `Your dashboard now prioritizes ${esc(top.map(item => item.label).join(", "))}.` : "Your dashboard will adapt locally as you use it."}</b><small>Encrypted memory and usage signals stay on this device unless you explicitly share a record.</small></div><button data-view="jarvisHub">Open my JARVIS →</button></section>`;
    return strip + priorOverview();
  };

  if (window.GAIGSPeerMesh) window.GAIGSPeerMesh.on(event => { if (event.type === "state" || event.type === "message" || event.type === "queued") window.GAIGSPeerMesh.stats().then(stats => { hub.mesh = stats; if (state.view === "jarvisHub") render(); }); });
  window.GAIGSPersonalJarvis = { vault, refreshAgents, refreshDeviceStatus, refreshMissionBrief, runMobileCommand, preferences };
  refreshAgents(false).catch(() => {});
  setInterval(() => { if (!document.hidden && state.view === "jarvisHub") refreshAgents(true).catch(() => {}); }, 30000);
  if (state.user) render();
})();
