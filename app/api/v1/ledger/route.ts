import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/engine/auth';
import { ledgerTotals, listLedger, spendWindows } from '@/lib/engine/workspace';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireWorkspace(req);
  if ('error' in auth) return auth.error;
  const [rows, totals, spend] = await Promise.all([
    listLedger(auth.ws.id, 80),
    ledgerTotals(auth.ws.id),
    spendWindows(auth.ws.id)
  ]);
  return NextResponse.json({
    workspaceId: auth.ws.id,
    killed: auth.ws.killed,
    plan: auth.ws.plan,
    failMode: auth.ws.fail_mode,
    preferCheap: auth.ws.prefer_cheap,
    savingsFeeBps: auth.ws.savings_fee_bps,
    spend,
    totals,
    rows
  });
}
