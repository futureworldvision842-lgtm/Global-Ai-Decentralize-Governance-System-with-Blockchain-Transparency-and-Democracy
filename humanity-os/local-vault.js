const DB_NAME = "humanity-os-v1";
const DB_VERSION = 1;
const STORES = ["meta", "records", "events", "media"];

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function openVault() {
  if (!globalThis.indexedDB) throw new Error("IndexedDB is unavailable on this device.");
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    for (const store of STORES) if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
  };
  return requestResult(request);
}

async function transact(store, mode, action) {
  const db = await openVault();
  try {
    const transaction = db.transaction(store, mode);
    const result = await action(transaction.objectStore(store));
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Vault transaction aborted."));
    });
    return result;
  } finally {
    db.close();
  }
}

export const vault = {
  get: (store, id) => transact(store, "readonly", objectStore => requestResult(objectStore.get(id))),
  put: (store, value) => transact(store, "readwrite", objectStore => requestResult(objectStore.put(value))),
  delete: (store, id) => transact(store, "readwrite", objectStore => requestResult(objectStore.delete(id))),
  list: (store) => transact(store, "readonly", objectStore => requestResult(objectStore.getAll())),
  clear: (store) => transact(store, "readwrite", objectStore => requestResult(objectStore.clear())),
  async count(store) { return transact(store, "readonly", objectStore => requestResult(objectStore.count())); },
};

export async function vaultHealth() {
  const [records, events, media] = await Promise.all([vault.count("records"), vault.count("events"), vault.count("media")]);
  const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : {};
  return { records, events, media, usage: estimate.usage || 0, quota: estimate.quota || 0, persistent: navigator.storage?.persisted ? await navigator.storage.persisted() : false };
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}
