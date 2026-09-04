import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/engine/auth';
import { setKilled } from '@/lib/engine/workspace';
import { slog } from '@/lib/engine/log';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireWorkspace(req);
  if ('error' in auth) return auth.error;
  let body: { action?: string; reason?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const action = (body.action || '').toLowerCase();
  if (action !== 'arm' && action !== 'disarm' && action !== 'kill') {
    return NextResponse.json({ error: 'action must be arm | disarm' }, { status: 400 });
  }
  const killed = action === 'arm' || action === 'kill';
  const reason = body.reason || (killed ? 'manual' : 'disarmed');
  const result = await setKilled(auth.ws.id, killed, reason);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'kill_failed' }, { status: 500 });
  }
  slog('kill', { workspace: auth.ws.id, killed, reason });
  return NextResponse.json({
    ok: true,
    status: killed ? 'KILLED' : 'DISARMED',
    reason
  });
}

export async function GET(req: NextRequest) {
  const auth = await requireWorkspace(req);
  if ('error' in auth) return auth.error;
  return NextResponse.json({
    service: 'gatezero-kill',
    killed: auth.ws.killed,
    failMode: auth.ws.fail_mode,
    monthlyBudgetUsd: auth.ws.monthly_budget_usd,
    dailyBudgetUsd: auth.ws.daily_budget_usd
  });
}
