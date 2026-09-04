'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import KillSwitchPro from '@/components/KillSwitchPro';
import VacuumTrapPanel from '@/components/VacuumTrapPanel';
import {
  cheapPassthroughModel,
  hopPath,
  hopSnippet,
  isRoutableProvider,
  modelsPath,
  proveRequestedModel
} from '@/lib/engine/hop';

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

type Vaulted = { provider: string; masked: string; created_at?: string };

export default function StartUi() {
  const [token, setToken] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [secret, setSecret] = useState('');
  const [provider, setProvider] = useState('openai');
  const [status, setStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<'ok' | 'err'>('ok');
  const [busy, setBusy] = useState(false);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [hop, setHop] = useState<Hop | null>(null);
  const [copied, setCopied] = useState(false);
  const [pasteToken, setPasteToken] = useState('');
  const [vaulted, setVaulted] = useState<Vaulted[]>([]);

  const loadLedger = useCallback(async (t: string) => {
    const res = await fetch('/api/v1/ledger', { headers: { 'x-gz-key': t } });
    if (res.ok) setLedger(await res.json());
  }, []);

  const loadCredentials = useCallback(async (t: string) => {
    const res = await fetch('/api/v1/credentials', { headers: { 'x-gz-key': t } });
    if (!res.ok) return;
    const data = (await res.json()) as { credentials?: Vaulted[] };
    setVaulted(data.credentials || []);
  }, []);

  const note = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setStatus(msg);
    setStatusKind(kind);
  };

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY) || '';
    const w = localStorage.getItem(WS_KEY) || '';
    setToken(t);
    setWorkspaceId(w);
    if (t) {
      void loadLedger(t);
      void loadCredentials(t);
    }
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    const sessionId = q.get('session_id');
    if (q.get('upgrade')) {
      note('Create or restore a workspace here, then return to Pricing to checkout.');
    }
    if (!sessionId || !sessionId.startsWith('cs_')) return;
    void fetch(`/api/checkout?session_id=${encodeURIComponent(sessionId)}`, {
      headers: t ? { 'x-gz-key': t } : undefined
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.customerId) {
          note(
            `Plan active${d.plan ? ` (${d.plan})` : ''}.${d.bound ? ' Stripe customer linked to this workspace.' : ' Stripe customer resolved.'}`
          );
        }
      })
      .catch(() => {});
  }, [loadLedger, loadCredentials]);

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
      note('Workspace created. Token stays in this browser.');
      await loadLedger(data.token);
    } catch (e) {
      note(e instanceof Error ? e.message : 'failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function restoreWorkspace() {
    const t = pasteToken.trim();
    if (!t.startsWith('gz_live_') && !t.startsWith('gz_test_')) {
      note('Paste a gz_live_… token', 'err');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/v1/workspace', { headers: { 'x-gz-key': t } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'unknown workspace');
      localStorage.setItem(TOKEN_KEY, t);
      localStorage.setItem(WS_KEY, data.id);
      setToken(t);
      setWorkspaceId(data.id);
      setPasteToken('');
      note('Workspace restored on this device.');
      await loadLedger(t);
      await loadCredentials(t);
    } catch (e) {
      note(e instanceof Error ? e.message : 'restore failed', 'err');
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
      note(`Vaulted ${provider} as ${data.masked}. Encrypted at rest.`);
      await loadCredentials(token);
    } catch (e) {
      note(e instanceof Error ? e.message : 'failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function runHop(kind: 'models' | 'chat' | 'save') {
    if (!token) return;
    const hopProvider = vaulted.some((c) => c.provider === provider)
      ? provider
      : vaulted[0]?.provider || 'openai';
    if (!isRoutableProvider(hopProvider)) {
      note('Vault openai or anthropic first.', 'err');
      return;
    }
    setBusy(true);
    try {
      if (kind === 'models') {
        const res = await fetch(`/api/proxy/${hopProvider}/${modelsPath(hopProvider)}`, {
          headers: { 'x-gz-key': token }
        });
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
          reply: res.ok ? `${n} models through the booth (${hopProvider})` : text.slice(0, 240),
          ledger: res.headers.get('x-gz-ledger') || 'n/a'
        });
        setStatus(
          res.ok
            ? 'Proxy live.'
            : text.includes('missing_provider_credential')
              ? `Vault a restricted ${hopProvider} key below first.`
              : text.includes('KILL')
                ? 'Kill is armed. Tap Disarm, then hop.'
                : `Ping failed ${res.status}`
        );
        setStatusKind(res.ok ? 'ok' : 'err');
      } else {
        const requested = kind === 'save' ? proveRequestedModel(hopProvider) : cheapPassthroughModel(hopProvider);
        const content =
          kind === 'save'
            ? `Reply with the single word ok. This hop is a savings proof: requested ${requested} must route cheaper.`
            : 'say ok';
        const body =
          hopProvider === 'anthropic'
            ? { model: requested, max_tokens: 32, messages: [{ role: 'user', content }] }
            : { model: requested, messages: [{ role: 'user', content }] };
        const res = await fetch(`/api/proxy/${hopProvider}/${hopPath(hopProvider)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-gz-key': token },
          body: JSON.stringify(body)
        });
        const text = await res.text();
        let reply = text.slice(0, 280);
        try {
          const j = JSON.parse(text) as {
            choices?: Array<{ message?: { content?: string } }>;
            content?: Array<{ text?: string }>;
            error?: { message?: string };
          };
          reply =
            j.choices?.[0]?.message?.content ||
            j.content?.[0]?.text ||
            j.error?.message ||
            reply;
        } catch {
          /* ignore */
        }
        setHop({
          action: res.headers.get('x-gz-action') || (res.ok ? 'passthrough' : 'error'),
          requested: res.headers.get('x-gz-requested-model') || requested,
          routed: res.headers.get('x-gz-routed-model') || requested,
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
            : text.includes('missing_provider_credential')
              ? `Vault a restricted ${hopProvider} key below first.`
              : text.includes('KILL')
                ? 'Kill is armed. Tap Disarm, then hop.'
                : `Upstream ${res.status}`
        );
        setStatusKind(res.ok ? 'ok' : 'err');
      }
      await loadLedger(token);
    } catch (e) {
      note(e instanceof Error ? e.message : 'hop failed', 'err');
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

  async function burnProvider(name: string) {
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/credentials?provider=${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: { 'x-gz-key': token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'burn failed');
      note(`Burned ${name} from the vault.`);
      await loadCredentials(token);
    } catch (e) {
      note(e instanceof Error ? e.message : 'burn failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function openBilling() {
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-gz-key': token }
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.error === 'no_customer') {
        window.location.href = '/pricing?billing=1';
        return;
      }
      throw new Error(data.detail || data.error || 'portal failed');
    } catch (e) {
      note(e instanceof Error ? e.message : 'billing failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function copyToken() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const host = typeof window !== 'undefined' ? window.location.origin : 'https://getgatezero.com';
  const hopProvider = vaulted.some((c) => c.provider === provider)
    ? provider
    : vaulted[0]?.provider || 'openai';
  const snippet = useMemo(
    () => hopSnippet(host, hopProvider, token),
    [host, hopProvider, token]
  );

  const totals = ledger?.totals;
  const killed = Boolean(ledger?.killed);
  const liveRows = (ledger?.rows || []).filter((r) => r.provider !== 'sim' && r.action !== 'spike');
  const cardTotals = {
    requests: liveRows.length,
    actual: liveRows.reduce((s, r) => s + Number(r.actual_usd || 0), 0),
    savings: liveRows.reduce((s, r) => s + Number(r.savings_usd || 0), 0),
    fee: liveRows.reduce((s, r) => s + Number(r.fee_usd || 0), 0)
  };

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
        Vault a restricted key. Ask gpt-4o or Claude sonnet — we send the cheap alias. Kill if it runs.
        No save → no fee.
      </p>

      {token && (
        <section className="grid grid-cols-4 gap-2 text-center">
          {[
            ['req', cardTotals.requests],
            ['spend', `$${cardTotals.actual.toFixed(4)}`],
            ['saved', `$${cardTotals.savings.toFixed(4)}`],
            ['take', `$${cardTotals.fee.toFixed(4)}`]
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-xl border border-zinc-800 bg-zinc-900/50 py-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">{k}</p>
              <p className="font-mono text-sm mt-1">{v}</p>
            </div>
          ))}
        </section>
      )}

      {status && (
        <p
          className={`text-sm rounded-xl border px-4 py-3 ${
            statusKind === 'err'
              ? 'border-red-500/40 bg-red-500/10 text-red-300'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {status}
        </p>
      )}
      {killed && (
        <p className="text-sm rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">
          Kill is armed. Disarm below before Prove / Ping, or hops stay blocked.
        </p>
      )}

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
          <div className="space-y-2">
            <button
              type="button"
              disabled={busy}
              onClick={createWorkspace}
              className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50 min-h-11"
            >
              {busy ? 'Creating…' : 'Create workspace'}
            </button>
            <p className="text-xs text-zinc-500">Already have a token?</p>
            <input
              value={pasteToken}
              onChange={(e) => setPasteToken(e.target.value)}
              placeholder="gz_live_…"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg bg-black/40 border border-zinc-700 px-3 py-3 text-sm min-h-11 font-mono"
            />
            <button
              type="button"
              disabled={busy || !pasteToken}
              onClick={() => void restoreWorkspace()}
              className="text-xs text-zinc-400 hover:text-emerald-400 min-h-11"
            >
              Restore workspace
            </button>
          </div>
        )}
        {workspaceId && <p className="text-xs text-zinc-500">id {workspaceId}</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">2. Vault a restricted key</h2>
        <p className="text-xs text-zinc-500">
          OpenAI or Anthropic → restricted key with a spend cap. Not your master key. Encrypted
          AES-256-GCM. Burn anytime.
        </p>
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
          placeholder={provider === 'anthropic' ? 'sk-ant-… restricted key' : 'sk-… restricted key'}
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
        {vaulted.length > 0 && (
          <ul className="text-xs font-mono text-zinc-400 space-y-1">
            {vaulted.map((c) => (
              <li key={c.provider} className="flex justify-between gap-2 items-center">
                <span>
                  {c.provider} · {c.masked}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void burnProvider(c.provider)}
                  className="text-red-400 hover:text-red-300 disabled:opacity-40 min-h-11"
                >
                  Burn
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">3. Prove cheaper route</h2>
        <p className="text-sm text-zinc-500">
          OpenAI: gpt-4o → gpt-4o-mini. Anthropic: claude sonnet → haiku. Uses the provider you vaulted
          (or the dropdown if both).
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={!token || busy}
            onClick={() => runHop('save')}
            className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-40 min-h-11"
          >
            Prove cheaper route
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
            <p className="text-zinc-400 break-words">{hop.reply}</p>
            <p className="font-mono text-xs text-zinc-500">
              baseline ${hop.baseline} · actual ${hop.actual} · saved ${hop.savings} · take ${hop.fee} ·
              ledger {hop.ledger}
            </p>
          </div>
        )}
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Cheaper alias</h2>
          <button type="button" onClick={toggleCheap} className="text-xs text-zinc-400 hover:text-emerald-400 min-h-11">
            {ledger?.preferCheap !== false ? 'ON' : 'OFF'}
          </button>
        </div>
        <p className="text-sm text-zinc-500">gpt-4o → mini · claude sonnet → haiku when on.</p>
      </section>

      <KillSwitchPro
        token={token}
        killed={killed}
        budgetUsd={Number(ledger?.monthlyBudgetUsd) || 50}
        dailyBudgetUsd={Number(ledger?.dailyBudgetUsd) || 10}
        spendUsd={Number(ledger?.spend?.monthly) || Number(totals?.actual) || 0}
        dailySpendUsd={Number(ledger?.spend?.daily) || 0}
        failMode={ledger?.failMode || 'closed'}
        rows={ledger?.rows || []}
        busy={busy}
        onChanged={() => (token ? loadLedger(token) : Promise.resolve())}
        onStatus={(msg) => note(msg, /fail|error|KILL/i.test(msg) && !/DISARMED/.test(msg) ? 'err' : 'ok')}
      />

      <VacuumTrapPanel token={token} busy={busy} onStatus={(msg) => note(msg, /fail/i.test(msg) ? 'err' : 'ok')} />

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
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void copySnippet()} className="text-xs text-zinc-400 hover:text-emerald-400 min-h-11">
            {copied ? 'Copied' : 'Copy endpoint'}
          </button>
          {token && (
            <button type="button" onClick={() => void openBilling()} className="text-xs text-zinc-400 hover:text-emerald-400 min-h-11">
              Billing portal
            </button>
          )}
          <Link href="/pricing" className="text-xs text-zinc-400 hover:text-emerald-400 min-h-11 inline-flex items-center">
            Pricing
          </Link>
        </div>
      </section>
    </main>
  );
}
