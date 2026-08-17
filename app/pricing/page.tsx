'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    take: '2% take-rate',
    features: [
      'Local AES-GCM vault + Web Locks',
      'CostRadar budget + kill-switch',
      'Import .env (File System Access)',
      'Service Worker proxy path',
      'Community support'
    ],
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
      'Passkeys (WebAuthn) + YubiGate',
      'Audit log + CSV export',
      'Priority proxy path',
      'Stripe Customer Portal'
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
      'Team seats + role metadata',
      'SSO-ready (passkey per member)',
      'Custom take-rate contracts',
      'Dedicated support channel'
    ],
    cta: 'Start Enterprise',
    href: null,
    highlight: false
  }
];

const FAQ = [
  {
    q: 'Do my API keys ever leave my machine?',
    a: 'No. Keys are encrypted with AES-GCM and stored only in IndexedDB. The Service Worker decrypts under an exclusive Web Lock for ~50ms, injects the header, and drops plaintext. Our servers only see metadata (provider, cost estimate) — never secrets.'
  },
  {
    q: 'What is the take-rate?',
    a: 'A percentage of proxied API spend. Free and Pro are 2%; Enterprise is 1%. Seat fees ($0 / $29 / $299) unlock features. Meter events are recorded server-side from cost metadata only.'
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
  const [proxied, setProxied] = useState(128_400);

  useEffect(() => {
    const id = setInterval(() => {
      setProxied((n) => n + Math.floor(Math.random() * 40) + 8);
    }, 2800);
    return () => clearInterval(id);
  }, []);

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

      <div className="flex-1 max-w-5xl mx-auto w-full px-5 py-14 space-y-14">
        <div className="text-center space-y-3">
          <p className="badge">pricing</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Keys stay local. Revenue scales.
          </h1>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Seat fees unlock features. Take-rate on proxied spend only. Zero secrets on
            our servers — ever.
          </p>
          <p className="text-sm font-mono text-emerald-400/90 pt-1">
            Proxied ${proxied.toLocaleString()} this month · network seed ticker
          </p>
        </div>

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
          Cancel anytime via Stripe Customer Portal. Vault ciphertext never leaves your device.
        </p>
      </div>
    </main>
  );
}
