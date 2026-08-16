/**
 * Client-side audit log in IndexedDB.
 * Records proxy/unlock metadata only — never secrets.
 */

const DB_NAME = 'gatekeeper';
const STORE = 'audit_log';

export type AuditEvent = {
  id?: number;
  ts: number;
  action: 'unlock' | 'proxy' | 'import' | 'export' | 'passkey' | 'yubi' | 'kill';
  provider?: string;
  keyName?: string;
  costUsd?: number;
  durationMs?: number;
  status?: number;
  detail?: string;
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
      if (!db.objectStoreNames.contains('usage_queue')) {
        db.createObjectStore('usage_queue', { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
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

export async function writeAudit(
  event: Omit<AuditEvent, 'id' | 'ts'> & { ts?: number }
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const record: AuditEvent = {
    ts: event.ts ?? Date.now(),
    action: event.action,
    provider: event.provider,
    keyName: event.keyName,
    costUsd: event.costUsd,
    durationMs: event.durationMs,
    status: event.status,
    detail: event.detail
  };
  await idbReq(tx.objectStore(STORE).add(record));
}

export async function listAudit(limit = 100): Promise<AuditEvent[]> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  const all = await idbReq<AuditEvent[]>(tx.objectStore(STORE).getAll());
  return all.sort((a, b) => b.ts - a.ts).slice(0, limit);
}

export async function exportAuditCsv(): Promise<void> {
  const rows = await listAudit(500);
  const header = 'ts,action,provider,keyName,costUsd,durationMs,status,detail\n';
  const body = rows
    .map((r) =>
      [
        new Date(r.ts).toISOString(),
        r.action,
        r.provider ?? '',
        r.keyName ?? '',
        r.costUsd ?? '',
        r.durationMs ?? '',
        r.status ?? '',
        JSON.stringify(r.detail ?? '')
      ].join(',')
    )
    .join('\n');

  if (!('showSaveFilePicker' in window)) {
    const blob = new Blob([header + body], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gatezero-audit-${Date.now()}.csv`;
    a.click();
    return;
  }

  const handle = await window.showSaveFilePicker({
    suggestedName: `gatezero-audit-${new Date().toISOString().slice(0, 10)}.csv`,
    types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }]
  });
  const w = await handle.createWritable();
  await w.write(header + body);
  await w.close();
}
