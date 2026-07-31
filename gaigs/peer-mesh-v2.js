/* GAIGS Peer Mesh v2: signed, consent-based local/P2P sync with an offline outbox. */
(function () {
  "use strict";

  const DB_NAME = "gaigs-peer-mesh-v2";
  const DB_VERSION = 1;
  const CHANNEL_NAME = "gaigs-peer-mesh-v2";
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const listeners = new Set();
  const sameDeviceChannel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  let peer = null;
  let dataChannel = null;
  let connectionState = "offline";

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
        if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "id" });
        if (!db.objectStoreNames.contains("inbox")) db.createObjectStore("inbox", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Peer store could not open."));
    });
  }

  async function transaction(storeName, mode, operation) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let request;
      try { request = operation(store); } catch (error) { db.close(); reject(error); return; }
      tx.oncomplete = () => { db.close(); resolve(request && "result" in request ? request.result : undefined); };
      tx.onerror = () => { db.close(); reject(tx.error || new Error("Peer store operation failed.")); };
    });
  }

  const getMeta = key => transaction("meta", "readonly", store => store.get(key));
  const setMeta = (key, value) => transaction("meta", "readwrite", store => store.put(value, key));
  const putRecord = (storeName, value) => transaction(storeName, "readwrite", store => store.put(value));
  const getAll = storeName => transaction(storeName, "readonly", store => store.getAll());
  const deleteRecord = (storeName, key) => transaction(storeName, "readwrite", store => store.delete(key));

  function bytesToBase64(bytes) {
    let binary = "";
    const view = new Uint8Array(bytes);
    for (let index = 0; index < view.length; index += 1) binary += String.fromCharCode(view[index]);
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function stablePayload(packet) {
    return JSON.stringify({ id: packet.id, sentAt: packet.sentAt, type: packet.type, scope: packet.scope, body: packet.body });
  }

  async function identity() {
    let stored = await getMeta("identity");
    if (stored && stored.privateKey && stored.publicKey && stored.deviceId) return stored;
    const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
    const publicJwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
    stored = { deviceId: crypto.randomUUID(), privateKey: keys.privateKey, publicKey: keys.publicKey, publicJwk, createdAt: new Date().toISOString() };
    await setMeta("identity", stored);
    return stored;
  }

  async function signPacket(type, body, scope = "personal") {
    const owner = await identity();
    const packet = { id: crypto.randomUUID(), sentAt: new Date().toISOString(), type, scope, body, deviceId: owner.deviceId, publicKey: owner.publicJwk };
    packet.signature = bytesToBase64(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, owner.privateKey, encoder.encode(stablePayload(packet))));
    return packet;
  }

  async function verifyPacket(packet) {
    if (!packet || !packet.id || !packet.signature || !packet.publicKey) return false;
    try {
      const key = await crypto.subtle.importKey("jwk", packet.publicKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
      return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, base64ToBytes(packet.signature), encoder.encode(stablePayload(packet)));
    } catch (error) { return false; }
  }

  function emit(event) {
    listeners.forEach(listener => { try { listener(event); } catch (error) { /* listener isolation */ } });
  }

  async function receive(packet, transport) {
    if (!await verifyPacket(packet)) { emit({ type: "rejected", reason: "Signature check failed." }); return false; }
    const existing = (await getAll("inbox")).some(item => item.id === packet.id);
    if (!existing) {
      await putRecord("inbox", { ...packet, transport, receivedAt: new Date().toISOString() });
      emit({ type: "message", packet, transport });
    }
    return true;
  }

  if (sameDeviceChannel) sameDeviceChannel.onmessage = event => receive(event.data, "same-origin");

  async function flushOutbox() {
    if (!dataChannel || dataChannel.readyState !== "open") return 0;
    const records = await getAll("outbox");
    for (const record of records) {
      dataChannel.send(JSON.stringify(record));
      await deleteRecord("outbox", record.id);
    }
    return records.length;
  }

  function bindPeerConnection(pc) {
    peer = pc;
    pc.onconnectionstatechange = () => {
      connectionState = pc.connectionState || "offline";
      emit({ type: "state", state: connectionState });
    };
    pc.ondatachannel = event => bindDataChannel(event.channel);
  }

  function bindDataChannel(channel) {
    dataChannel = channel;
    channel.onopen = () => { connectionState = "connected"; emit({ type: "state", state: connectionState }); flushOutbox(); };
    channel.onclose = () => { connectionState = "offline"; emit({ type: "state", state: connectionState }); };
    channel.onerror = () => emit({ type: "state", state: "error" });
    channel.onmessage = event => { try { receive(JSON.parse(event.data), "webrtc"); } catch (error) { emit({ type: "rejected", reason: "Unreadable peer message." }); } };
  }

  function waitForIce(pc) {
    if (pc.iceGatheringState === "complete") return Promise.resolve();
    return new Promise(resolve => {
      const done = () => { if (pc.iceGatheringState === "complete") { pc.removeEventListener("icegatheringstatechange", done); resolve(); } };
      pc.addEventListener("icegatheringstatechange", done);
      setTimeout(resolve, 5000);
    });
  }

  function createConnection() {
    if (!("RTCPeerConnection" in window)) throw new Error("WebRTC peer sync is unavailable on this device.");
    if (peer) try { peer.close(); } catch (error) { /* already closed */ }
    const pc = new RTCPeerConnection({ iceServers: [] });
    bindPeerConnection(pc);
    return pc;
  }

  async function createInvite() {
    const pc = createConnection();
    bindDataChannel(pc.createDataChannel("gaigs-signed-sync", { ordered: true }));
    await pc.setLocalDescription(await pc.createOffer());
    await waitForIce(pc);
    return btoa(unescape(encodeURIComponent(JSON.stringify(pc.localDescription))));
  }

  function decodeDescription(value) {
    try { return JSON.parse(decodeURIComponent(escape(atob(String(value || "").trim())))); }
    catch (error) { throw new Error("This pairing code is invalid or incomplete."); }
  }

  async function acceptInvite(value) {
    const pc = createConnection();
    await pc.setRemoteDescription(decodeDescription(value));
    await pc.setLocalDescription(await pc.createAnswer());
    await waitForIce(pc);
    return btoa(unescape(encodeURIComponent(JSON.stringify(pc.localDescription))));
  }

  async function acceptAnswer(value) {
    if (!peer) throw new Error("Create an invite on this device first.");
    await peer.setRemoteDescription(decodeDescription(value));
    return true;
  }

  async function send(type, body, scope) {
    const packet = await signPacket(type, body, scope);
    await putRecord("outbox", packet);
    if (sameDeviceChannel) sameDeviceChannel.postMessage(packet);
    if (dataChannel && dataChannel.readyState === "open") {
      dataChannel.send(JSON.stringify(packet));
      await deleteRecord("outbox", packet.id);
    }
    emit({ type: "queued", packet });
    return packet;
  }

  async function exportBundle() {
    const owner = await identity();
    const bundle = { version: 2, exportedAt: new Date().toISOString(), deviceId: owner.deviceId, records: await getAll("outbox") };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `gaigs-peer-bundle-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
    return bundle.records.length;
  }

  async function importBundle(bundle) {
    if (!bundle || bundle.version !== 2 || !Array.isArray(bundle.records)) throw new Error("Unsupported GAIGS peer bundle.");
    let added = 0;
    for (const packet of bundle.records) if (await receive(packet, "bundle")) added += 1;
    return added;
  }

  async function stats() {
    const owner = await identity();
    return { deviceId: owner.deviceId, state: connectionState, queued: (await getAll("outbox")).length, received: (await getAll("inbox")).length, webRtc: "RTCPeerConnection" in window, sameOrigin: Boolean(sameDeviceChannel) };
  }

  window.GAIGSPeerMesh = { createInvite, acceptInvite, acceptAnswer, send, exportBundle, importBundle, stats, identity, on(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
})();
