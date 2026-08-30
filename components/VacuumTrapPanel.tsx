'use client';

import { useState } from 'react';
import { mintTrapSecret, runVacuum, type VacuumHit } from '@/lib/vacuum';

type Props = {
  token: string;
  busy?: boolean;
  onStatus: (msg: string) => void;
};

export default function VacuumTrapPanel({ token, busy, onStatus }: Props) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hits, setHits] = useState<VacuumHit[] | null>(null);
  const [total, setTotal] = useState(0);
  const [trapMasked, setTrapMasked] = useState<string | null>(null);

  async function onVacuum() {
    setRunning(true);
    setProgress(12);
    setHits(null);
    onStatus('VACUUM — scanning clipboard + localStorage (tap only)');
    const tick = window.setInterval(() => setProgress((p) => Math.min(90, p + 18)), 80);
    try {
      const result = await runVacuum();
      setHits(result.hits);
      setTotal(result.total);
      onStatus(`VACUUM done — ${result.total} secret-like hits in ${result.hits.length} surfaces`);
    } finally {
      window.clearInterval(tick);
      setProgress(100);
      setRunning(false);
    }
  }

  async function onDropTrap() {
    if (!token) {
      onStatus('Create a workspace first');
      return;
    }
    const secret = mintTrapSecret();
    try {
      const res = await fetch('/api/v1/trap', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-gz-key': token },
        body: JSON.stringify({ secret, label: 'honeypot' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'trap failed');
      setTrapMasked(data.masked || secret.slice(0, 18) + '…');
      onStatus(`TRAP armed · ${data.masked}. Presenting it returns 451.`);
    } catch (e) {
      onStatus(e instanceof Error ? e.message : 'trap failed');
    }
  }

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="badge mb-1">paranoia</p>
          <h2 className="font-semibold">Vacuum + trap</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">Scan local surfaces. Drop a honeypot key.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={running || busy}
            onClick={() => void onVacuum()}
            className="min-h-11 text-xs px-3 py-2 rounded-lg border border-emerald-500/50 text-emerald-400 font-semibold disabled:opacity-40"
          >
            {running ? `VACUUM ${progress.toFixed(0)}%` : 'VACUUM'}
          </button>
          <button
            type="button"
            disabled={!token || busy}
            onClick={() => void onDropTrap()}
            className="min-h-11 text-xs px-3 py-2 rounded-lg border border-fuchsia-500/50 text-fuchsia-300 font-semibold disabled:opacity-40"
          >
            DROP TRAP
          </button>
        </div>
      </div>

      {running && (
        <div className="h-1.5 bg-zinc-900 overflow-hidden rounded-full">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {hits && (
        <div className="text-xs font-mono space-y-2">
          <p className="text-emerald-400">
            Found {total} in {hits.length} surfaces
          </p>
          {hits.length === 0 ? (
            <p className="text-zinc-500">Clean — or iOS blocked clipboard until you paste.</p>
          ) : (
            <ul className="space-y-1 max-h-36 overflow-y-auto">
              {hits.map((h) => (
                <li key={h.surface} className="text-zinc-400 flex justify-between gap-2">
                  <span>{h.surface}</span>
                  <span className="text-zinc-500 truncate">
                    {h.count} · {h.samples.join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {trapMasked && (
        <p className="text-xs font-mono text-fuchsia-300 border border-fuchsia-500/20 rounded-lg px-3 py-2">
          Armed {trapMasked} — proxy returns 451, never forwarded.
        </p>
      )}
    </section>
  );
}
