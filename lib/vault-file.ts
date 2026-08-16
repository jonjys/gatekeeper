/**
 * File System Access — encrypted vault export/import.
 * Writes AES-GCM ciphertext to a local file the user chooses.
 * Never uploads. Complements IndexedDB for offline backup.
 */

import { listKeys } from './crypto';

const DB_NAME = 'gatekeeper';
const STORE_KEYS = 'keys';
const STORE_META = 'meta';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_KEYS)) db.createObjectStore(STORE_KEYS);
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
    };
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export type VaultBlob = {
  version: 1;
  exportedAt: number;
  masterJwk: JsonWebKey;
  keys: Record<string, { iv: number[]; data: number[]; provider: string; created_at: number }>;
};

/** Export encrypted vault (ciphertext only) to a user-picked local file. */
export async function exportVaultToFile(): Promise<{ count: number }> {
  if (!('showSaveFilePicker' in window)) {
    throw new Error('File System Access save requires Chrome/Edge.');
  }

  const db = await openDB();
  const metaTx = db.transaction(STORE_META, 'readonly');
  const masterJwk = await idbReq<JsonWebKey | undefined>(
    metaTx.objectStore(STORE_META).get('master-jwk')
  );
  if (!masterJwk) throw new Error('No vault — import .env first.');

  const keyTx = db.transaction(STORE_KEYS, 'readonly');
  const store = keyTx.objectStore(STORE_KEYS);
  const names = await idbReq<IDBValidKey[]>(store.getAllKeys());
  const keys: VaultBlob['keys'] = {};
  for (const name of names) {
    const rec = await idbReq<{
      iv: number[];
      data: number[];
      provider: string;
      created_at: number;
    } | undefined>(store.get(name));
    if (rec) keys[String(name)] = rec;
  }

  const blob: VaultBlob = {
    version: 1,
    exportedAt: Date.now(),
    masterJwk,
    keys
  };

  const handle = await window.showSaveFilePicker({
    suggestedName: `gatezero-vault-${new Date().toISOString().slice(0, 10)}.gkvault`,
    types: [
      {
        description: 'GateZero encrypted vault',
        accept: { 'application/octet-stream': ['.gkvault', '.json'] }
      }
    ]
  });

  const writable = await handle.createWritable();
  await writable.write(new Blob([JSON.stringify(blob)], { type: 'application/json' }));
  await writable.close();

  return { count: Object.keys(keys).length };
}

/** Import encrypted vault from a user-picked local file into IndexedDB. */
export async function importVaultFromFile(): Promise<{ count: number }> {
  if (!('showOpenFilePicker' in window)) {
    throw new Error('File System Access open requires Chrome/Edge.');
  }

  const [handle] = await window.showOpenFilePicker({
    multiple: false,
    types: [
      {
        description: 'GateZero encrypted vault',
        accept: { 'application/json': ['.gkvault', '.json'], 'application/octet-stream': ['.gkvault'] }
      }
    ]
  });

  const file = await handle.getFile();
  const text = await file.text();
  const blob = JSON.parse(text) as VaultBlob;
  if (blob.version !== 1 || !blob.masterJwk || !blob.keys) {
    throw new Error('Invalid vault file.');
  }

  const db = await openDB();
  const metaTx = db.transaction(STORE_META, 'readwrite');
  await idbReq(metaTx.objectStore(STORE_META).put(blob.masterJwk, 'master-jwk'));

  const keyTx = db.transaction(STORE_KEYS, 'readwrite');
  const store = keyTx.objectStore(STORE_KEYS);
  let count = 0;
  for (const [name, rec] of Object.entries(blob.keys)) {
    await idbReq(store.put(rec, name));
    count += 1;
  }

  return { count };
}

export async function vaultKeyCount(): Promise<number> {
  const list = await listKeys();
  return list.length;
}
