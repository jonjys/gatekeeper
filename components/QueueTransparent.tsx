'use client';

import { useCallback, useEffect, useState } from 'react';
import { listQueue, seedDemoQueue, type QueueItem } from '@/lib/queue';

/**
 * QueueTransparent — the visible, billable proxy queue.
 * Every gated call appears here with cost + latency. Moat: transparency.
 */
export default function QueueTransparent() {
  const [rows, setRows] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listQueue(40));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  async function seed() {
    await seedDemoQueue();
    await refresh();
  }

  const totalCost = rows.reduce((s, r) => s + (Number(r.cost) || 0), 0);

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            QueueTransparent
            <span className="badge border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
              live
            </span>
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Every proxied call — cost, latency, status. Metadata only.
          </p>
        </div>
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
            onClick={seed}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:border-emerald-500/40"
          >
            Seed demo
          </button>
        </div>
      </div>

      <div className="flex gap-4 text-xs font-mono text-zinc-400">
        <span>
          {rows.length} calls ·{' '}
          <span className="text-emerald-400">${totalCost.toFixed(4)}</span> est.
        </span>
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Loading queue…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
          Empty. Proxy via <code className="text-emerald-400">/api/gate/…</code> or seed demo.
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900 text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Provider</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">ms</th>
                <th className="px-3 py-2 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map((r, i) => (
                <tr key={r.id ?? i} className="bg-zinc-950/40">
                  <td className="px-3 py-2 font-mono text-zinc-500">
                    {r.timestamp
                      ? new Date(r.timestamp).toLocaleTimeString()
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-zinc-200">
                    {r.provider || r.keyName || '—'}
                  </td>
                  <td
                    className={`px-3 py-2 font-mono ${
                      (r.status || 0) >= 400 ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    {r.status ?? '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-zinc-500">
                    {r.duration_ms ?? '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-amber-400">
                    {r.cost != null ? `$${Number(r.cost).toFixed(4)}` : '—'}
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
