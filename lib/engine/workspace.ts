import { adminDb } from '@/lib/supabase-admin';
import { hashToken } from './vault';
import type { FailMode } from './policy';

export type Workspace = {
  id: string;
  token_hash: string;
  stripe_customer_id: string | null;
  plan: string;
  fail_mode: FailMode;
  monthly_budget_usd: number;
  daily_budget_usd: number;
  killed: boolean;
  prefer_cheap: boolean;
  savings_fee_bps: number;
};

export async function loadWorkspaceByToken(token: string): Promise<Workspace | null> {
  const db = adminDb();
  if (!db) return null;
  const { data, error } = await db
    .from('workspaces')
    .select('*')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (error || !data) return null;
  return data as Workspace;
}

export async function spendWindows(workspaceId: string): Promise<{ monthly: number; daily: number }> {
  const db = adminDb();
  if (!db) return { monthly: 0, daily: 0 };
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { data } = await db
    .from('ledger_requests')
    .select('actual_usd, created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', monthStart.toISOString());
  let monthly = 0;
  let daily = 0;
  const dayIso = dayStart.toISOString();
  for (const row of data || []) {
    const usd = Number(row.actual_usd) || 0;
    monthly += usd;
    if (row.created_at >= dayIso) daily += usd;
  }
  return { monthly, daily };
}

export async function insertLedger(row: Record<string, unknown>) {
  const db = adminDb();
  if (!db) return;
  const { error } = await db.from('ledger_requests').insert(row);
  if (error && !String(error.message).includes('duplicate')) {
    console.error('ledger_insert', error.message);
  }
}

export async function loadCredential(
  workspaceId: string,
  provider: string
): Promise<{ ciphertext: string; iv: string; tag: string } | null> {
  const db = adminDb();
  if (!db) return null;
  const { data } = await db
    .from('provider_credentials')
    .select('ciphertext, iv, tag')
    .eq('workspace_id', workspaceId)
    .eq('provider', provider)
    .maybeSingle();
  return data || null;
}

export async function markKilled(workspaceId: string, reason: string) {
  const db = adminDb();
  if (!db) return;
  await db
    .from('workspaces')
    .update({ killed: true, kill_reason: reason, killed_at: new Date().toISOString() })
    .eq('id', workspaceId);
}
