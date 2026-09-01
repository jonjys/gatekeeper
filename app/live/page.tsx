import Link from 'next/link';
import { publicStats } from '@/lib/engine/stats';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function usd(n: number) {
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export default async function LiveTicker() {
  const stats = await publicStats();
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="badge mb-6">gatezero live</p>
      <p className="text-zinc-500 text-sm uppercase tracking-[0.2em]">Proxied this booth</p>
      <p className="mt-3 font-mono text-6xl sm:text-8xl font-semibold text-emerald-400 tabular-nums">
        {stats.requests}
      </p>
      <div className="mt-10 grid grid-cols-3 gap-6 max-w-lg w-full">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Spend</p>
          <p className="font-mono text-xl mt-1">{usd(stats.actualUsd)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Saved</p>
          <p className="font-mono text-xl mt-1 text-emerald-400">{usd(stats.savingsUsd)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Take</p>
          <p className="font-mono text-xl mt-1">{usd(stats.feeUsd)}</p>
        </div>
      </div>
      <Link href="/start" className="mt-14 text-sm text-zinc-500 hover:text-emerald-400">
        Open the booth →
      </Link>
    </main>
  );
}
