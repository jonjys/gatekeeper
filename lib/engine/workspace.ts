import { adminDb } from '@/lib/supabase-admin';
import { hashToken } from './vault';
import { isUniqueViolation, truncateForCache } from './proxy-utils';
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

export type LedgerWrite = {
  workspace_id: string;
  idempotency_key?: string | null;
  provider: string;
  model?: string | null;
  path?: string | null;
  action: string;
  baseline_usd: number;
  actual_usd: number;
  savings_usd: number;
  fee_usd: number;
  status?: number | null;
};

export type LedgerRow = {
  id: string;
  provider: string;
  model: string | null;
  path: string | null;
  action: string;
  baseline_usd: number;
  actual_usd: number;
  savings_usd: number;
  fee_usd: number;
  status: number | null;
  created_at: string;
};

const LEDGER_SELECT =
  'id, provider, model, path, action, baseline_usd, actual_usd, savings_usd, fee_usd, status, created_at';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

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

export function summarizeLedger(rows: LedgerRow[]) {
  let requests = 0;
  let actual = 0;
  let savings = 0;
  let fee = 0;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const monthIso = monthStart.toISOString();
  const dayIso = dayStart.toISOString();
  let monthly = 0;
  let daily = 0;
  for (const row of rows) {
    if (row.action === 'probe' || row.action === 'spike') continue;
    if (String(row.provider || '').toLowerCase() === 'sim') continue;
    requests += 1;
    const usd = Number(row.actual_usd) || 0;
    actual += usd;
    savings += Number(row.savings_usd) || 0;
    fee += Number(row.fee_usd) || 0;
    if (row.created_at >= monthIso) monthly += usd;
    if (row.created_at >= dayIso) daily += usd;
  }
  return { totals: { requests, actual, savings, fee }, spend: { monthly, daily } };
}

export async function spendWindows(workspaceId: string): Promise<{ monthly: number; daily: number }> {
  const db = adminDb();
  if (!db) return { monthly: 0, daily: 0 };

  const rpc = await db.rpc('workspace_spend_windows', { p_workspace: workspaceId });
  if (!rpc.error && rpc.data != null) {
    const row = (Array.isArray(rpc.data) ? rpc.data[0] : rpc.data) as { monthly?: number; daily?: number } | null;
    if (row && typeof row === 'object') {
      return {
        monthly: Number(row.monthly) || 0,
        daily: Number(row.daily) || 0
      };
    }
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { data, error } = await db
    .from('ledger_requests')
    .select('id, provider, model, path, action, baseline_usd, actual_usd, savings_usd, fee_usd, status, created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', monthStart.toISOString())
    .limit(10_000);
  if (error || !data) {
    return summarizeLedger(await listLedger(workspaceId, 500)).spend;
  }
  return summarizeLedger(data as LedgerRow[]).spend;
}

export function buildLedgerPayload(row: LedgerWrite) {
  return {
    id: crypto.randomUUID(),
    workspace_id: row.workspace_id,
    idempotency_key: row.idempotency_key || `auto_${crypto.randomUUID()}`,
    provider: String(row.provider || 'unknown'),
    model: row.model ?? null,
    path: row.path ?? null,
    action: String(row.action || 'passthrough'),
    baseline_usd: Number(row.baseline_usd) || 0,
    actual_usd: Number(row.actual_usd) || 0,
    savings_usd: Number(row.savings_usd) || 0,
    fee_usd: Number(row.fee_usd) || 0,
    status: row.status == null ? null : Number(row.status)
  };
}

export async function insertLedger(
  row: LedgerWrite
): Promise<{ ok: boolean; id?: string; error?: string; via?: string }> {
  const db = adminDb();
  if (!db) return { ok: false, error: 'db_unavailable' };
  const payload = buildLedgerPayload(row);
  const { data, error } = await db.from('ledger_requests').insert(payload).select('id').maybeSingle();
  if (!error) return { ok: true, id: data?.id, via: 'ledger_requests' };

  if (isUniqueViolation(error) && payload.idempotency_key && !payload.idempotency_key.startsWith('auto_')) {
    const existing = await db
      .from('ledger_requests')
      .select('id')
      .eq('workspace_id', payload.workspace_id)
      .eq('idempotency_key', payload.idempotency_key)
      .maybeSingle();
    return { ok: true, id: existing.data?.id, via: 'idempotent' };
  }

  console.error('ledger_insert', error.message, error.code, error.details, error.hint);

  const fallback = {
    stripe_event_id: `gz:${payload.id}`,
    stripe_customer_id: row.workspace_id,
    amount_cents: Math.max(0, Math.round((Number(row.actual_usd) || 0) * 100)),
    kind: JSON.stringify({
      t: 'proxy',
      provider: row.provider,
      model: row.model ?? null,
      path: row.path ?? null,
      action: row.action,
      baseline_usd: Number(row.baseline_usd) || 0,
      actual_usd: Number(row.actual_usd) || 0,
      savings_usd: Number(row.savings_usd) || 0,
      fee_usd: Number(row.fee_usd) || 0,
      status: row.status ?? null
    })
  };
  const fb = await db.from('billing_ledger').insert(fallback).select('id').maybeSingle();
  if (fb.error) {
    console.error('ledger_fallback', fb.error.message, fb.error.code);
    return { ok: false, error: `${error.message} | fallback: ${fb.error.message}` };
  }
  return { ok: true, id: fb.data?.id, via: 'billing_ledger', error: error.message };
}

function mapBillingFallback(
  row: { id: string; stripe_event_id?: string; kind?: string; created_at?: string; amount_cents?: number }
): LedgerRow | null {
  if (!row.stripe_event_id?.startsWith('gz:')) return null;
  try {
    const k = JSON.parse(row.kind || '{}') as Record<string, unknown>;
    if (k.t !== 'proxy') return null;
    return {
      id: row.id,
      provider: String(k.provider || 'unknown'),
      model: (k.model as string) || null,
      path: (k.path as string) || null,
      action: String(k.action || 'passthrough'),
      baseline_usd: Number(k.baseline_usd) || 0,
      actual_usd: Number(k.actual_usd) || 0,
      savings_usd: Number(k.savings_usd) || 0,
      fee_usd: Number(k.fee_usd) || 0,
      status: k.status == null ? null : Number(k.status),
      created_at: row.created_at || new Date().toISOString()
    };
  } catch {
    return null;
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
  return setKilled(workspaceId, true, reason);
}

export async function setKilled(
  workspaceId: string,
  killed: boolean,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  const db = adminDb();
  if (!db) return { ok: false, error: 'db_unavailable' };
  const { error } = await db
    .from('workspaces')
    .update({
      killed,
      kill_reason: killed ? reason : null,
      killed_at: killed ? new Date().toISOString() : null
    })
    .eq('id', workspaceId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
    savings_fee_bps: number;
  }>
) {
  const db = adminDb();
  if (!db) return;
  await db.from('workspaces').update(patch).eq('id', workspaceId);
}

export async function listLedger(workspaceId: string, limit = 80): Promise<LedgerRow[]> {
  const db = adminDb();
  if (!db) return [];
  const { data, error } = await db
    .from('ledger_requests')
    .select(LEDGER_SELECT)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) console.error('listLedger', error.message, error.code, error.details);
  const primary = (!error && data ? data : []) as LedgerRow[];
  if (primary.length) return primary.map((r) => ({ ...r, path: r.path ?? null }));

  const fb = await db
    .from('billing_ledger')
    .select('id, stripe_event_id, kind, created_at, amount_cents')
    .eq('stripe_customer_id', workspaceId)
    .like('stripe_event_id', 'gz:%')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (fb.data || []).map(mapBillingFallback).filter((r): r is LedgerRow => Boolean(r));
}

export async function ledgerTotals(workspaceId: string) {
  return summarizeLedger(await listLedger(workspaceId, 500)).totals;
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

export async function probeLedgerWrite(workspaceId: string) {
  return insertLedger({
    workspace_id: workspaceId,
    provider: 'probe',
    model: null,
    path: 'probe',
    action: 'probe',
    baseline_usd: 0,
    actual_usd: 0,
    savings_usd: 0,
    fee_usd: 0,
    status: 204
  });
}

export type IdempotencyHit = { status: number; body: string; contentType: string };

export async function loadIdempotency(
  workspaceId: string,
  key: string
): Promise<IdempotencyHit | null> {
  const db = adminDb();
  if (!db || !key) return null;
  const { data, error } = await db
    .from('idempotency_cache')
    .select('status, body, content_type, created_at')
    .eq('workspace_id', workspaceId)
    .eq('idempotency_key', key)
    .maybeSingle();
  if (error || !data) return null;
  const age = Date.now() - new Date(String(data.created_at)).getTime();
  if (Number.isFinite(age) && age > IDEMPOTENCY_TTL_MS) return null;
  return {
    status: Number(data.status),
    body: String(data.body || ''),
    contentType: String(data.content_type || 'application/json')
  };
}

export async function saveIdempotency(
  workspaceId: string,
  key: string,
  status: number,
  body: string,
  contentType = 'application/json'
): Promise<void> {
  const db = adminDb();
  if (!db || !key) return;
  await db.from('idempotency_cache').upsert(
    {
      workspace_id: workspaceId,
      idempotency_key: key,
      status,
      body: truncateForCache(body),
      content_type: contentType,
      created_at: new Date().toISOString()
    },
    { onConflict: 'workspace_id,idempotency_key' }
  );
}
