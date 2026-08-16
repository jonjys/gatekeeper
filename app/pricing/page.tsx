'use client';

import { useState } from 'react';
import Link from 'next/link';

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    take: '2% take-rate',
    features: ['Local vault + Web Locks', 'CostRadar kill-switch', 'Import .env', 'Community support'],
    cta: 'Start free',
    href: '/',
    highlight: false
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    period: '/mo',
    take: '2% take-rate',
    features: [
      'Everything in Free',
      'Passkeys + YubiGate',
      'Audit log + CSV export',
      'Priority proxy path'
    ],
    cta: 'Upgrade to Pro',
    href: null,
    highlight: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$299',
    period: '/mo',
    take: '1% take-rate',
    features: [
      'Everything in Pro',
      'SSO / team seats',
      'Custom take-rate contracts',
      'Dedicated support'
    ],
    cta: 'Talk to sales',
    href: null,
    highlight: false
  }
];

export default function PricingPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(plan: string) {
    setBusy(plan);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Checkout failed');
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('No checkout URL returned');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-800/80 px-5 sm:px-8 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span>🔒</span>
          <span>
            Gate<span className="text-emerald-400">Zero</span>
          </span>
        </Link>
        <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-emerald-400">
          Dashboard
        </Link>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-5 py-14 space-y-10">
        <div className="text-center space-y-3">
          <p className="badge">pricing</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Keys stay local. Revenue scales.
          </h1>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Seat fees for features. 2% (or 1%) take-rate on proxied API spend. No secrets on our
            servers.
          </p>
        </div>

        {error && (
          <p className="text-center text-sm text-red-400">
            {error} — set STRIPE_SECRET_KEY for live Checkout.
          </p>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          {TIERS.map((t) => (
            <div
              key={t.id}
              className={`card flex flex-col gap-4 ${
                t.highlight ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10' : ''
              }`}
            >
              <div>
                <p className="text-sm text-zinc-400">{t.name}</p>
                <p className="text-3xl font-bold mt-1">
                  {t.price}
                  <span className="text-base font-normal text-zinc-500">{t.period}</span>
                </p>
                <p className="text-xs text-emerald-400 mt-1">{t.take}</p>
              </div>
              <ul className="space-y-2 text-sm text-zinc-300 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {t.href ? (
                <Link
                  href={t.href}
                  className="rounded-xl bg-zinc-100 text-black text-center py-2.5 text-sm font-semibold hover:bg-white"
                >
                  {t.cta}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={busy === t.id}
                  onClick={() => checkout(t.id)}
                  className={`rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60 ${
                    t.highlight
                      ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                      : 'bg-zinc-100 text-black hover:bg-white'
                  }`}
                >
                  {busy === t.id ? 'Redirecting…' : t.cta}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
