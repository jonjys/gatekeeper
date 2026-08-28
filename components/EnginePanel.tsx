'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Row = {
  id: string;
  provider: string;
  model: string | null;
  action: string;
  savings_usd: number;
  fee_usd: number;
  actual_usd: number;
  status: number;
  created_at: string;
};

export default function EnginePanel() {
  const [token, setToken] = useState('');
  const [killed, setKilled] = useState(false);
  const [totals, setTotals] = useState({ requests: 0, actual: 0, savings: 0, fee: 0 });
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const t = localStorage.getItem('gz_token') || '';
    setToken(t);
    if (!t) return;
    let cancel = false;
    async function pull() {
      try {
        const r = await fetch('/api/v1/ledger', { headers: { 'x-gz-key': t } });
        if (!r.ok) return;
        const d = await r.json();
        if (cancel) return;
        setKilled(Boolean(d.killed));
        setTotals(d.totals || { requests: 0, actual: 0, savings: 0, fee: 0 });
        setRows(d.rows || []);
      } catch {
        /* ignore */
      }
    }
    void pull();
    const id = window.setInterval(pull, 5000);
    return () => {
      cancel = true;
      window.clearInterval(id);
    };
  }, []);

  if (!token) {
    return (
      <section className="card space-y-2 border-emerald-500/30">
        <p className="badge">engine</p>
        <p className="text-sm text-zinc-400">No workspace token in this browser.</p>
        <Link href="/start" className="text-sm text-emerald-400 hover:underline">
          Connect once →
        </Link>
      </section>
    );
  }

  return (
    <section className="card space-y-4 border-emerald-500/20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="badge mb-1">{killed ? 'killed' : 'live'}</p>
          <h2 className="font-semibold">Spend router</h2>
        </div>
        <Link href="/start" className="text-xs text-zinc-500 hover:text-emerald-400">
          manage
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          ['req', totals.requests],
          ['actual', `$${Number(totals.actual).toFixed(3)}`],
          ['saved', `$${Number(totals.savings).toFixed(3)}`],
          ['fee', `$${Number(totals.fee).toFixed(3)}`]
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-xl bg-black/40 px-2 py-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">{k}</p>
            <p className="text-sm font-semibold mt-1">{v}</p>
          </div>
        ))}
      </div>
      <ul className="space-y-1 max-h-48 overflow-auto text-xs font-mono text-zinc-400">
        {rows.slice(0, 12).map((r) => (
          <li key={r.id} className="flex justify-between gap-2">
            <span>
              {r.status} {r.provider} {r.model || ''} {r.action}
            </span>
            <span>
              ${Number(r.actual_usd).toFixed(4)} · fee ${Number(r.fee_usd).toFixed(4)}
            </span>
          </li>
        ))}
        {!rows.length && <li className="text-zinc-600">No proxied requests yet</li>}
      </ul>
    </section>
  );
}
