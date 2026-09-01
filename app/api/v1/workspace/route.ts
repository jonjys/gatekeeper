import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase-admin';
import { hashToken, mintWorkspaceToken } from '@/lib/engine/vault';
import { SAVINGS_FEE_BPS } from '@/lib/engine/prices';
import { rateLimit } from '@/lib/engine/ratelimit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (!rateLimit(`ws:${ip}`, 8, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const db = adminDb();
  if (!db) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY required' }, { status: 503 });
  }
  let body: { name?: string; monthlyBudgetUsd?: number; dailyBudgetUsd?: number; preferCheap?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const token = mintWorkspaceToken();
  const { data, error } = await db
    .from('workspaces')
    .insert({
      name: body.name || 'default',
      token_hash: hashToken(token),
      monthly_budget_usd: Number(body.monthlyBudgetUsd) || 50,
      daily_budget_usd: Number(body.dailyBudgetUsd) || 10,
      prefer_cheap: body.preferCheap !== false,
      savings_fee_bps: SAVINGS_FEE_BPS,
      fail_mode: 'closed'
    })
    .select('id')
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'insert_failed' }, { status: 500 });
  }
  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  return NextResponse.json({
    workspaceId: data.id,
    token,
    note: 'Store token once. It is not shown again.',
    proxy: `${origin}/api/proxy/openai/v1/chat/completions`,
    snippet: `fetch('${origin}/api/proxy/openai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-gz-key': '${token}'
  },
  body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] })
})`
  });
}


export async function GET(req: NextRequest) {
  const token = req.headers.get('x-gz-key') || '';
  const db = adminDb();
  if (!db) return NextResponse.json({ error: 'db_unavailable' }, { status: 503 });
  if (!token.startsWith('gz_')) {
    return NextResponse.json({ error: 'x-gz-key required' }, { status: 401 });
  }
  const { data } = await db
    .from('workspaces')
    .select('id, name, plan, fail_mode, monthly_budget_usd, daily_budget_usd, killed, prefer_cheap, savings_fee_bps, stripe_customer_id, created_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (!data) return NextResponse.json({ error: 'unknown_workspace' }, { status: 401 });
  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  return NextResponse.json({
    ...data,
    proxyBase: `${origin}/api/proxy`,
    snippet: `fetch('${origin}/api/proxy/openai/v1/chat/completions', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-gz-key': 'YOUR_TOKEN' },
  body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] })
})`
  });
}

export async function PATCH(req: NextRequest) {
  const token = req.headers.get('x-gz-key') || '';
  const db = adminDb();
  if (!db) return NextResponse.json({ error: 'db_unavailable' }, { status: 503 });
  if (!token.startsWith('gz_')) {
    return NextResponse.json({ error: 'x-gz-key required' }, { status: 401 });
  }
  const { data: ws } = await db.from('workspaces').select('id').eq('token_hash', hashToken(token)).maybeSingle();
  if (!ws) return NextResponse.json({ error: 'unknown_workspace' }, { status: 401 });
  let body: {
    monthlyBudgetUsd?: number;
    dailyBudgetUsd?: number;
    preferCheap?: boolean;
    failMode?: 'closed' | 'open';
  } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const patch: Record<string, unknown> = {};
  if (typeof body.monthlyBudgetUsd === 'number') patch.monthly_budget_usd = body.monthlyBudgetUsd;
  if (typeof body.dailyBudgetUsd === 'number') patch.daily_budget_usd = body.dailyBudgetUsd;
  if (typeof body.preferCheap === 'boolean') patch.prefer_cheap = body.preferCheap;
  if (body.failMode === 'closed' || body.failMode === 'open') patch.fail_mode = body.failMode;
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  const { error } = await db.from('workspaces').update(patch).eq('id', ws.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, patch });
}
