import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { publicStats } from '@/lib/engine/stats';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

function usd(n: number) {
  if (!n) return '$0';
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

export default async function GateZeroGatePage() {
  const stats = await publicStats();
  const rows = stats.byProvider.length
    ? stats.byProvider
    : [
        {
          provider: 'openai',
          requests: 0,
          actualUsd: 0,
          baselineUsd: 0,
          savingsUsd: 0,
          feeUsd: 0
        }
      ];

  return (
    <main className="min-h-screen flex flex-col">
      <SiteHeader current="/gate" />

      <div className="max-w-3xl mx-auto w-full px-5 py-14 space-y-10">
        <div className="space-y-3">
          <p className="badge">gatezero index</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">We see the prices. We take 20% of the cut.</h1>
          <p className="text-zinc-400 max-w-xl leading-relaxed">
            Anonymized aggregates from proxied hops. No bodies, no keys — cost, savings, and fee
            only. This is the data moat, not a mock table.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['hops', String(stats.requests)],
            ['baseline', usd(stats.baselineUsd)],
            ['actual', usd(stats.actualUsd)],
            ['saved', usd(stats.savingsUsd)]
          ].map(([k, v]) => (
            <div key={k} className="card py-4 text-center">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">{k}</p>
              <p className="mt-1 font-mono text-emerald-300">{v}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-zinc-800 overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[520px]">
            <thead className="bg-zinc-900 text-zinc-500 text-xs">
              <tr>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Hops</th>
                <th className="px-4 py-3 font-medium">If requested</th>
                <th className="px-4 py-3 font-medium">Via GateZero</th>
                <th className="px-4 py-3 font-medium">Saved</th>
                <th className="px-4 py-3 font-medium">Take</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.provider} className="bg-zinc-950/40">
                  <td className="px-4 py-3 font-medium capitalize">{r.provider}</td>
                  <td className="px-4 py-3 font-mono">{r.requests}</td>
                  <td className="px-4 py-3 font-mono text-zinc-500">{usd(r.baselineUsd)}</td>
                  <td className="px-4 py-3 font-mono text-emerald-400">{usd(r.actualUsd)}</td>
                  <td className="px-4 py-3 font-mono text-emerald-400">{usd(r.savingsUsd)}</td>
                  <td className="px-4 py-3 font-mono">{usd(r.feeUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-zinc-500">
          Fee is 20% of verified savings. Zero savings → zero take. Last hop{' '}
          {stats.lastAt ? new Date(stats.lastAt).toISOString() : '—'}.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/start"
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 min-h-11 inline-flex items-center"
          >
            Prove it
          </Link>
          <Link
            href="/live"
            className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm hover:border-emerald-500/40 min-h-11 inline-flex items-center"
          >
            Full-screen ticker
          </Link>
        </div>
      </div>
    </main>
  );
}
