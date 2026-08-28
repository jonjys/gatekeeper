'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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

export default function StartUi() {
  const [token, setToken] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [secret, setSecret] = useState('');
  const [provider, setProvider] = useState('openai');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [pingOut, setPingOut] = useState<string | null>(null);
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

  async function ping(kind: 'models' | 'chat') {
    if (!token) return;
    setBusy(true);
    setPingOut(null);
    try {
      if (kind === 'models') {
        const res = await fetch('/api/proxy/openai/v1/models', { headers: { 'x-gz-key': token } });
        const text = await res.text();
        const ledgerHdr = res.headers.get('x-gz-ledger');
        let n = 0;
        try {
          const j = JSON.parse(text) as { data?: unknown[] };
          n = Array.isArray(j.data) ? j.data.length : 0;
        } catch {
          /* ignore */
        }
        if (!res.ok) {
          setPingOut(text.slice(0, 400));
          setStatus(`Ping failed ${res.status}`);
        } else {
          setPingOut(`${n} models · ledger ${ledgerHdr || 'n/a'}`);
          setStatus('Proxy live. Models listed through GateZero.');
        }
      } else {
        const res = await fetch('/api/proxy/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-gz-key': token },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'say ok' }]
          })
        });
        const text = await res.text();
        const ledgerHdr = res.headers.get('x-gz-ledger');
        const fee = res.headers.get('x-gz-fee-usd');
        const actual = res.headers.get('x-gz-actual-usd');
        let content = text.slice(0, 280);
        try {
          const j = JSON.parse(text) as {
            choices?: Array<{ message?: { content?: string } }>;
            error?: { message?: string; code?: string };
          };
          content = j.choices?.[0]?.message?.content || j.error?.message || content;
        } catch {
          /* ignore */
        }
        setPingOut(content);
        setStatus(
          res.ok
            ? `Chat live · actual $${actual} · fee $${fee} · ledger ${ledgerHdr}`
            : `Upstream ${res.status} · ledger ${ledgerHdr}`
        );
      }
      await loadLedger(token);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'ping failed');
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

  const host = typeof window !== 'undefined' ? window.location.origin : 'https://gatekeeper-beta-three.vercel.app';
  const snippet = useMemo(
    () =>
      `curl.exe -s ${host}/api/proxy/openai/v1/chat/completions -H "content-type: application/json" -H "x-gz-key: ${token || 'gz_live_…'}" -d "{\\"model\\":\\"gpt-4o-mini\\",\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"hi\\"}]}"`,
    [host, token]
  );

  const totals = ledger?.totals;
  const killed = Boolean(ledger?.killed);

  return (
    <main className="min-h-screen max-w-xl mx-auto px-5 py-12 space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-500 hover:text-emerald-400">
          ← GateZero
        </Link>
        <p className="badge">{killed ? 'killed' : 'engine live'}</p>
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Point traffic. Engine runs.</h1>
      <p className="text-sm text-zinc-400 leading-relaxed">
        Workspace, vault, ping. Budget kill and 20% of verified savings — no PowerShell required.
      </p>

      <section className="card space-y-3">
        <h2 className="font-semibold">1. Workspace</h2>
        {token ? (
          <div className="space-y-2">
            <p className="text-xs font-mono break-all text-emerald-300/90">{token}</p>
            <button type="button" onClick={copyToken} className="text-xs text-zinc-400 hover:text-emerald-400">
              {copied ? 'Copied' : 'Copy token'}
            </button>
          </div>
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
        <h2 className="font-semibold">3. Ping the toll booth</h2>
        <p className="text-sm text-zinc-500">Runs in this browser. Models is free. Chat spends a fraction of a cent.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!token || busy}
            onClick={() => ping('models')}
            className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            Ping models
          </button>
          <button
            type="button"
            disabled={!token || busy}
            onClick={() => ping('chat')}
            className="rounded-xl border border-zinc-600 px-4 py-2.5 text-sm disabled:opacity-40"
          >
            Send hi
          </button>
        </div>
        {pingOut && (
          <pre className="text-xs bg-black/50 rounded-xl p-3 overflow-x-auto text-emerald-300/90 whitespace-pre-wrap">
            {pingOut}
          </pre>
        )}
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Kill switch</h2>
          <button type="button" onClick={toggleCheap} className="text-xs text-zinc-400 hover:text-emerald-400">
            cheaper alias {ledger?.preferCheap !== false ? 'ON' : 'OFF'}
          </button>
        </div>
        <p className="text-sm text-zinc-500">
          {killed ? 'KILLED — proxy returns 402' : 'Live — fail-closed budgets still apply'}
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

      <section className="card space-y-3">
        <h2 className="font-semibold">Ledger</h2>
        <p className="text-zinc-400 text-sm">
          {totals ? (
            <>
              {totals.requests} req · actual ${Number(totals.actual).toFixed(4)} · saved $
              {Number(totals.savings).toFixed(4)} · fee ${Number(totals.fee).toFixed(4)}
            </>
          ) : (
            'No rows yet — ping models.'
          )}
        </p>
        <ul className="space-y-1 max-h-56 overflow-auto text-xs font-mono text-zinc-400">
          {(ledger?.rows || []).slice(0, 16).map((r) => (
            <li key={r.id} className="flex justify-between gap-2 border-b border-zinc-800/80 py-1">
              <span className="truncate">
                {r.status} {r.provider} {r.model || r.path || ''} {r.action}
              </span>
              <span className="shrink-0">
                ${Number(r.actual_usd).toFixed(4)} · fee ${Number(r.fee_usd).toFixed(4)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Windows snippet</h2>
        <pre className="text-xs bg-black/50 rounded-xl p-4 overflow-x-auto text-emerald-300/90">{snippet}</pre>
      </section>

      {status && <p className="text-sm text-emerald-400">{status}</p>}
    </main>
  );
}
