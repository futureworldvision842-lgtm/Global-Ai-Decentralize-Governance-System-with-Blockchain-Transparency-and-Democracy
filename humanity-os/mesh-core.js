import { vault } from "./local-vault.js";
import { appendEvent, ensureDeviceIdentity, sha256, verifyEventSet } from "./ledger-core.js";

const channel = "BroadcastChannel" in globalThis ? new BroadcastChannel("humanity-os-mesh-v1") : null;

export async function startLocalMesh(onMessage) {
  const identity = await ensureDeviceIdentity();
  if (channel) {
    channel.onmessage = event => onMessage?.(event.data);
    channel.postMessage({ type: "peer.hello", deviceId: identity.deviceId, at: Date.now() });
  }
  return { deviceId: identity.deviceId, transport: channel ? "same-origin mesh" : "bundle sync" };
}

export function announceChange(event) { channel?.postMessage({ type: "ledger.event", event, at: Date.now() }); }

export async function exportSyncBundle() {
  const identity = await ensureDeviceIdentity();
  const [events, records] = await Promise.all([vault.list("events"), vault.list("records")]);
  const bundle = { format: "humanity-os-sync", version: 1, exportedAt: new Date().toISOString(), exporter: identity.deviceId, events, records };
  bundle.bundleHash = await sha256(bundle);
  await appendEvent("sync.bundle_exported", { bundleHash: bundle.bundleHash, eventCount: events.length, recordCount: records.length }, { scope: "personal" });
  return bundle;
}

export async function importSyncBundle(bundle) {
  if (bundle?.format !== "humanity-os-sync" || bundle?.version !== 1) throw new Error("Unsupported sync bundle.");
  const { bundleHash, ...content } = bundle;
  if (await sha256(content) !== bundleHash) throw new Error("Bundle content hash does not match.");
  const verification = await verifyEventSet(bundle.events || []);
  if (!verification.valid) throw new Error(`Bundle has ${verification.failures.length} invalid ledger event(s).`);
  let addedEvents = 0;
  let addedRecords = 0;
  for (const event of bundle.events || []) if (!(await vault.get("events", event.id))) { await vault.put("events", event); addedEvents += 1; }
  for (const record of bundle.records || []) {
    const current = await vault.get("records", record.id);
    if (!current || String(record.updatedAt) > String(current.updatedAt)) { await vault.put("records", record); addedRecords += 1; }
  }
  await appendEvent("sync.bundle_imported", { bundleHash, exporter: bundle.exporter, addedEvents, addedRecords }, { scope: "personal" });
  return { ...verification, addedEvents, addedRecords };
}

export function downloadBundle(bundle) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = Object.assign(document.createElement("a"), { href: url, download: `humanity-sync-${new Date().toISOString().slice(0, 10)}.json` });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
