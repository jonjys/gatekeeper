import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { publicStats } from '@/lib/engine/stats';

export const dynamic = 'force-dynamic';

function usd(n: number) {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

export default async function Landing() {
  const stats = await publicStats();
  const live = stats.requests > 0;

  return (
    <main className="min-h-screen flex flex-col">
      <SiteHeader current="/" />

      <div className="flex-1 max-w-3xl mx-auto w-full px-5 py-14 space-y-12">
        <section className="space-y-5">
          <p className="badge">{live ? 'live ledger' : 'API spend router'}</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.12]">
            Toll booth for API traffic.
            <span className="block text-emerald-400 mt-2">Ask gpt-4o. Pay for mini.</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl leading-relaxed">
            One base URL. Cheaper route when you allow it. Kill when spend runs.
            No save → no fee.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/start"
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-black hover:bg-emerald-400 min-h-11 inline-flex items-center"
            >
              Open the booth
            </Link>
            <Link
              href="/gate"
              className="rounded-xl border border-zinc-700 px-6 py-3 text-sm hover:border-emerald-500/40 min-h-11 inline-flex items-center"
            >
              Live index
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['proxied', String(stats.requests)],
            ['spend', usd(stats.actualUsd)],
            ['saved', usd(stats.savingsUsd)],
            ['take', usd(stats.feeUsd)]
          ].map(([k, v]) => (
            <div key={k} className="card py-4 text-center">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">{k}</p>
              <p className="mt-1 font-mono text-lg text-emerald-300">{v}</p>
            </div>
          ))}
        </section>

        <section className="grid sm:grid-cols-3 gap-3">
          <div className="card space-y-2">
            <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">Policy</p>
            <p className="font-medium">Kill, budget, trap</p>
            <p className="text-sm text-zinc-500">402 on cap. 451 on honeypot keys. Fail-closed by default.</p>
          </div>
          <div className="card space-y-2">
            <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">Route</p>
            <p className="font-medium">Cheaper alias</p>
            <p className="text-sm text-zinc-500">gpt-4o → gpt-4o-mini when you opt in. Prices are a table.</p>
          </div>
          <div className="card space-y-2">
            <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">Ledger</p>
            <p className="font-medium">Cost · saving · fee</p>
            <p className="text-sm text-zinc-500">Every hop is written. Stripe meters only verified savings.</p>
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold">One line change</h2>
          <pre className="text-xs sm:text-sm bg-black/50 rounded-xl p-4 overflow-x-auto text-emerald-300/90 leading-relaxed">{`https://getgatezero.com/api/proxy/openai/v1/chat/completions
Header: x-gz-key: gz_live_…`}</pre>
        </section>

        <section className="card space-y-3 border-zinc-700">
          <p className="badge">honest secrets</p>
          <h2 className="text-lg font-semibold">Server proxy holds encrypted provider keys.</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            The money path decrypts AES-256-GCM credentials in memory for the upstream hop.
            That is required for a real proxy. We do not pretend the server path is keyless.
            Use a restricted OpenAI key with a spend cap — not your master secret.
          </p>
          <p className="text-xs text-zinc-500">
            Code:{' '}
            <a className="text-emerald-400 hover:underline" href="https://github.com/jonjys/gatekeeper">
              github.com/jonjys/gatekeeper
            </a>
          </p>
        </section>
      </div>

      <footer className="border-t border-zinc-800/80 px-5 py-5 text-center text-xs text-zinc-500">
        GateZero · no save → no fee · getgatezero.com
      </footer>
    </main>
  );
}
