'use client';

import { useMemo, useState } from 'react';

type Row = {
  actual_usd: number;
  created_at: string;
  action?: string;
};

type Props = {
  token: string;
  killed: boolean;
  budgetUsd: number;
  spendUsd: number;
  rows: Row[];
  busy?: boolean;
  onChanged: () => Promise<void> | void;
  onStatus: (msg: string) => void;
};

const SLACK_KEY = 'gz_slack_webhook';

export default function KillSwitchPro({
  token,
  killed,
  budgetUsd,
  spendUsd,
  rows,
  busy,
  onChanged,
  onStatus
}: Props) {
  const [budgetInput, setBudgetInput] = useState(String(budgetUsd || 50));
  const [slack, setSlack] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(SLACK_KEY) || '' : ''
  );
  const [toast, setToast] = useState<string | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const working = busy || localBusy;

  const pct = Math.min(100, (spendUsd / Math.max(0.0001, budgetUsd)) * 100);

  const chart = useMemo(() => {
    const w = 320;
    const h = 96;
    const pad = 8;
    const chronological = [...rows].reverse();
    let acc = 0;
    const series = chronological.map((r) => {
      acc += Number(r.actual_usd) || 0;
      return acc;
    });
    if (series.length < 2) {
      return { path: '', zoneY: h - pad, w, h };
    }
    const maxY = Math.max(budgetUsd, ...series, 1);
    const pts = series.map((v, i) => {
      const x = pad + (i / (series.length - 1)) * (w - pad * 2);
      const y = h - pad - (v / maxY) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const zoneY = h - pad - (budgetUsd / maxY) * (h - pad * 2);
    return { path: `M ${pts.join(' L ')}`, zoneY, w, h };
  }, [rows, budgetUsd]);

  async function saveBudget() {
    const d = Number(budgetInput);
    if (!token || Number.isNaN(d) || d < 0) return;
    setLocalBusy(true);
    try {
      await fetch('/api/v1/workspace', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-gz-key': token },
        body: JSON.stringify({ monthlyBudgetUsd: d })
      });
      onStatus(`Budget set to $${d}`);
      await onChanged();
    } finally {
      setLocalBusy(false);
    }
  }

  async function spike() {
    if (!token) return;
    setLocalBusy(true);
    setToast(null);
    try {
      const res = await fetch('/api/v1/spike', {
        method: 'POST',
        headers: { 'x-gz-key': token }
      });
      const data = await res.json();
      setToast(data.toast || 'Kill armed');
      onStatus(data.toast || 'spike');
      await onChanged();
    } finally {
      setLocalBusy(false);
    }
  }

  async function kill(action: 'arm' | 'disarm') {
    if (!token) return;
    setLocalBusy(true);
    try {
      const res = await fetch('/api/v1/kill', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-gz-key': token },
        body: JSON.stringify({ action, reason: 'manual' })
      });
      const data = await res.json();
      onStatus(data.status || data.error);
      await onChanged();
    } finally {
      setLocalBusy(false);
    }
  }

  function saveSlack() {
    localStorage.setItem(SLACK_KEY, slack);
    onStatus(slack ? 'Slack webhook saved on this device' : 'Slack webhook cleared');
  }

  return (
    <section className="card space-y-4 border-red-500/20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="badge mb-1">{killed ? 'killed' : 'kill 2.0'}</p>
          <h2 className="font-semibold">Kill switch</h2>
        </div>
        <button
          type="button"
          disabled={!token || working}
          onClick={() => kill(killed ? 'disarm' : 'arm')}
          className={`min-h-11 px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-40 ${
            killed
              ? 'border border-red-500/50 bg-red-500/20 text-red-300'
              : 'border border-zinc-700 text-zinc-400'
          }`}
        >
          {killed ? 'Disarm' : 'Arm'}
        </button>
      </div>

      <div className="text-xl sm:text-3xl font-bold tabular-nums font-mono break-all leading-tight">
        ${spendUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        <span className="text-sm font-normal text-zinc-500"> / ${budgetUsd.toFixed(0)}</span>
      </div>
      <p className="text-[11px] text-zinc-500">
        {pct.toFixed(0)}% of budget{killed ? ' · KILLED' : pct >= 80 ? ' · RED ZONE' : ''}
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-zinc-500">$</span>
        <input
          value={budgetInput}
          onChange={(e) => setBudgetInput(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          className="min-h-11 w-24 rounded-lg bg-black/40 border border-zinc-700 px-2 py-2 text-sm font-mono"
        />
        <button
          type="button"
          disabled={!token || working}
          onClick={saveBudget}
          className="min-h-11 text-xs px-3 py-2 rounded-lg border border-emerald-500/40 text-emerald-400 disabled:opacity-40"
        >
          Set
        </button>
      </div>

      <button
        type="button"
        disabled={!token || working}
        onClick={spike}
        className="w-full min-h-12 text-sm px-3 py-3 rounded-xl border border-red-500 bg-red-500/15 text-red-400 font-semibold disabled:opacity-40"
      >
        Simulate $10k spike
      </button>

      {toast && (
        <p className="text-sm text-red-300 border border-red-500/30 bg-red-500/10 rounded-lg px-3 py-2">{toast}</p>
      )}

      <div className="relative border border-zinc-800 bg-black/40 p-2 rounded-xl">
        <svg viewBox={`0 0 ${chart.w} ${chart.h}`} className="w-full h-20 sm:h-24" preserveAspectRatio="none">
          <rect x={0} y={0} width={chart.w} height={Math.max(0, chart.zoneY)} fill="#ff0033" opacity={0.08} />
          <line
            x1={0}
            y1={chart.zoneY}
            x2={chart.w}
            y2={chart.zoneY}
            stroke="#ff0033"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.7}
          />
          {chart.path && (
            <path d={chart.path} fill="none" stroke={killed || pct >= 100 ? '#ff0033' : '#10b981'} strokeWidth={2} />
          )}
        </svg>
        {rows.length < 2 && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-zinc-600 font-mono px-2 text-center">
            Spike or Prove 20% to seed graph
          </div>
        )}
      </div>

      <div className="h-1.5 bg-zinc-900 overflow-hidden rounded-full">
        <div
          className={`h-full transition-all duration-500 ${
            killed || pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="border-t border-zinc-800 pt-3 space-y-2">
        <label className="text-[11px] text-zinc-500 block">Slack webhook (this device only)</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="https://hooks.slack.com/services/…"
            value={slack}
            onChange={(e) => setSlack(e.target.value)}
            className="flex-1 min-h-11 rounded-lg bg-black/40 border border-zinc-700 px-3 py-2 text-xs font-mono"
          />
          <button
            type="button"
            onClick={saveSlack}
            className="min-h-11 text-xs px-3 py-2 rounded-lg border border-zinc-700 text-zinc-400"
          >
            Save
          </button>
        </div>
      </div>
    </section>
  );
}
