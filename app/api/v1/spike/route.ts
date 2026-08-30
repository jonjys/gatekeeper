import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/engine/auth';
import { insertLedger, setKilled } from '@/lib/engine/workspace';
import { slog } from '@/lib/engine/log';

export const dynamic = 'force-dynamic';

/** Demo kill: write a $10k runaway hop, arm the switch. */
export async function POST(req: NextRequest) {
  const auth = await requireWorkspace(req);
  if ('error' in auth) return auth.error;
  const blockedUsd = 10000;
  const budgetUsd = Number(auth.ws.monthly_budget_usd) || 50;
  const written = await insertLedger({
    workspace_id: auth.ws.id,
    provider: 'sim',
    model: 'spike',
    path: '/sim/10k',
    action: 'spike',
    baseline_usd: blockedUsd,
    actual_usd: blockedUsd,
    savings_usd: 0,
    fee_usd: 0,
    status: 402
  });
  await setKilled(auth.ws.id, true, '$10k spike');
  slog('spike', { workspace: auth.ws.id, blockedUsd, budgetUsd, ledger: written.via });
  return NextResponse.json({
    ok: true,
    killed: true,
    blockedUsd,
    budgetUsd,
    ledger: written.via || written.error || 'n/a',
    toast: `Blocked $${blockedUsd.toLocaleString()} runaway spend. Kill armed. GateZero fee $0 — spike is not savings.`
  });
}
