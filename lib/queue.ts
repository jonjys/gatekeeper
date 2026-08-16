/**
 * QueueTransparent — client-side visible proxy queue.
 * Reads usage_queue written by the Service Worker (metadata only, never secrets).
 */

const DB_NAME = 'gatekeeper';
const STORE = 'usage_queue';

export type QueueItem = {
  id?: number;
  provider?: string;
  keyName?: string;
  status?: number;
  bytes_out?: number;
  cost?: number;
  timestamp?: number;
  duration_ms?: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('audit_log')) {
        db.createObjectStore('audit_log', { keyPath: 'id', autoIncrement: true });
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

/** Newest first. Metadata only. */
export async function listQueue(limit = 50): Promise<QueueItem[]> {
  const db = await openDB();
  if (!db.objectStoreNames.contains(STORE)) return [];
  const tx = db.transaction(STORE, 'readonly');
  const all = await idbReq<QueueItem[]>(tx.objectStore(STORE).getAll());
  return all
    .map((row, i) => ({ ...row, id: row.id ?? i }))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, limit);
}

export async function queueTotals(): Promise<{ calls: number; cost: number }> {
  const rows = await listQueue(500);
  let cost = 0;
  for (const r of rows) cost += Number(r.cost) || 0;
  return { calls: rows.length, cost };
}

/** Demo seed — never secrets */
export async function seedDemoQueue(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const now = Date.now();
  const demos = [
    { provider: 'openai', keyName: 'OPENAI_API_KEY', status: 200, cost: 0.012, duration_ms: 340, bytes_out: 2048 },
    { provider: 'anthropic', keyName: 'ANTHROPIC_API_KEY', status: 200, cost: 0.008, duration_ms: 280, bytes_out: 1024 },
    { provider: 'openai', keyName: 'OPENAI_API_KEY', status: 429, cost: 0, duration_ms: 90, bytes_out: 128 },
    { provider: 'stripe', keyName: 'STRIPE_SECRET_KEY', status: 200, cost: 0.001, duration_ms: 120, bytes_out: 512 }
  ];
  for (let i = 0; i < demos.length; i++) {
    await idbReq(
      store.add({
        ...demos[i],
        timestamp: now - (demos.length - i) * 15_000
      })
    );
  }
  return demos.length;
}
