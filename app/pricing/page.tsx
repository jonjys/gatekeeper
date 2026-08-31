'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    take: '20% of verified savings',
    features: [
      'Spend router + ledger',
      'Fail-closed kill + daily/monthly caps',
      'Cheaper-model routing',
      'Encrypted provider vault',
      '20% of verified savings (0 if 0)'
    ],
    cta: 'Start free',
    href: '/start',
    highlight: false
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    period: '/mo',
    take: '20% of verified savings',
    features: [
      'Everything in Free',
      'Stripe Customer Portal',
      'Metered savings fee via Stripe',
      'Priority retries',
      'Passkey unlock for local vault'
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
    take: '15% of verified savings',
    features: [
      'Everything in Pro',
      '15% savings fee',
      'Custom fail-open contracts',
      'Team seats',
      'Dedicated support'
    ],
    cta: 'Start Enterprise',
    href: null,
    highlight: false
  }
];

const FAQ = [
  {
    q: 'Do provider keys sit on your servers?',
    a: 'Yes, for the money path. They are stored AES-256-GCM at rest and decrypted in memory per upstream hop. Optional browser Service Worker mode still keeps a second vault on-device. We do not claim the proxy is keyless.'
  },
  {
    q: 'What do you charge?',
    a: 'Seat fees ($0 / $29 / $299) plus a success fee: 20% of verified savings (15% Enterprise). If we do not reduce cost versus the requested model, the fee is $0.'
  },
  {
    q: 'Which browsers work?',
    a: 'Chrome and Edge (Chromium) for File System Access, Web Locks, WebUSB (YubiGate), and best Passkey support. Safari/Firefox get core vault + proxy where APIs exist; some moats degrade gracefully.'
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Pro and Enterprise use Stripe subscriptions. Use the Customer Portal (Dashboard) to update payment method or cancel. Vault data stays on your device regardless of plan.'
  },
  {
    q: 'What happens when CostRadar budget is hit?',
    a: 'A local kill-switch arms. The Service Worker returns 503 for /api/gate/* until you raise the budget or disarm. No remote kill required — the block is on-device.'
  }
];

export default function PricingPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [proxied, setProxied] = useState(0);
  const [fromBilling, setFromBilling] = useState(false);

  useEffect(() => {
    let cancel = false;
    async function pull() {
      try {
        const r = await fetch('/api/stats');
        if (!r.ok) return;
        const d = (await r.json()) as { requests?: number };
        if (!cancel && typeof d.requests === 'number') setProxied(d.requests);
      } catch {
        /* ignore */
      }
    }
    void pull();
    const id = window.setInterval(pull, 5000);
    return () => {
      cancel = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    if (q.get('billing') === '1' || q.get('checkout') === 'cancel') {
      setFromBilling(true);
    }
  }, []);

  async function checkout(plan: string) {
    setBusy(plan);
    setError(null);
    try {
      const workspaceId =
        typeof window !== 'undefined' ? localStorage.getItem('gz_workspace') || '' : '';
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, workspaceId })
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
        <Link href="/" className="font-semibold">
          Gate<span className="text-emerald-400">Zero</span>
        </Link>
        <Link href="/start" className="text-sm text-zinc-400 hover:text-emerald-400">
          Start
        </Link>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-5 py-14 space-y-14">
        <div className="text-center space-y-3">
          <p className="badge">pricing</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Pay us only when we save you money.
          </h1>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Seat fees unlock the portal. Success fee is 20% of verified savings. Zero if we save nothing.
          </p>
          <p className="text-sm font-mono text-emerald-400/90 pt-1">
            Proxied {proxied.toLocaleString()} hops on this booth · live ledger
          </p>
        </div>

        {fromBilling && (
          <p className="text-center text-sm text-emerald-400 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            Billing needs an active plan first — pick Pro or Enterprise below. After Checkout,
            Billing opens the Stripe portal.
          </p>
        )}

        {error && (
          <p className="text-center text-sm text-red-400">
            {error} — set STRIPE_SECRET_KEY / STRIPE_PRICE_* for live Checkout.
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
                    <span className="text-emerald-400 shrink-0">✓</span>
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

        <section className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-center text-lg font-semibold">FAQ</h2>
          <div className="space-y-2">
            {FAQ.map((item, i) => (
              <div
                key={item.q}
                className="rounded-xl border border-zinc-800 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 text-sm font-medium hover:bg-zinc-900/50"
                >
                  <span>{item.q}</span>
                  <span className="text-zinc-500 shrink-0">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && (
                  <p className="px-4 pb-4 text-sm text-zinc-400 leading-relaxed">{item.a}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        <p className="text-center text-xs text-zinc-500">
          Cancel anytime via Stripe Customer Portal. Provider keys in the server vault stay encrypted at rest.
        </p>
      </div>
    </main>
  );
}
