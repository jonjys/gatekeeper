import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function Landing() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-800/80 px-5 sm:px-8 py-4 flex items-center justify-between">
        <span className="font-semibold tracking-tight">
          Gate<span className="text-emerald-400">Zero</span>
        </span>
        <nav className="flex items-center gap-4 text-sm text-zinc-400">
          <Link href="/start" className="hover:text-emerald-400">
            Start
          </Link>
          <Link href="/pricing" className="hover:text-emerald-400">
            Pricing
          </Link>
          <Link href="/dashboard" className="hover:text-emerald-400">
            Ledger
          </Link>
        </nav>
      </header>

      <div className="flex-1 max-w-3xl mx-auto w-full px-5 py-16 space-y-14">
        <section className="space-y-5">
          <p className="badge">API spend router</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.12]">
            Toll booth for API traffic.
            <span className="block text-emerald-400 mt-2">We take 20% of what we save.</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl leading-relaxed">
            Point one base URL at GateZero. Every request is identified, budget-checked,
            routed to a cheaper compatible model when you allow it, measured, and billed.
            No savings → no success fee.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/start"
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-black hover:bg-emerald-400"
            >
              Connect once
            </Link>
            <Link
              href="/pricing"
              className="rounded-xl border border-zinc-700 px-6 py-3 text-sm hover:border-emerald-500/40"
            >
              Plans
            </Link>
          </div>
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
            <p className="text-sm text-zinc-500">gpt-4o → gpt-4o-mini when you opt in. Prices are a table, not a model guess.</p>
          </div>
          <div className="card space-y-2">
            <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">Ledger</p>
            <p className="font-medium">Cost · saving · fee</p>
            <p className="text-sm text-zinc-500">Stripe meters only verified savings cents. Zero if we saved nothing.</p>
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold">One line change</h2>
          <pre className="text-xs sm:text-sm bg-black/50 rounded-xl p-4 overflow-x-auto text-emerald-300/90 leading-relaxed">{`// before
https://api.openai.com/v1/chat/completions

// after
https://gatekeeper-beta-three.vercel.app/api/proxy/openai/v1/chat/completions
Header: x-gz-key: gz_live_…`}</pre>
        </section>

        <section className="card space-y-3 border-zinc-700">
          <p className="badge">honest secrets</p>
          <h2 className="text-lg font-semibold">Server proxy holds encrypted provider keys.</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            The money path decrypts AES-256-GCM credentials in memory for the upstream hop.
            That is required for a real proxy. Optional browser Service Worker still keeps a
            second vault on-device — we do not pretend the server path is keyless.
          </p>
        </section>
      </div>

      <footer className="border-t border-zinc-800/80 px-5 py-5 text-center text-xs text-zinc-500">
        GateZero · BridgeControl engine · 20% of verified savings
      </footer>
    </main>
  );
}
