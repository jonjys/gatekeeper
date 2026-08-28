import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/engine/auth';
import { listLedger, probeLedgerWrite, summarizeLedger } from '@/lib/engine/workspace';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireWorkspace(req);
  if ('error' in auth) return auth.error;
  if (req.nextUrl.searchParams.get('probe') === '1') {
    const probe = await probeLedgerWrite(auth.ws.id);
    return NextResponse.json({ probe, workspaceId: auth.ws.id });
  }
  const rows = await listLedger(auth.ws.id, 80);
  const { totals, spend } = summarizeLedger(rows);
  return NextResponse.json({
    workspaceId: auth.ws.id,
    killed: auth.ws.killed,
    plan: auth.ws.plan,
    failMode: auth.ws.fail_mode,
    preferCheap: auth.ws.prefer_cheap,
    savingsFeeBps: auth.ws.savings_fee_bps,
    monthlyBudgetUsd: auth.ws.monthly_budget_usd,
    dailyBudgetUsd: auth.ws.daily_budget_usd,
    spend,
    totals,
    rows
  });
}
