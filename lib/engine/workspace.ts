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


export async function setKilled(workspaceId: string, killed: boolean, reason: string) {
  const db = adminDb();
  if (!db) return;
  await db
    .from('workspaces')
    .update({
      killed,
      kill_reason: killed ? reason : null,
      killed_at: killed ? new Date().toISOString() : null
    })
    .eq('id', workspaceId);
}

export async function updateWorkspace(
  workspaceId: string,
  patch: Partial<{
    monthly_budget_usd: number;
    daily_budget_usd: number;
    prefer_cheap: boolean;
    fail_mode: FailMode;
    stripe_customer_id: string;
    plan: string;
  }>
) {
  const db = adminDb();
  if (!db) return;
  await db.from('workspaces').update(patch).eq('id', workspaceId);
}

export async function listLedger(workspaceId: string, limit = 50) {
  const db = adminDb();
  if (!db) return [];
  const { data } = await db
    .from('ledger_requests')
    .select('id, provider, model, path, action, baseline_usd, actual_usd, savings_usd, fee_usd, status, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function ledgerTotals(workspaceId: string) {
  const db = adminDb();
  if (!db) return { requests: 0, actual: 0, savings: 0, fee: 0 };
  const { data } = await db
    .from('ledger_requests')
    .select('actual_usd, savings_usd, fee_usd')
    .eq('workspace_id', workspaceId);
  let requests = 0;
  let actual = 0;
  let savings = 0;
  let fee = 0;
  for (const row of data || []) {
    requests += 1;
    actual += Number(row.actual_usd) || 0;
    savings += Number(row.savings_usd) || 0;
    fee += Number(row.fee_usd) || 0;
  }
  return { requests, actual, savings, fee };
}

export async function loadTrapHashes(workspaceId: string): Promise<string[]> {
  const db = adminDb();
  if (!db) return [];
  const { data } = await db.from('trap_keys').select('secret_hash').eq('workspace_id', workspaceId);
  return (data || []).map((r: { secret_hash: string }) => r.secret_hash);
}

export async function insertTrap(workspaceId: string, secretHash: string, label: string) {
  const db = adminDb();
  if (!db) return { error: 'db_unavailable' };
  const { error } = await db.from('trap_keys').upsert(
    { workspace_id: workspaceId, secret_hash: secretHash, label },
    { onConflict: 'workspace_id,secret_hash' }
  );
  return { error: error?.message };
}

export async function burnCredential(workspaceId: string, provider: string) {
  const db = adminDb();
  if (!db) return;
  await db.from('provider_credentials').delete().eq('workspace_id', workspaceId).eq('provider', provider);
}

export async function listCredentials(workspaceId: string) {
  const db = adminDb();
  if (!db) return [];
  const { data } = await db
    .from('provider_credentials')
    .select('provider, masked, created_at')
    .eq('workspace_id', workspaceId);
  return data || [];
}
