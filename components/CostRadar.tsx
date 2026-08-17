'use client';

import { useEffect, useState } from 'react';

type BadgeNavigator = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/** Browser-only. Never call during SSR/prerender. */
function updateBadge(spent: number, budget: number) {
  if (typeof window === 'undefined') return;
  try {
    const nav = navigator as BadgeNavigator;
    if (typeof nav.setAppBadge !== 'function') return;
    const left = Math.max(0, Math.round(budget - spent));
    if (spent >= budget && budget > 0) {
      void nav.setAppBadge(99);
    } else if (spent > 0) {
      void nav.setAppBadge(Math.min(99, left));
    } else if (typeof nav.clearAppBadge === 'function') {
      void nav.clearAppBadge();
    }
  } catch {
    /* badge unsupported */
  }
}

export default function CostRadar() {
  const [budget, setBudget] = useState(50);
  const [input, setInput] = useState('50');
  const [spent, setSpent] = useState(0);
  const [armed, setArmed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('gatezero-budget');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.budget === 'number') setBudget(parsed.budget);
        if (typeof parsed.spent === 'number') setSpent(parsed.spent);
        if (typeof parsed.armed === 'boolean') setArmed(parsed.armed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    updateBadge(spent, budget);
  }, [spent, budget]);

  function persist(next: { budget?: number; spent?: number; armed?: boolean }) {
    const state = {
      budget: next.budget ?? budget,
      spent: next.spent ?? spent,
      armed: next.armed ?? armed
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('gatezero-budget', JSON.stringify(state));
    }
    updateBadge(state.spent, state.budget);
  }

  function showKillToast(blockedUsd: number) {
    const fee = blockedUsd * 0.02;
    setToast(
      `Blocked $${blockedUsd.toFixed(2)} in runaway spend. GateZero fee: $${fee.toFixed(2)}`
    );
    window.setTimeout(() => setToast(null), 6000);
  }

  function setBudgetValue() {
    const n = Number(input);
    if (!Number.isFinite(n) || n < 0) return;
    setBudget(n);
    persist({ budget: n });
  }

  function armKill() {
    setArmed(true);
    persist({ armed: true });
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'ARM_KILL', ms: 60000 });
    }
  }

  function simulateSpike() {
    const blocked = 18.4;
    const next = budget > 0 ? budget + blocked : blocked;
    setSpent(next);
    setArmed(true);
    persist({ spent: next, armed: true });
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'ARM_KILL', ms: 60000 });
    }
    showKillToast(blocked);
  }

  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const over = spent >= budget && budget > 0;
  const left = Math.max(0, budget - spent);

  return (
    <div className="card space-y-4 relative">
      {toast && (
        <div className="absolute -top-2 left-4 right-4 z-10 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 shadow-lg shadow-emerald-500/10">
          {toast}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-zinc-100">CostRadar</h3>
        <span className={`badge ${over ? 'border-red-500/40 bg-red-500/10 text-red-400' : ''}`}>
          {over ? 'KILL ARMED' : armed ? 'armed' : 'monitor'}
        </span>
      </div>
      <p className="text-2xl font-mono tracking-tight">
        <span className={over ? 'text-red-400' : 'text-emerald-400'}>
          ${spent.toFixed(2)}
        </span>
        <span className="text-zinc-500 text-lg"> / ${budget.toFixed(0)} budget</span>
      </p>
      <p className="text-xs font-mono text-zinc-500">
        {over
          ? 'Budget hit — gates return 503 until raised'
          : `$${left.toFixed(2)} left · 2% fee only on proxied spend`}
      </p>
      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-zinc-500 text-sm">$</span>
        <input
          type="number"
          min={0}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="button"
          onClick={setBudgetValue}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-emerald-500/50 transition"
        >
          Set
        </button>
        <button
          type="button"
          onClick={armKill}
          className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-black hover:bg-white transition"
        >
          Arm kill switch
        </button>
        <button
          type="button"
          onClick={simulateSpike}
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20 transition"
        >
          Simulate budget hit
        </button>
      </div>
    </div>
  );
}
