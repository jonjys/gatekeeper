import Link from 'next/link';

/**
 * GateZero Index — public anonymized traffic moat.
 * Server component (no client APIs) to avoid Next prerender clientModules bugs.
 */
const ROWS = [
  {
    provider: 'OpenAI',
    latencyGz: 812,
    latencyDirect: 1400,
    costGz: 0.0021,
    costDirect: 0.0031
  },
  {
    provider: 'Anthropic',
    latencyGz: 940,
    latencyDirect: 1580,
    costGz: 0.0042,
    costDirect: 0.0055
  },
  {
    provider: 'Stripe',
    latencyGz: 210,
    latencyDirect: 280,
    costGz: 0.0004,
    costDirect: 0.0004
  }
];

export default function GateZeroIndexPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-800 px-5 py-4 flex items-center justify-between">
        <Link href="/" className="font-semibold">
          Gate<span className="text-emerald-400">Zero</span>
        </Link>
        <Link href="/pricing" className="text-sm text-zinc-400 hover:text-emerald-400">
          Pricing
        </Link>
      </header>

      <div className="max-w-3xl mx-auto w-full px-5 py-14 space-y-10">
        <div className="space-y-3 text-center sm:text-left">
          <p className="badge">gatezero index</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            API traffic&apos;s toll booth.
          </h1>
          <p className="text-zinc-400 max-w-xl">
            Anonymized aggregates from proxied calls. We see prices, latency, and leak patterns —
            so you don&apos;t burn the budget. 2% to not die.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-500 text-xs">
              <tr>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Latency via GZ</th>
                <th className="px-4 py-3 font-medium">Direct</th>
                <th className="px-4 py-3 font-medium">Cost via GZ</th>
                <th className="px-4 py-3 font-medium">Direct</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {ROWS.map((r) => (
                <tr key={r.provider} className="bg-zinc-950/40">
                  <td className="px-4 py-3 font-medium">{r.provider}</td>
                  <td className="px-4 py-3 font-mono text-emerald-400">{r.latencyGz}ms</td>
                  <td className="px-4 py-3 font-mono text-zinc-500">{r.latencyDirect}ms</td>
                  <td className="px-4 py-3 font-mono text-emerald-400">
                    ${r.costGz.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-500">
                    ${r.costDirect.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-zinc-500">
          Figures are illustrative seed data until network-effect telemetry is live. No request
          bodies or secrets are ever indexed — only latency/cost metadata.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Start free
          </Link>
          <Link
            href="/pricing"
            className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm hover:border-emerald-500/40"
          >
            View pricing
          </Link>
        </div>
      </div>
    </main>
  );
}
