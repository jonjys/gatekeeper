'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';

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
      '20% of verified savings tracked on the ledger (billed after you add a card)'
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
      'Metered savings fee via Stripe (20% of verified savings)',
      'Priority GET retries',
      'Workspace kill + ledger'
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
      'Fail-open option',
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
    a: 'Yes, for the money path. They are stored AES-256-GCM at rest and decrypted in memory per upstream hop. That is required for a real proxy. Use a restricted key with a spend cap — not your master secret. Burn it anytime.'
  },
  {
    q: 'What do you charge?',
    a: 'Seat fees ($0 / $29 / $299) plus a success fee: 20% of verified savings (15% Enterprise), metered on Stripe after Checkout. Free tracks the fee on the ledger but cannot collect it until you have a Stripe customer. If we do not reduce cost versus the requested model, the fee is $0. Failed hops are not billed.'
  },
  {
    q: 'What happens when the budget is hit?',
    a: 'The spend router fail-closes: hops return 402 PAYMENT REQUIRED and the kill switch stays armed until you disarm. Daily caps return 429. Honeypot keys return 451 and are never forwarded. That is /api/proxy — not the demo Service Worker.'
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Pro and Enterprise use Stripe subscriptions. After Checkout, Billing on /start opens the Stripe Customer Portal. Encrypted provider keys stay in the server vault until you burn them.'
  },
  {
    q: 'Which endpoint do I point at?',
    a: 'https://getgatezero.com/api/proxy/openai/v1/chat/completions with header x-gz-key: gz_live_…. Anthropic: /api/proxy/anthropic/v1/messages. Use the apex domain — do not POST /api/* through a www redirect or clients drop the body. /api/gate is a leftover demo, not the spend router.'
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('gz_token') || '' : '';
      if (!token.startsWith('gz_')) {
        window.location.href = `/start?upgrade=${encodeURIComponent(plan)}`;
        return;
      }
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-gz-key': token },
        body: JSON.stringify({ plan })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.hint || data.detail || data.error || 'Checkout failed');
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
        <nav className="flex items-center gap-4">
          <Link href="/start" className="text-sm text-zinc-400 hover:text-emerald-400">
            Start
          </Link>
          <Link href="/contact" className="text-sm text-zinc-400 hover:text-emerald-400">
            Contact
          </Link>
        </nav>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-5 py-14 space-y-14">
        <div className="text-center space-y-3">
          <p className="badge">pricing</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Pay us only when we save you money.
          </h1>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Seat $0 / $29 / $299. Success fee only if we actually cut the bill — billed on Pro /
            Enterprise after Checkout.
          </p>
          <p className="text-sm font-mono text-emerald-400/90 pt-1">
            Proxied {proxied.toLocaleString()} hops on this booth · live ledger
          </p>
        </div>

        {fromBilling && (
          <p className="text-center text-sm text-emerald-400 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            Billing needs an active plan first — create a workspace on /start if you have not, then
            pick Pro or Enterprise. After Checkout, Billing opens the Stripe portal.
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
      <SiteFooter />
    </main>
  );
}
