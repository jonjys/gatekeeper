'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import KillSwitchPro from '@/components/KillSwitchPro';
import VacuumTrapPanel from '@/components/VacuumTrapPanel';

const TOKEN_KEY = 'gz_token';
const WS_KEY = 'gz_workspace';

type Row = {
  id: string;
  provider: string;
  model: string | null;
  path?: string | null;
  action: string;
  actual_usd: number;
  savings_usd: number;
  fee_usd: number;
  status: number | null;
  created_at: string;
};

type Ledger = {
  killed?: boolean;
  preferCheap?: boolean;
  failMode?: string;
  monthlyBudgetUsd?: number;
  dailyBudgetUsd?: number;
  spend?: { monthly: number; daily: number };
  totals?: { requests: number; actual: number; savings: number; fee: number };
  rows?: Row[];
};

type Hop = {
  action: string;
  requested: string;
  routed: string;
  baseline: string;
  actual: string;
  savings: string;
  fee: string;
  reply: string;
  ledger: string;
};

export default function StartUi() {
  const [token, setToken] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [secret, setSecret] = useState('');
  const [provider, setProvider] = useState('openai');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [hop, setHop] = useState<Hop | null>(null);
  const [copied, setCopied] = useState(false);

  const loadLedger = useCallback(async (t: string) => {
    const res = await fetch('/api/v1/ledger', { headers: { 'x-gz-key': t } });
    if (res.ok) setLedger(await res.json());
  }, []);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY) || '';
    const w = localStorage.getItem(WS_KEY) || '';
    setToken(t);
    setWorkspaceId(w);
    if (t) void loadLedger(t);
    if (typeof window === 'undefined') return;
    const sessionId = new URLSearchParams(window.location.search).get('session_id');
    if (!sessionId || !sessionId.startsWith('cs_')) return;
    void fetch(`/api/checkout?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.customerId) setStatus(`Plan active${d.plan ? ` (${d.plan})` : ''}. Stripe customer linked.`);
      })
      .catch(() => {});
  }, [loadLedger]);

  useEffect(() => {
    if (!token) return;
    const id = window.setInterval(() => void loadLedger(token), 4000);
    return () => window.clearInterval(id);
  }, [token, loadLedger]);

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
      setStatus('Workspace created. Token stays in this browser.');
      await loadLedger(data.token);
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

  async function runHop(kind: 'models' | 'chat' | 'save') {
    if (!token) return;
    setBusy(true);
    try {
      if (kind === 'models') {
        const res = await fetch('/api/proxy/openai/v1/models', { headers: { 'x-gz-key': token } });
        const text = await res.text();
        let n = 0;
        try {
          const j = JSON.parse(text) as { data?: unknown[] };
          n = Array.isArray(j.data) ? j.data.length : 0;
        } catch {
          /* ignore */
        }
        setHop({
          action: res.headers.get('x-gz-action') || 'passthrough',
          requested: 'models',
          routed: 'models',
          baseline: res.headers.get('x-gz-baseline-usd') || '0',
          actual: res.headers.get('x-gz-actual-usd') || '0',
          savings: res.headers.get('x-gz-savings-usd') || '0',
          fee: res.headers.get('x-gz-fee-usd') || '0',
          reply: res.ok ? `${n} models through the booth` : text.slice(0, 240),
          ledger: res.headers.get('x-gz-ledger') || 'n/a'
        });
        setStatus(res.ok ? 'Proxy live.' : `Ping failed ${res.status}`);
      } else {
        const model = kind === 'save' ? 'gpt-4o' : 'gpt-4o-mini';
        const content =
          kind === 'save'
            ? 'Reply with the single word ok. This hop is a savings proof: requested gpt-4o must route cheaper.'
            : 'say ok';
        const res = await fetch('/api/proxy/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-gz-key': token },
          body: JSON.stringify({ model, messages: [{ role: 'user', content }] })
        });
        const text = await res.text();
        let reply = text.slice(0, 280);
        try {
          const j = JSON.parse(text) as {
            choices?: Array<{ message?: { content?: string } }>;
            error?: { message?: string };
          };
          reply = j.choices?.[0]?.message?.content || j.error?.message || reply;
        } catch {
          /* ignore */
        }
        setHop({
          action: res.headers.get('x-gz-action') || (res.ok ? 'passthrough' : 'error'),
          requested: res.headers.get('x-gz-requested-model') || model,
          routed: res.headers.get('x-gz-routed-model') || model,
          baseline: res.headers.get('x-gz-baseline-usd') || '0',
          actual: res.headers.get('x-gz-actual-usd') || '0',
          savings: res.headers.get('x-gz-savings-usd') || '0',
          fee: res.headers.get('x-gz-fee-usd') || '0',
          reply,
          ledger: res.headers.get('x-gz-ledger') || 'n/a'
        });
        setStatus(
          res.ok
            ? kind === 'save'
              ? `Routed ${res.headers.get('x-gz-requested-model')} → ${res.headers.get('x-gz-routed-model')}`
              : 'Chat live.'
            : `Upstream ${res.status}`
        );
      }
      await loadLedger(token);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'hop failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleCheap() {
    if (!token) return;
    const next = !(ledger?.preferCheap !== false);
    await fetch('/api/v1/workspace', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-gz-key': token },
      body: JSON.stringify({ preferCheap: next })
    });
    await loadLedger(token);
  }

  async function copyToken() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const host = typeof window !== 'undefined' ? window.location.origin : 'https://getgatezero.com';
  const snippet = useMemo(
    () =>
      `${host}/api/proxy/openai/v1/chat/completions\nx-gz-key: ${token || 'gz_live_…'}`,
    [host, token]
  );

  const totals = ledger?.totals;
  const killed = Boolean(ledger?.killed);

  return (
    <main className="min-h-screen max-w-xl mx-auto px-5 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-500 hover:text-emerald-400">
          ← GateZero
        </Link>
        <p className="badge">{killed ? 'killed' : 'booth live'}</p>
      </div>
      <h1 className="text-3xl font-bold tracking-tight">The booth.</h1>
      <p className="text-sm text-zinc-400 leading-relaxed">
        Vault a key, prove the 20% take, kill if it runs. Built to work from a phone.
      </p>

      {totals && (
        <section className="grid grid-cols-4 gap-2 text-center">
          {[
            ['req', totals.requests],
            ['spend', `$${Number(totals.actual).toFixed(3)}`],
            ['saved', `$${Number(totals.savings).toFixed(3)}`],
            ['take', `$${Number(totals.fee).toFixed(3)}`]
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-xl border border-zinc-800 bg-zinc-900/50 py-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">{k}</p>
              <p className="font-mono text-sm mt-1">{v}</p>
            </div>
          ))}
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="font-semibold">Prove the take-rate</h2>
        <p className="text-sm text-zinc-500">
          Asks for gpt-4o. Engine aliases to gpt-4o-mini. Fee is 20% of the verified delta.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={!token || busy}
            onClick={() => runHop('save')}
            className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-40 min-h-11"
          >
            Prove 20%
          </button>
          <button
            type="button"
            disabled={!token || busy}
            onClick={() => runHop('chat')}
            className="rounded-xl border border-zinc-600 px-4 py-3 text-sm disabled:opacity-40 min-h-11"
          >
            Send hi
          </button>
          <button
            type="button"
            disabled={!token || busy}
            onClick={() => runHop('models')}
            className="rounded-xl border border-zinc-600 px-4 py-3 text-sm disabled:opacity-40 min-h-11"
          >
            Ping models
          </button>
        </div>
        {hop && (
          <div className="rounded-xl bg-black/50 p-4 space-y-2 text-sm">
            <p className="font-mono text-emerald-300">
              {hop.requested} → {hop.routed} · {hop.action}
            </p>
            <p className="text-zinc-400">{hop.reply}</p>
            <p className="font-mono text-xs text-zinc-500">
              baseline ${hop.baseline} · actual ${hop.actual} · saved ${hop.savings} · take ${hop.fee} ·
              ledger {hop.ledger}
            </p>
          </div>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">1. Workspace</h2>
        {token ? (
          <div className="space-y-2">
            <p className="text-xs font-mono break-all text-emerald-300/90">{token}</p>
            <button type="button" onClick={copyToken} className="text-xs text-zinc-400 hover:text-emerald-400 min-h-11">
              {copied ? 'Copied' : 'Copy token'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={createWorkspace}
            className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50 min-h-11"
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
          className="w-full rounded-lg bg-black/40 border border-zinc-700 px-3 py-3 text-sm min-h-11"
        >
          <option value="openai">openai</option>
          <option value="anthropic">anthropic</option>
        </select>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="sk-… stored AES-GCM at rest"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          className="w-full rounded-lg bg-black/40 border border-zinc-700 px-3 py-3 text-sm min-h-11"
        />
        <button
          type="button"
          disabled={busy || !token || !secret}
          onClick={saveCredential}
          className="rounded-xl border border-zinc-600 px-4 py-3 text-sm hover:border-emerald-500/50 disabled:opacity-40 min-h-11"
        >
          Encrypt & store
        </button>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Cheaper alias</h2>
          <button type="button" onClick={toggleCheap} className="text-xs text-zinc-400 hover:text-emerald-400 min-h-11">
            {ledger?.preferCheap !== false ? 'ON' : 'OFF'}
          </button>
        </div>
        <p className="text-sm text-zinc-500">gpt-4o → gpt-4o-mini when on. Fee is 20% of the verified delta.</p>
      </section>

      <KillSwitchPro
        token={token}
        killed={killed}
        budgetUsd={Number(ledger?.monthlyBudgetUsd) || 50}
        spendUsd={Number(ledger?.spend?.monthly) || Number(totals?.actual) || 0}
        rows={ledger?.rows || []}
        busy={busy}
        onChanged={() => (token ? loadLedger(token) : Promise.resolve())}
        onStatus={setStatus}
      />

      <VacuumTrapPanel token={token} busy={busy} onStatus={setStatus} />

      <section className="card space-y-3">
        <h2 className="font-semibold">Ledger</h2>
        <ul className="space-y-1 max-h-56 overflow-auto text-xs font-mono text-zinc-400">
          {(ledger?.rows || []).slice(0, 16).map((r) => (
            <li key={r.id} className="flex justify-between gap-2 border-b border-zinc-800/80 py-1">
              <span className="truncate">
                {r.status} {r.provider} {r.model || r.path || ''} {r.action}
              </span>
              <span className="shrink-0">
                save ${Number(r.savings_usd).toFixed(4)} · take ${Number(r.fee_usd).toFixed(4)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Endpoint</h2>
        <pre className="text-xs bg-black/50 rounded-xl p-4 overflow-x-auto text-emerald-300/90">{snippet}</pre>
      </section>

      {status && <p className="text-sm text-emerald-400">{status}</p>}
    </main>
  );
}
