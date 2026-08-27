'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const TOKEN_KEY = 'gz_token';
const WS_KEY = 'gz_workspace';

type Ledger = {
  killed?: boolean;
  spend?: { monthly: number; daily: number };
  totals?: { requests: number; actual: number; savings: number; fee: number };
  rows?: Array<{
    id: string;
    provider: string;
    model: string;
    action: string;
    savings_usd: number;
    fee_usd: number;
    status: number;
    created_at: string;
  }>;
};

export default function StartUi() {
  const [token, setToken] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [secret, setSecret] = useState('');
  const [provider, setProvider] = useState('openai');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ledger, setLedger] = useState<Ledger | null>(null);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY) || '';
    const w = localStorage.getItem(WS_KEY) || '';
    setToken(t);
    setWorkspaceId(w);
    if (t) void loadLedger(t);
  }, []);

  async function loadLedger(t: string) {
    const res = await fetch('/api/v1/ledger', { headers: { 'x-gz-key': t } });
    if (res.ok) setLedger(await res.json());
  }

  async function createWorkspace() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/v1/workspace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ monthlyBudgetUsd: 50, dailyBudgetUsd: 10 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'workspace failed');
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(WS_KEY, data.workspaceId);
      setToken(data.token);
      setWorkspaceId(data.workspaceId);
      setStatus('Workspace created. Store the token — it is not shown again after refresh.');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveCredential() {
    if (!token || !secret) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/v1/credentials', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-gz-key': token },
        body: JSON.stringify({ provider, secret })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'credential failed');
      setSecret('');
      setStatus(`Vaulted ${provider} as ${data.masked}. Encrypted at rest.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  async function kill(action: 'arm' | 'disarm') {
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch('/api/v1/kill', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-gz-key': token },
        body: JSON.stringify({ action, reason: 'manual' })
      });
      const data = await res.json();
      setStatus(data.status || data.error);
      await loadLedger(token);
    } finally {
      setBusy(false);
    }
  }

  const host =
    typeof window !== 'undefined' ? window.location.origin : 'https://gatekeeper-beta-three.vercel.app';

  return (
    <main className="min-h-screen max-w-xl mx-auto px-5 py-12 space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-500 hover:text-emerald-400">
          ← GateZero
        </Link>
        <p className="badge">connect once</p>
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Point traffic. Engine runs.</h1>
      <p className="text-sm text-zinc-400 leading-relaxed">
        Create a workspace, vault one provider key, swap the base URL. Budget kill and
        savings fee run without a dashboard babysitter.
      </p>

      <section className="card space-y-3">
        <h2 className="font-semibold">1. Workspace</h2>
        {token ? (
          <p className="text-xs font-mono break-all text-emerald-300/90">{token}</p>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={createWorkspace}
            className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create workspace'}
          </button>
        )}
        {workspaceId && <p className="text-xs text-zinc-500">id {workspaceId}</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">2. Vault provider key</h2>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="w-full rounded-lg bg-black/40 border border-zinc-700 px-3 py-2 text-sm"
        >
          <option value="openai">openai</option>
          <option value="anthropic">anthropic</option>
        </select>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="sk-… stored AES-GCM at rest"
          className="w-full rounded-lg bg-black/40 border border-zinc-700 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={busy || !token || !secret}
          onClick={saveCredential}
          className="rounded-xl border border-zinc-600 px-4 py-2.5 text-sm hover:border-emerald-500/50 disabled:opacity-40"
        >
          Encrypt & store
        </button>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">3. Swap the endpoint</h2>
        <pre className="text-xs bg-black/50 rounded-xl p-4 overflow-x-auto text-emerald-300/90">{`curl -s ${host}/api/proxy/openai/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -H 'x-gz-key: ${token || 'gz_live_…'}' \\
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}'`}</pre>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Kill switch</h2>
        <p className="text-sm text-zinc-500">
          {ledger?.killed ? 'KILLED — proxy returns 402' : 'Live — fail-closed budgets still apply'}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!token || busy}
            onClick={() => kill('arm')}
            className="rounded-lg bg-red-500/90 text-black px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Kill
          </button>
          <button
            type="button"
            disabled={!token || busy}
            onClick={() => kill('disarm')}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm disabled:opacity-40"
          >
            Disarm
          </button>
        </div>
      </section>

      {ledger?.totals && (
        <section className="card space-y-2 text-sm">
          <h2 className="font-semibold">Ledger</h2>
          <p className="text-zinc-400">
            {ledger.totals.requests} req · actual ${Number(ledger.totals.actual).toFixed(4)} · saved $
            {Number(ledger.totals.savings).toFixed(4)} · fee ${Number(ledger.totals.fee).toFixed(4)}
          </p>
        </section>
      )}

      {status && <p className="text-sm text-emerald-400">{status}</p>}
    </main>
  );
}
