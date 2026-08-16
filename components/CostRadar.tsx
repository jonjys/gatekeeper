'use client';

import { useEffect, useState } from 'react';

export default function CostRadar() {
  const [budget, setBudget] = useState(50);
  const [input, setInput] = useState('50');
  const [spent, setSpent] = useState(0);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('gatezero-budget');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.budget === 'number') setBudget(parsed.budget);
        if (typeof parsed.spent === 'number') setSpent(parsed.spent);
        if (typeof parsed.armed === 'boolean') setArmed(parsed.armed);
      }
    } catch (_) {}
  }, []);

  function persist(next: { budget?: number; spent?: number; armed?: boolean }) {
    const state = {
      budget: next.budget ?? budget,
      spent: next.spent ?? spent,
      armed: next.armed ?? armed
    };
    localStorage.setItem('gatezero-budget', JSON.stringify(state));
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
    if (navigator.serviceWorker?.controller) {
      const channel = new MessageChannel();
      navigator.serviceWorker.controller.postMessage(
        { type: 'ARM_KILL', ms: 30000 },
        [channel.port2]
      );
    }
  }

  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const over = spent >= budget && budget > 0;

  return (
    <div className="card space-y-4">
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
      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            over ? 'bg-red-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-zinc-500">
        Local estimate meter. Card billing later. When budget is hit, gates block locally.
      </p>
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
      </div>
    </div>
  );
}
