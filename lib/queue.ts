/**
 * QueueTransparent — client-side visible proxy queue.
 * Metadata only. Never secrets.
 */

const DB_NAME = 'gatekeeper';
const STORE = 'usage_queue';
const TAKE_RATE = 0.2;

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

export type EnrichedQueueItem = QueueItem & {
  gatezero_fee: number;
  est_savings: number;
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

/** Fee is 20% of verified savings. This queue has cost only — no invented savings. */
export function enrichItem(r: QueueItem): EnrichedQueueItem {
  const cost = Number(r.cost) || 0;
  return { ...r, gatezero_fee: 0, est_savings: 0, cost };
}

export async function listQueue(limit = 50): Promise<EnrichedQueueItem[]> {
  const db = await openDB();
  if (!db.objectStoreNames.contains(STORE)) return [];
  const tx = db.transaction(STORE, 'readonly');
  const all = await idbReq<QueueItem[]>(tx.objectStore(STORE).getAll());
  return all
    .map((row, i) => enrichItem({ ...row, id: row.id ?? i }))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, limit);
}

export async function queueTotals(): Promise<{
  calls: number;
  cost: number;
  fees: number;
  savings: number;
}> {
  const rows = await listQueue(500);
  let cost = 0;
  let fees = 0;
  let savings = 0;
  for (const r of rows) {
    cost += Number(r.cost) || 0;
    fees += r.gatezero_fee;
    savings += r.est_savings;
  }
  return { calls: rows.length, cost, fees, savings };
}

export async function seedDemoQueue(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const now = Date.now();
  const demos = [
    { provider: 'openai', keyName: 'OPENAI_API_KEY', status: 200, cost: 0.042, duration_ms: 340, bytes_out: 2048 },
    { provider: 'anthropic', keyName: 'ANTHROPIC_API_KEY', status: 200, cost: 0.028, duration_ms: 280, bytes_out: 1024 },
    { provider: 'openai', keyName: 'OPENAI_API_KEY', status: 429, cost: 0, duration_ms: 90, bytes_out: 128 },
    { provider: 'stripe', keyName: 'STRIPE_SECRET_KEY', status: 200, cost: 0.001, duration_ms: 120, bytes_out: 512 },
    { provider: 'openai', keyName: 'OPENAI_API_KEY', status: 200, cost: 1.84, duration_ms: 920, bytes_out: 8192 }
  ];
  for (let i = 0; i < demos.length; i++) {
    await idbReq(
      store.add({
        ...demos[i],
        timestamp: now - (demos.length - i) * 12_000
      })
    );
  }
  return demos.length;
}

export const TAKE = TAKE_RATE;
