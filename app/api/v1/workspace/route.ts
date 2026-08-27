import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase-admin';
import { hashToken, mintWorkspaceToken } from '@/lib/engine/vault';
import { SAVINGS_FEE_BPS } from '@/lib/engine/prices';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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
