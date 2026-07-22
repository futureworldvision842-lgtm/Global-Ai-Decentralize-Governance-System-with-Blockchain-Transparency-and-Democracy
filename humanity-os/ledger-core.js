import { vault } from "./local-vault.js";

export function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
}

function toBytes(value) { return new TextEncoder().encode(typeof value === "string" ? value : canonicalize(value)); }
function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", toBytes(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function ensureDeviceIdentity() {
  const existing = await vault.get("meta", "device-identity");
  if (existing?.privateJwk && existing?.publicJwk) return existing;
  const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const [privateJwk, publicJwk] = await Promise.all([
    crypto.subtle.exportKey("jwk", keyPair.privateKey), crypto.subtle.exportKey("jwk", keyPair.publicKey),
  ]);
  const fingerprint = (await sha256(publicJwk)).slice(0, 24);
  const identity = { id: "device-identity", deviceId: `device-${fingerprint}`, fingerprint, privateJwk, publicJwk, createdAt: new Date().toISOString() };
  await vault.put("meta", identity);
  return identity;
}

export async function appendEvent(type, payload, options = {}) {
  const identity = await ensureDeviceIdentity();
  const existing = (await vault.list("events")).filter(event => event.deviceId === identity.deviceId).sort((a, b) => a.sequence - b.sequence || a.createdAt.localeCompare(b.createdAt));
  const previous = existing.at(-1);
  const unsigned = {
    version: 1, type, payload, deviceId: identity.deviceId, actorId: options.actorId || "local-member",
    scope: options.scope || payload?.scope || "personal", sequence: (previous?.sequence || 0) + 1,
    previousHash: previous?.hash || "GENESIS", createdAt: new Date().toISOString(), nonce: crypto.randomUUID(),
  };
  const hash = await sha256(unsigned);
  const privateKey = await crypto.subtle.importKey("jwk", identity.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = bytesToBase64(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, toBytes(hash)));
  const event = { id: hash, ...unsigned, hash, signature, publicKey: identity.publicJwk };
  await vault.put("events", event);
  return event;
}

export async function verifyEvent(event) {
  try {
    const { id, hash, signature, publicKey, ...unsigned } = event;
    const expectedHash = await sha256(unsigned);
    if (hash !== expectedHash || id !== hash) return { valid: false, reason: "Hash mismatch" };
    const key = await crypto.subtle.importKey("jwk", publicKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, base64ToBytes(signature), toBytes(hash));
    return { valid, reason: valid ? "Signature and content verified" : "Invalid signature" };
  } catch (error) { return { valid: false, reason: error.message }; }
}

export async function verifyEventSet(events) {
  const byDevice = Map.groupBy ? Map.groupBy(events, event => event.deviceId) : events.reduce((map, event) => map.set(event.deviceId, [...(map.get(event.deviceId) || []), event]), new Map());
  const failures = [];
  let verified = 0;
  for (const [deviceId, chain] of byDevice) {
    chain.sort((a, b) => a.sequence - b.sequence);
    for (let index = 0; index < chain.length; index += 1) {
      const event = chain[index];
      const result = await verifyEvent(event);
      const expectedPrevious = index === 0 ? "GENESIS" : chain[index - 1].hash;
      if (!result.valid || event.previousHash !== expectedPrevious) failures.push({ id: event.id, deviceId, reason: result.valid ? "Broken previous hash" : result.reason });
      else verified += 1;
    }
  }
  return { valid: failures.length === 0, verified, total: events.length, failures };
}

export function recordKey(type, id) { return `${type}:${id}`; }

export async function saveRecord(type, value, options = {}) {
  const record = { ...value, id: recordKey(type, value.id || crypto.randomUUID()), recordType: type, updatedAt: new Date().toISOString(), localOnly: options.localOnly ?? true };
  await vault.put("records", record);
  const event = await appendEvent(options.eventType || `${type}.saved`, { recordId: record.id, recordType: type, scope: value.scope || options.scope || "personal", dataHash: await sha256(record) }, options);
  return { record, event };
}

export function matchesScope(item, activeScope, context = {}) {
  if (activeScope === "personal") return item.authorId === context.userId || item.scope === "personal" || ["job", "service"].includes(item.type);
  if (activeScope === "nearby") return item.scope === "nearby" || item.location?.includes(context.city || "Islamabad") || item.scope === "society" || item.scope === "city";
  if (activeScope === "global") return true;
  return item.scope === activeScope || item.scope === "global";
}
