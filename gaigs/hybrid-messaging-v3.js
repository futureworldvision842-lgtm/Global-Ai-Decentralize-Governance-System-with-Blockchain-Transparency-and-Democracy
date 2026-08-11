/* GAIGS Hybrid Messaging v3
 * Private chat plaintext stays on participant devices. The hosted service stores
 * only per-device ECDH/AES-GCM envelopes and a tamper-evident receipt chain.
 * Nearby relay is opt-in, bounded by TTL and carries opaque signed packets.
 */
(function () {
  "use strict";

  const DB_NAME = "gaigs-hybrid-messaging-v3";
  const DB_VERSION = 1;
  const INFO = new TextEncoder().encode("GAIGS-DM-v1");
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const nativeNearby = window.Capacitor?.Plugins?.GaigsNearby || null;
  const local = { messages: [], peers: new Map(), mesh: { running: false, connectedPeers: 0, pendingRequests: 0 }, tab: "chats", room: "city", syncing: false, registered: false };
  const seen = new Map();
  let pollTimer = null;

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("identity")) db.createObjectStore("identity", { keyPath: "id" });
        if (!db.objectStoreNames.contains("messages")) db.createObjectStore("messages", { keyPath: "id" });
        if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "id" });
        if (!db.objectStoreNames.contains("peers")) db.createObjectStore("peers", { keyPath: "deviceId" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Private messaging storage could not open."));
    });
  }

  async function storeAction(name, mode, operation) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(name, mode), store = tx.objectStore(name);
      let request;
      try { request = operation(store); } catch (error) { db.close(); reject(error); return; }
      tx.oncomplete = () => { db.close(); resolve(request && "result" in request ? request.result : undefined); };
      tx.onerror = () => { db.close(); reject(tx.error || new Error("Private messaging storage failed.")); };
    });
  }

  const getOne = (store, key) => storeAction(store, "readonly", objectStore => objectStore.get(key));
  const getAll = store => storeAction(store, "readonly", objectStore => objectStore.getAll());
  const putOne = (store, value) => storeAction(store, "readwrite", objectStore => objectStore.put(value));
  const removeOne = (store, key) => storeAction(store, "readwrite", objectStore => objectStore.delete(key));

  function base64(bytes) {
    let value = ""; const view = new Uint8Array(bytes);
    for (let index = 0; index < view.length; index += 1) value += String.fromCharCode(view[index]);
    return btoa(value);
  }
  function bytes(value) {
    const binary = atob(value), result = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) result[index] = binary.charCodeAt(index);
    return result;
  }
  function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  }

  async function createIdentity() {
    const encryptionPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const signingPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const [encryptionPublicKey, encryptionPrivateJwk, signingPublicKey, signingPrivateJwk] = await Promise.all([
      crypto.subtle.exportKey("jwk", encryptionPair.publicKey), crypto.subtle.exportKey("jwk", encryptionPair.privateKey),
      crypto.subtle.exportKey("jwk", signingPair.publicKey), crypto.subtle.exportKey("jwk", signingPair.privateKey),
    ]);
    const [encryptionPrivateKey, signingPrivateKey] = await Promise.all([
      crypto.subtle.importKey("jwk", encryptionPrivateJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]),
      crypto.subtle.importKey("jwk", signingPrivateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]),
    ]);
    const record = { id: "primary", deviceId: `dev_${crypto.randomUUID()}`, encryptionPrivateKey, encryptionPublicKey, signingPrivateKey, signingPublicKey, createdAt: new Date().toISOString() };
    await putOne("identity", record);
    return record;
  }

  async function identity() { return await getOne("identity", "primary") || createIdentity(); }

  async function aesKey(privateKey, publicJwk, salt) {
    const publicKey = await crypto.subtle.importKey("jwk", publicJwk, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const secret = await crypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
    const material = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt, info: INFO }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  async function encryptFor(publicJwk, payload) {
    const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await aesKey(ephemeral.privateKey, publicJwk, salt);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: INFO }, key, encoder.encode(JSON.stringify(payload)));
    return { v: 1, alg: "ECDH-P256-AESGCM", ciphertext: base64(ciphertext), iv: base64(iv), salt: base64(salt), ephemeralKey: await crypto.subtle.exportKey("jwk", ephemeral.publicKey) };
  }

  async function decryptEnvelope(envelope) {
    const owner = await identity(), key = await aesKey(owner.encryptionPrivateKey, envelope.ephemeralKey, bytes(envelope.salt));
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(envelope.iv), additionalData: INFO }, key, bytes(envelope.ciphertext));
    return JSON.parse(decoder.decode(plaintext));
  }

  async function signPacket(packet) {
    const owner = await identity(), unsigned = { ...packet }; delete unsigned.signature; delete unsigned.ttl;
    packet.signature = base64(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, owner.signingPrivateKey, encoder.encode(canonical(unsigned))));
    return packet;
  }

  async function verifyPacket(packet) {
    try {
      const unsigned = { ...packet }; delete unsigned.signature; delete unsigned.ttl;
      const key = await crypto.subtle.importKey("jwk", packet.signingPublicKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
      return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, bytes(packet.signature), encoder.encode(canonical(unsigned)));
    } catch (error) { return false; }
  }

  function rememberSeen(id) {
    const now = Date.now(); seen.set(id, now);
    for (const [key, time] of seen) if (now - time > 5 * 60000 || seen.size > 1200) seen.delete(key);
  }

  function currentUserId() { return state.user?.uid || ""; }
  function currentName() { return state.user?.name || "GAIGS member"; }
  function deviceLabel() { return window.Capacitor?.isNativePlatform?.() ? `Android · ${navigator.platform || "mobile"}` : `Web · ${navigator.platform || "browser"}`; }

  async function ensureRegistered() {
    if (!window.gaigsApi?.active?.() || local.registered) return false;
    const owner = await identity();
    await window.gaigsApi.registerMessagingDevice({ deviceId: owner.deviceId, deviceLabel: deviceLabel(), encryptionPublicKey: owner.encryptionPublicKey, signingPublicKey: owner.signingPublicKey });
    local.registered = true; return true;
  }

  async function saveMessage(record) {
    const existing = await getOne("messages", record.id);
    await putOne("messages", { ...(existing || {}), ...record });
    local.messages = await getAll("messages");
  }

  async function refreshLocal() { local.messages = await getAll("messages"); local.peers = new Map((await getAll("peers")).map(peer => [peer.deviceId, peer])); }

  async function syncOnline() {
    if (local.syncing || !navigator.onLine || !window.gaigsApi?.active?.()) return;
    local.syncing = true;
    try {
      await ensureRegistered();
      await flushOnlineOutbox();
      const response = await window.gaigsApi.messagingMessages(0);
      for (const item of response.messages || []) {
        if (await getOne("messages", item.id)) continue;
        try {
          const content = await decryptEnvelope(item.envelope);
          await saveMessage({ ...item, text: String(content.text || ""), kind: content.kind || item.kind || "text", transport: "online", direction: item.senderId === currentUserId() ? "out" : "in", otherId: item.senderId === currentUserId() ? item.recipientId : item.senderId, otherName: item.senderId === currentUserId() ? item.recipientName : item.senderName });
        } catch (error) {
          await saveMessage({ ...item, text: "Encrypted for another registered device.", locked: true, transport: "online", direction: item.senderId === currentUserId() ? "out" : "in", otherId: item.senderId === currentUserId() ? item.recipientId : item.senderId, otherName: item.senderId === currentUserId() ? item.recipientName : item.senderName });
        }
      }
      if (state.view === "messages") render();
    } catch (error) { console.info("[GAIGS] Messaging sync:", error.message); }
    finally { local.syncing = false; }
  }

  async function flushOnlineOutbox() {
    const queue = (await getAll("outbox")).filter(item => item.route === "online");
    for (const item of queue) {
      try {
        const response = await window.gaigsApi.sendEncryptedMessage(item.body);
        const draft = await getOne("messages", item.id);
        if (draft) { await removeOne("messages", item.id); await saveMessage({ ...draft, id: response.message.id, conversationId: response.message.conversationId, receipt: response.message.receipt, previousHash: response.message.previousHash, status: "sent" }); }
        await removeOne("outbox", item.id);
      } catch (error) { if (/recipient|device|register/i.test(error.message)) await removeOne("outbox", item.id); }
    }
  }

  async function sendOnline(recipient, text, kind = "text") {
    await ensureRegistered();
    const keys = await window.gaigsApi.messagingKeys(recipient.id), target = keys.devices?.[0];
    if (!target) throw new Error("This member has not activated encrypted messaging on a device yet.");
    const owner = await identity(), clientMessageId = `local_${crypto.randomUUID()}`, sentAt = new Date().toISOString();
    const content = { text, kind, sentAt, senderName: currentName() };
    const body = { recipientId: recipient.id, senderDeviceId: owner.deviceId, clientMessageId, kind, recipientEnvelope: await encryptFor(target.encryptionPublicKey, content), senderEnvelope: await encryptFor(owner.encryptionPublicKey, content) };
    const draft = { id: clientMessageId, clientMessageId, senderId: currentUserId(), recipientId: recipient.id, otherId: recipient.id, otherName: recipient.name, text, kind, direction: "out", transport: "online", status: navigator.onLine ? "sending" : "queued", createdAt: sentAt };
    await saveMessage(draft);
    await putOne("outbox", { id: clientMessageId, route: "online", body, queuedAt: sentAt });
    if (navigator.onLine) await flushOnlineOutbox();
    return draft;
  }

  async function meshPacket(type, fields = {}) {
    const owner = await identity();
    return signPacket({ v: 1, id: crypto.randomUUID(), type, createdAt: new Date().toISOString(), fromUserId: currentUserId() || `offline:${owner.deviceId}`, fromDeviceId: owner.deviceId, fromName: currentName(), signingPublicKey: owner.signingPublicKey, ttl: type === "hello" ? 1 : 6, ...fields });
  }

  async function sendNativePacket(packet, endpointId = "") {
    if (nativeNearby && local.mesh.running) return nativeNearby.send({ message: JSON.stringify(packet), ...(endpointId ? { endpointId } : {}) });
    if (window.GAIGSPeerMesh) return window.GAIGSPeerMesh.send("hybrid-message", packet, "nearby");
    throw new Error("No nearby transport is active.");
  }

  async function announce(endpointId = "") {
    const owner = await identity();
    await sendNativePacket(await meshPacket("hello", { encryptionPublicKey: owner.encryptionPublicKey }), endpointId).catch(() => {});
  }

  async function sendNearby(peer, text, kind = "text") {
    const owner = await identity(), clientMessageId = `mesh_${crypto.randomUUID()}`, sentAt = new Date().toISOString();
    const envelope = await encryptFor(peer.encryptionPublicKey, { text, kind, sentAt, senderName: currentName() });
    const packet = await meshPacket("dm", { clientMessageId, toUserId: peer.userId, toDeviceId: peer.deviceId, envelope });
    await putOne("outbox", { id: clientMessageId, route: "nearby", packet, queuedAt: sentAt });
    await saveMessage({ id: clientMessageId, clientMessageId, senderId: currentUserId(), recipientId: peer.userId, otherId: peer.userId || peer.deviceId, otherName: peer.name, text, kind, direction: "out", transport: "nearby", status: "queued", createdAt: sentAt });
    await sendNativePacket(packet, peer.endpointId).then(async () => { const saved = await getOne("messages", clientMessageId); await saveMessage({ ...saved, status: "relayed" }); }).catch(() => {});
  }

  async function receiveMeshPacket(packet, endpointId = "") {
    if (!packet?.id || seen.has(packet.id) || !await verifyPacket(packet)) return;
    rememberSeen(packet.id);
    const owner = await identity();
    if (packet.type === "hello") {
      if (packet.fromDeviceId === owner.deviceId) return;
      const peer = { deviceId: packet.fromDeviceId, userId: packet.fromUserId, name: packet.fromName || "Nearby member", signingPublicKey: packet.signingPublicKey, encryptionPublicKey: packet.encryptionPublicKey, endpointId, verified: false, lastSeenAt: new Date().toISOString() };
      await putOne("peers", peer); local.peers.set(peer.deviceId, peer); if (state.view === "messages") render(); return;
    }
    if (packet.type === "ack" && packet.toDeviceId === owner.deviceId) {
      const message = await getOne("messages", packet.ackId); if (message) await saveMessage({ ...message, status: "delivered" });
      await removeOne("outbox", packet.ackId); if (state.view === "messages") render(); return;
    }
    if (packet.type === "dm" && packet.toDeviceId === owner.deviceId) {
      try {
        const content = await decryptEnvelope(packet.envelope);
        await saveMessage({ id: packet.clientMessageId || packet.id, clientMessageId: packet.clientMessageId || packet.id, senderId: packet.fromUserId, recipientId: currentUserId(), otherId: packet.fromUserId || packet.fromDeviceId, otherName: packet.fromName || "Nearby member", text: String(content.text || ""), kind: content.kind || "text", direction: "in", transport: "nearby", status: "delivered", createdAt: content.sentAt || packet.createdAt, receipt: packet.signature });
        await sendNativePacket(await meshPacket("ack", { ackId: packet.clientMessageId || packet.id, toDeviceId: packet.fromDeviceId, toUserId: packet.fromUserId }), endpointId).catch(() => {});
        if (state.view === "messages") render();
      } catch (error) { console.warn("[GAIGS] Rejected unreadable nearby envelope."); }
      return;
    }
    if (Number(packet.ttl || 0) > 0 && local.mesh.running) {
      const relay = { ...packet, ttl: Math.min(6, Number(packet.ttl)) - 1 };
      setTimeout(() => sendNativePacket(relay).catch(() => {}), 40 + Math.floor(Math.random() * 180));
    }
  }

  async function startMesh() {
    if (!nativeNearby) throw new Error("Install the Android APK to use automatic Bluetooth/Wi-Fi nearby discovery. Browser users can use manual WebRTC peer pairing in JARVIS Hub.");
    const response = await nativeNearby.start({ displayName: currentName() });
    local.mesh = { ...local.mesh, ...response, running: true };
    localStorage.setItem("gaigsNearbyConsentV1", "enabled");
    await announce(); render();
  }
  async function stopMesh() {
    if (nativeNearby) await nativeNearby.stop();
    local.mesh = { running: false, connectedPeers: 0, pendingRequests: 0 };
    localStorage.removeItem("gaigsNearbyConsentV1"); render();
  }

  function threads() {
    const groups = new Map();
    for (const message of local.messages.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))) {
      const key = message.otherId || (message.direction === "in" ? message.senderId : message.recipientId); if (!key) continue;
      const thread = groups.get(key) || { id: key, name: message.otherName || "Member", messages: [], latest: message, unread: 0 };
      thread.messages.push(message); thread.latest = message; if (message.direction === "in" && message.status !== "read") thread.unread += 1; groups.set(key, thread);
    }
    return [...groups.values()].sort((a, b) => new Date(b.latest.createdAt) - new Date(a.latest.createdAt));
  }
  function initials(name) { return String(name || "M").split(/\s+/).slice(0, 2).map(value => value[0]).join("").toUpperCase(); }
  function time(value) { try { return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (error) { return ""; } }

  function chatList() {
    const list = threads();
    return list.length ? `<div class="hybrid-thread-list">${list.map(thread => `<button data-hybrid-thread="${esc(thread.id)}"><span class="avatar">${esc(initials(thread.name))}</span><span><b>${esc(thread.name)}</b><small>${esc(thread.latest.text || "Encrypted message")}</small><em>${esc(thread.latest.transport || "online")} · ${esc(thread.latest.status || "sent")}</em></span><time>${esc(time(thread.latest.createdAt))}</time>${thread.unread ? `<i>${thread.unread}</i>` : ""}</button>`).join("")}</div>` : `<div class="empty-state"><h3>Your private inbox is ready</h3><p>Find a registered GAIGS member, or enable Nearby Mesh to talk without internet.</p><button class="action-btn" data-hybrid-new>Start encrypted chat</button></div>`;
  }

  function peerList() {
    const peers = [...local.peers.values()].sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt));
    return peers.length ? `<div class="nearby-peer-list">${peers.map(peer => `<button data-nearby-compose="${esc(peer.deviceId)}"><span class="mesh-live online"></span><span><b>${esc(peer.name)}</b><small>${peer.verified ? "QR verified" : "Connection code verified · identity not QR-pinned"}</small><em>${esc(peer.deviceId.slice(-12))}</em></span><strong>Message</strong></button>`).join("")}</div>` : `<div class="empty-state"><h3>No GAIGS peers discovered yet</h3><p>Keep both phones nearby with GAIGS open. Confirm the same six-digit connection code on both devices.</p></div>`;
  }

  function roomPanel() {
    return `<div class="room-selector">${["city", "country", "global"].map(type => `<button class="${local.room === type ? "active" : ""}" data-room-type="${type}">${type[0].toUpperCase() + type.slice(1)}</button>`).join("")}</div><div id="hybridRoomMessages" class="room-message-list"><div class="empty-state compact"><h3>Loading auditable room…</h3><p>Public room messages are intentionally visible and receipt-chained.</p></div></div><form id="hybridRoomForm" class="hybrid-compose"><input id="hybridRoomText" maxlength="5000" placeholder="Add to this public discussion…" required><button class="action-btn">Send</button></form><p class="fine-print">Public governance rooms are not private chats. Do not post CNICs, private keys, exact home addresses or vulnerable people’s live locations.</p>`;
  }

  views.messages = function () {
    const online = navigator.onLine && window.gaigsApi?.active?.(), mesh = local.mesh.running;
    return `${pageHead("Messages & Nearby Mesh", "Private encrypted chats online. Signed device-to-device relay when the internet is unavailable.", `<button class="action-btn" data-hybrid-new>＋ New chat</button>`)}
      <div class="message-network-bar"><span class="network-state ${online ? "online" : "offline"}">${online ? "ONLINE SYNC" : "OFFLINE"}</span><span class="network-state ${mesh ? "online" : "offline"}">${mesh ? `${local.mesh.connectedPeers || 0} MESH PEERS` : "MESH OFF"}</span><b>Private chat: E2E envelope</b><b>Public rooms: auditable</b></div>
      <div class="message-tabs"><button class="${local.tab === "chats" ? "active" : ""}" data-message-tab="chats">Chats</button><button class="${local.tab === "nearby" ? "active" : ""}" data-message-tab="nearby">Nearby</button><button class="${local.tab === "rooms" ? "active" : ""}" data-message-tab="rooms">Public rooms</button></div>
      <div class="dashboard-grid"><section class="card span-8"><div class="card-body">${local.tab === "chats" ? chatList() : local.tab === "nearby" ? peerList() : roomPanel()}</div></section>
      ${card("Connection controls", `<div class="hybrid-control-card"><b>${nativeNearby ? "Android Nearby Connections" : "Browser peer mode"}</b><p>${nativeNearby ? "Bluetooth, BLE and Wi-Fi transports are selected by Android. Both people approve the verification code." : "Automatic Bluetooth discovery requires the Android APK. Manual WebRTC pairing remains available in JARVIS Hub."}</p>${mesh ? `<button class="ghost-btn" data-mesh-stop>Stop Nearby Mesh</button>` : `<button class="action-btn" data-mesh-start>Enable Nearby Mesh</button>`}<button class="ghost-btn" data-view="jarvisHub">Open peer pairing</button></div><div class="governance-proof"><b>Consent & battery</b><span>No hidden mining, no silent storage sharing and no permanent radio use. You can stop mesh mode at any time.</span></div>`, 4)}
      ${card("Delivery model", `<div class="delivery-legend"><p><span>✓</span><b>Queued</b> stays encrypted on this device.</p><p><span>⇄</span><b>Relayed</b> crossed an approved nearby link.</p><p><span>✓✓</span><b>Delivered</b> reached the recipient device.</p><p><span>#</span><b>Receipt</b> belongs to a conversation hash chain.</p></div>`, 4)}</div>`;
  };
  viewNames.messages = "Hybrid messaging";

  async function openContactSearch() {
    openModal(`<h2>Start encrypted chat</h2><form id="contactSearchForm" class="hybrid-search"><input id="contactSearchInput" maxlength="80" placeholder="Name, city or public skill"><button class="action-btn">Search</button></form><div id="contactSearchResults"><div class="empty-state compact"><p>Only public profile information is searchable. Phone, email and CNIC stay hidden.</p></div></div>`);
    const run = async () => {
      const target = $("#contactSearchResults"); target.innerHTML = `<div class="empty-state compact"><p>Searching registered GAIGS members…</p></div>`;
      try {
        const response = await window.gaigsApi.messagingContacts($("#contactSearchInput").value.trim());
        target.innerHTML = response.contacts?.length ? `<div class="contact-search-list">${response.contacts.map(contact => `<button data-contact-compose="${esc(contact.id)}" data-contact-name="${esc(contact.name)}" ${contact.encryptedMessagingReady ? "" : "disabled"}><span class="avatar">${esc(initials(contact.name))}</span><span><b>${esc(contact.name)}</b><small>${esc(contact.city)}, ${esc(contact.country)} · ${esc(contact.skills || "No public skills")}</small></span><em>${contact.encryptedMessagingReady ? "Encrypted chat" : "Messaging not activated"}</em></button>`).join("")}</div>` : `<div class="empty-state compact"><p>No matching registered members found.</p></div>`;
        bindContactButtons();
      } catch (error) { target.innerHTML = `<div class="empty-state compact"><p>${esc(error.message)}</p></div>`; }
    };
    $("#contactSearchForm").addEventListener("submit", event => { event.preventDefault(); run(); });
    await run();
  }

  function bindContactButtons() {
    $$("[data-contact-compose]").forEach(button => button.addEventListener("click", () => openComposer({ id: button.dataset.contactCompose, name: button.dataset.contactName }, "online")));
  }

  function openComposer(person, route) {
    openModal(`<h2>Message ${esc(person.name)}</h2><div class="encryption-banner"><span>🔒</span><div><b>${route === "nearby" ? "Nearby encrypted relay" : "End-to-end encrypted envelope"}</b><small>${route === "nearby" ? "Intermediate phones carry ciphertext only." : "The GAIGS service cannot read this private message."}</small></div></div><form id="hybridComposeForm" class="form-grid"><label>Message<textarea id="hybridComposeText" maxlength="8000" required autofocus></textarea></label><label>Message type<select id="hybridComposeKind"><option value="text">Private message</option><option value="problem">Problem report</option><option value="proposal">Proposal link</option><option value="location">Approximate location note</option></select></label><button class="primary">Send securely</button></form>`);
    $("#hybridComposeForm").addEventListener("submit", async event => {
      event.preventDefault(); const button = event.submitter; button.disabled = true;
      try {
        const text = $("#hybridComposeText").value.trim(), kind = $("#hybridComposeKind").value;
        if (route === "nearby") await sendNearby(person, text, kind); else await sendOnline(person, text, kind);
        closeModal(); local.tab = "chats"; render(); toast(route === "nearby" ? "Encrypted nearby message queued." : "Encrypted message queued for delivery.");
      } catch (error) { toast(error.message || "Message could not be sent."); button.disabled = false; }
    });
  }

  async function openThread(id) {
    const thread = threads().find(item => item.id === id); if (!thread) return;
    openModal(`<div class="thread-modal-head"><div><h2>${esc(thread.name)}</h2><p>Private conversation · ${esc(thread.messages.some(item => item.transport === "nearby") ? "online + nearby" : "online")}</p></div><button class="ghost-btn" id="verifyThread">Verify receipts</button></div><div class="hybrid-conversation">${thread.messages.map(message => `<article class="${message.direction === "out" ? "out" : "in"}"><p>${esc(message.text)}</p><small>${esc(time(message.createdAt))} · ${esc(message.status || "sent")} · ${esc(message.transport || "online")}${message.receipt ? ` · #${esc(String(message.receipt).slice(0, 8))}` : ""}</small></article>`).join("")}</div><form id="hybridReplyForm" class="hybrid-compose"><input id="hybridReplyText" maxlength="8000" placeholder="Write a private reply…" required><button class="action-btn">Send</button></form>`);
    for (const message of thread.messages.filter(item => item.direction === "in" && item.status !== "read")) {
      await saveMessage({ ...message, status: "read" }); if (message.transport === "online") window.gaigsApi.markMessageRead(message.id).catch(() => {});
    }
    $("#hybridReplyForm").addEventListener("submit", async event => { event.preventDefault(); const text = $("#hybridReplyText").value.trim(); if (!text) return; const peer = [...local.peers.values()].find(item => (item.userId || item.deviceId) === id); if (peer && thread.latest.transport === "nearby") await sendNearby(peer, text); else await sendOnline({ id, name: thread.name }, text); closeModal(); render(); });
    $("#verifyThread").addEventListener("click", async () => {
      const conversation = thread.messages.find(item => item.conversationId)?.conversationId;
      if (!conversation) return toast("Nearby signatures are verified per packet; no online chain exists for this thread yet.");
      try { const result = await window.gaigsApi.verifyConversation(conversation); toast(result.valid ? `${result.checked} encrypted receipts verified.` : "Receipt-chain verification failed."); } catch (error) { toast(error.message); }
    });
  }

  async function loadRoom() {
    const container = $("#hybridRoomMessages"); if (!container) return;
    try {
      const response = await window.gaigsApi.roomMessages(local.room);
      container.innerHTML = response.messages?.length ? response.messages.map(message => `<article class="room-message"><div><b>${esc(message.senderName)}</b><time>${esc(time(message.createdAt))}</time></div><p>${esc(message.text)}</p><small>Public receipt #${esc(String(message.receipt).slice(0, 12))}</small></article>`).join("") : `<div class="empty-state compact"><h3>No messages yet</h3><p>Start a respectful, public and auditable discussion.</p></div>`;
      container.scrollTop = container.scrollHeight;
    } catch (error) { container.innerHTML = `<div class="empty-state compact"><p>${esc(error.message)}</p></div>`; }
  }

  const previousBindDynamic = bindDynamic;
  bindDynamic = function () {
    previousBindDynamic();
    $$("[data-message-tab]").forEach(button => button.addEventListener("click", () => { local.tab = button.dataset.messageTab; render(); if (local.tab === "rooms") loadRoom(); }));
    $$("[data-hybrid-new]").forEach(button => button.addEventListener("click", openContactSearch));
    $$("[data-hybrid-thread]").forEach(button => button.addEventListener("click", () => openThread(button.dataset.hybridThread)));
    $$("[data-nearby-compose]").forEach(button => button.addEventListener("click", () => { const peer = local.peers.get(button.dataset.nearbyCompose); if (peer) openComposer(peer, "nearby"); }));
    const start = $("[data-mesh-start]"); if (start) start.addEventListener("click", () => startMesh().catch(error => toast(error.message)));
    const stop = $("[data-mesh-stop]"); if (stop) stop.addEventListener("click", () => stopMesh().catch(error => toast(error.message)));
    $$("[data-room-type]").forEach(button => button.addEventListener("click", () => { local.room = button.dataset.roomType; render(); loadRoom(); }));
    const roomForm = $("#hybridRoomForm"); if (roomForm) roomForm.addEventListener("submit", async event => { event.preventDefault(); try { await window.gaigsApi.postRoomMessage({ type: local.room, text: $("#hybridRoomText").value.trim() }); $("#hybridRoomText").value = ""; await loadRoom(); } catch (error) { toast(error.message); } });
    if (state.view === "messages" && local.tab === "rooms") loadRoom();
  };

  async function bindNative() {
    if (!nativeNearby?.addListener) return;
    await nativeNearby.addListener("nearbyState", event => { local.mesh = { ...local.mesh, ...event }; if (state.view === "messages") render(); });
    await nativeNearby.addListener("nearbyPeer", event => { if (event.state === "connected") announce(event.endpointId); });
    await nativeNearby.addListener("nearbyPayload", event => { try { receiveMeshPacket(JSON.parse(event.message), event.endpointId); } catch (error) { console.warn("[GAIGS] Ignored malformed nearby packet."); } });
    await nativeNearby.addListener("nearbyConnectionRequest", event => {
      openModal(`<h2>Verify nearby connection</h2><div class="nearby-verification"><p>Compare this code on both phones. Accept only when the codes match and you recognize the person.</p><strong>${esc(event.verificationCode)}</strong><b>${esc(event.name)}</b><div><button class="ghost-btn" id="nearbyReject">Reject</button><button class="action-btn" id="nearbyAccept">Codes match — connect</button></div></div>`);
      $("#nearbyReject").addEventListener("click", () => nativeNearby.reject({ endpointId: event.endpointId }).finally(closeModal));
      $("#nearbyAccept").addEventListener("click", () => nativeNearby.accept({ endpointId: event.endpointId }).then(() => { closeModal(); announce(event.endpointId); }).catch(error => toast(error.message)));
    });
  }

  window.addEventListener("online", syncOnline);
  window.addEventListener("offline", () => { if (state.view === "messages") render(); });
  if (window.GAIGSPeerMesh?.on) window.GAIGSPeerMesh.on(event => { if (event.type === "message" && event.packet?.type === "hybrid-message") receiveMeshPacket(event.packet.body); });
  window.GAIGSHybridMessaging = { identity, encryptFor, decryptEnvelope, sendOnline, sendNearby, syncOnline, startMesh, stopMesh, stats: async () => ({ ...local.mesh, messages: (await getAll("messages")).length, queued: (await getAll("outbox")).length, peers: (await getAll("peers")).length }) };

  Promise.all([refreshLocal(), bindNative()]).then(async () => {
    if (nativeNearby && localStorage.getItem("gaigsNearbyConsentV1") === "enabled" && state.user) await startMesh().catch(() => {});
    if (state.user) syncOnline(); if (state.user && state.view === "messages") render();
  });
  pollTimer = setInterval(() => { if (state.user && document.visibilityState === "visible") syncOnline(); }, 20000);
})();
