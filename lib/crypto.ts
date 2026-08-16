/**
 * WebCrypto AES-GCM + IndexedDB vault.
 * Master key lives only in IndexedDB (never localStorage — SW cannot read it).
 * Plaintext secrets never leave the device.
 */

const DB_NAME = 'gatekeeper';
const STORE_KEYS = 'keys';
const STORE_META = 'meta';

export type StoredKeyRecord = {
  iv: number[];
  data: number[];
  provider: string;
  created_at: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_KEYS)) {
        db.createObjectStore(STORE_KEYS);
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
      if (!db.objectStoreNames.contains('usage_queue')) {
        db.createObjectStore('usage_queue', { autoIncrement: true });
      }
    };
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getOrCreateMasterKey(): Promise<CryptoKey> {
  const db = await openDB();
  const tx = db.transaction(STORE_META, 'readonly');
  const existing = await idbReq<JsonWebKey | undefined>(
    tx.objectStore(STORE_META).get('master-jwk')
  );

  if (existing) {
    return crypto.subtle.importKey(
      'jwk',
      existing,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const jwk = await crypto.subtle.exportKey('jwk', key);
  const wtx = db.transaction(STORE_META, 'readwrite');
  await idbReq(wtx.objectStore(STORE_META).put(jwk, 'master-jwk'));
  return key;
}

export async function encryptAndSave(
  keyName: string,
  value: string,
  provider: string
): Promise<void> {
  const masterKey = await getOrCreateMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(value);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    encoded
  );

  const record: StoredKeyRecord = {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
    provider,
    created_at: Date.now()
  };

  const db = await openDB();
  const tx = db.transaction(STORE_KEYS, 'readwrite');
  await idbReq(tx.objectStore(STORE_KEYS).put(record, keyName));
}

export async function listKeys(): Promise<
  Array<{ name: string; provider: string; created_at: number }>
> {
  const db = await openDB();
  const tx = db.transaction(STORE_KEYS, 'readonly');
  const store = tx.objectStore(STORE_KEYS);
  const keys = await idbReq<IDBValidKey[]>(store.getAllKeys());
  const result: Array<{ name: string; provider: string; created_at: number }> = [];
  for (const k of keys) {
    const rec = await idbReq<StoredKeyRecord | undefined>(store.get(k));
    if (rec) {
      result.push({
        name: String(k),
        provider: rec.provider,
        created_at: rec.created_at
      });
    }
  }
  return result;
}

export async function deleteKey(name: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_KEYS, 'readwrite');
  await idbReq(tx.objectStore(STORE_KEYS).delete(name));
}

export function detectProvider(name: string): string {
  const n = name.toUpperCase();
  if (n.includes('STRIPE')) return 'stripe';
  if (n.includes('OPENAI')) return 'openai';
  if (n.includes('ANTHROPIC') || n.includes('CLAUDE')) return 'anthropic';
  if (n.includes('SUPABASE')) return 'supabase';
  return 'unknown';
}

export function maskSecret(value: string): string {
  if (value.length <= 8) return '••••••••';
  return value.slice(0, 4) + '…' + value.slice(-4);
}
