'use client';

import { useEffect, useState } from 'react';
import { listAudit, exportAuditCsv, type AuditEvent } from '@/lib/audit';

export default function AuditPanel() {
  const [rows, setRows] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setRows(await listAudit(100));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Audit</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:border-emerald-500/40"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => exportAuditCsv().catch((e) => setErr(String(e)))}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:border-emerald-500/40"
          >
            Export CSV
          </button>
        </div>
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading audit…</p>
      ) : rows.length === 0 ? (
        <div className="card border-dashed text-sm text-zinc-500 text-center">
          No audit events yet. Unlock / proxy / import will appear here.
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900 text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Provider</th>
                <th className="px-3 py-2 font-medium">Cost</th>
                <th className="px-3 py-2 font-medium">ms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.id ?? r.ts} className="bg-zinc-950/40">
                  <td className="px-3 py-2 font-mono text-zinc-400">
                    {new Date(r.ts).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-emerald-400">{r.action}</td>
                  <td className="px-3 py-2">{r.provider || r.keyName || '—'}</td>
                  <td className="px-3 py-2 font-mono">
                    {r.costUsd != null ? `$${r.costUsd.toFixed(4)}` : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-zinc-500">
                    {r.durationMs ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
