'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import UsageChart from '@/components/UsageChart';
import YubiGate from '@/components/YubiGate';
import VaultBackup from '@/components/VaultBackup';
import PasskeyGate from '@/components/PasskeyGate';
import AuditPanel from '@/components/AuditPanel';
import QueueTransparent from '@/components/QueueTransparent';
import EnginePanel from '@/components/EnginePanel';
import { listKeys, deleteKey } from '@/lib/crypto';
import { fetchUsageEvents } from '@/lib/supabase';

type LocalKey = { name: string; provider: string; created_at: number };
type Tab = 'usage' | 'audit';

const CUSTOMER_KEY = 'gatezero-stripe-customer';

export default function DashboardPage() {
  const [keys, setKeys] = useState<LocalKey[]>([]);
  const [chartData, setChartData] = useState<
    Array<{ label: string; cost: number; calls: number }>
  >([]);
  const [totals, setTotals] = useState({ calls: 0, cost: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('usage');
  const [banner, setBanner] = useState<string | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);

  async function refresh() {
    const local = await listKeys();
    setKeys(local);

    const events = await fetchUsageEvents(100);
    const byDay = new Map<string, { cost: number; calls: number }>();
    let cost = 0;
    let calls = 0;
    for (const e of events) {
      const day = (e.created_at || '').slice(5, 10) || '—';
      const prev = byDay.get(day) || { cost: 0, calls: 0 };
      const c = Number(e.cost_usd) || 0.001;
      prev.cost += c;
      prev.calls += 1;
      byDay.set(day, prev);
      cost += c;
      calls += 1;
    }
    setChartData(
      Array.from(byDay.entries()).map(([label, v]) => ({
        label,
        cost: Math.round(v.cost * 1e4) / 1e4,
        calls: v.calls
      }))
    );
    setTotals({ calls, cost });
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  /** After Stripe Checkout: resolve session_id → cus_ and store locally */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const checkout = params.get('checkout');

    if (checkout === 'success' && !sessionId) {
      setBanner('Checkout complete. Open Billing after the first invoice links your customer id.');
    }

    if (!sessionId || !sessionId.startsWith('cs_')) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/checkout?session_id=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.customerId && String(data.customerId).startsWith('cus_')) {
          localStorage.setItem(CUSTOMER_KEY, data.customerId);
          setBanner(`Plan active${data.plan ? ` (${data.plan})` : ''}. Billing portal is ready.`);
        } else {
          setBanner('Checkout received — customer id pending. Try Billing in a moment.');
        }
        const url = new URL(window.location.href);
        url.searchParams.delete('session_id');
        url.searchParams.delete('checkout');
        url.searchParams.delete('plan');
        window.history.replaceState({}, '', url.pathname);
      } catch {
        if (!cancelled) setBanner('Could not confirm Checkout session. You can still open Pricing.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onDelete(name: string) {
    if (!confirm(`Delete ${name} from local vault?`)) return;
    await deleteKey(name);
    await refresh();
  }

  async function openBilling() {
    setBillingBusy(true);
    setBanner(null);
    try {
      const customerId =
        new URLSearchParams(window.location.search).get('customer') ||
        localStorage.getItem(CUSTOMER_KEY);

      if (!customerId || !customerId.startsWith('cus_')) {
        setBanner(
          'No Stripe customer yet. Upgrade on Pricing first — then Billing opens the portal.'
        );
        window.setTimeout(() => {
          window.location.href = '/pricing?billing=1';
        }, 900);
        return;
      }

      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setBanner(data.detail || data.error || 'Portal failed — check STRIPE_SECRET_KEY');
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Billing request failed');
    } finally {
      setBillingBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-800 px-5 sm:px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-semibold">
          Gate<span className="text-emerald-400">Zero</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/pricing" className="text-zinc-400 hover:text-emerald-400">
            Pricing
          </Link>
          <button
            type="button"
            disabled={billingBusy}
            onClick={openBilling}
            className="text-zinc-400 hover:text-emerald-400 disabled:opacity-50"
          >
            {billingBusy ? 'Opening…' : 'Billing'}
          </button>
          <span className="text-zinc-500">Dashboard</span>
        </div>
      </header>

      <div className="flex-1 max-w-4xl mx-auto w-full px-5 sm:px-8 py-10 space-y-8">
        <EnginePanel />
        {banner && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {banner}{' '}
            {banner.includes('Pricing') && (
              <Link href="/pricing?billing=1" className="underline font-medium">
                Go to Pricing →
              </Link>
            )}
          </div>
        )}

        <div className="flex gap-2 border-b border-zinc-800 pb-2">
          {(['usage', 'audit'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
                tab === t
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'audit' ? (
          <AuditPanel />
        ) : (
          <>
            <section className="grid sm:grid-cols-3 gap-3">
              <div className="card">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Calls</p>
                <p className="text-2xl font-mono mt-1">{totals.calls.toLocaleString()}</p>
              </div>
              <div className="card">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Cost</p>
                <p className="text-2xl font-mono mt-1 text-emerald-400">
                  ${totals.cost.toFixed(4)}
                </p>
              </div>
              <div className="card">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Our 20%</p>
                <p className="text-2xl font-mono mt-1 text-amber-400">
                  ${(totals.cost * 0.02).toFixed(4)}
                </p>
              </div>
            </section>

            <section className="card space-y-3">
              <h2 className="font-semibold">CostRadar</h2>
              <UsageChart data={chartData} />
            </section>

            <QueueTransparent />

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Local vault</h2>
                <Link href="/" className="text-sm text-emerald-400 hover:underline">
                  + Import
                </Link>
              </div>
              {loading ? (
                <p className="text-zinc-500 text-sm">Loading…</p>
              ) : keys.length === 0 ? (
                <div className="card border-dashed text-center text-zinc-500 text-sm">
                  No keys yet. Import a .env on the home page.
                </div>
              ) : (
                <ul className="rounded-2xl border border-zinc-800 divide-y divide-zinc-800 overflow-hidden">
                  {keys.map((k) => (
                    <li
                      key={k.name}
                      className="flex items-center justify-between gap-4 px-4 py-3 bg-zinc-900/40"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm truncate">{k.name}</p>
                        <p className="text-xs text-zinc-500">
                          {k.provider} · {new Date(k.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDelete(k.name)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="grid sm:grid-cols-2 gap-3">
              <PasskeyGate estimatedSpendUsd={totals.cost} />
              <YubiGate estimatedSpendUsd={totals.cost} />
            </section>
            <VaultBackup />
          </>
        )}
      </div>
    </main>
  );
}
