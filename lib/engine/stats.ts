import { adminDb } from '@/lib/supabase-admin';

export type ProviderStat = {
  provider: string;
  requests: number;
  actualUsd: number;
  baselineUsd: number;
  savingsUsd: number;
  feeUsd: number;
};

export type PublicStats = {
  requests: number;
  actualUsd: number;
  baselineUsd: number;
  savingsUsd: number;
  feeUsd: number;
  lastAt: string | null;
  byProvider: ProviderStat[];
};

export const EMPTY_STATS: PublicStats = {
  requests: 0,
  actualUsd: 0,
  baselineUsd: 0,
  savingsUsd: 0,
  feeUsd: 0,
  lastAt: null,
  byProvider: []
};

export function aggregateLedgerRows(
  rows: Array<{
    provider?: string | null;
    action?: string | null;
    actual_usd?: number | null;
    baseline_usd?: number | null;
    savings_usd?: number | null;
    fee_usd?: number | null;
    created_at?: string | null;
  }>
): PublicStats {
  const map = new Map<string, ProviderStat>();
  let requests = 0;
  let actualUsd = 0;
  let baselineUsd = 0;
  let savingsUsd = 0;
  let feeUsd = 0;
  let lastAt: string | null = null;
  for (const row of rows) {
    if (row.action === 'probe') continue;
    requests += 1;
    const actual = Number(row.actual_usd) || 0;
    const baseline = Number(row.baseline_usd) || 0;
    const savings = Number(row.savings_usd) || 0;
    const fee = Number(row.fee_usd) || 0;
    actualUsd += actual;
    baselineUsd += baseline;
    savingsUsd += savings;
    feeUsd += fee;
    if (row.created_at && (!lastAt || row.created_at > lastAt)) lastAt = row.created_at;
    const provider = (row.provider || 'unknown').toLowerCase();
    const cur = map.get(provider) || {
      provider,
      requests: 0,
      actualUsd: 0,
      baselineUsd: 0,
      savingsUsd: 0,
      feeUsd: 0
    };
    cur.requests += 1;
    cur.actualUsd += actual;
    cur.baselineUsd += baseline;
    cur.savingsUsd += savings;
    cur.feeUsd += fee;
    map.set(provider, cur);
  }
  return {
    requests,
    actualUsd,
    baselineUsd,
    savingsUsd,
    feeUsd,
    lastAt,
    byProvider: Array.from(map.values()).sort((a, b) => b.requests - a.requests)
  };
}

export async function publicStats(): Promise<PublicStats> {
  const db = adminDb();
  if (!db) return EMPTY_STATS;
  const { data, error } = await db
    .from('ledger_requests')
    .select('provider, action, actual_usd, baseline_usd, savings_usd, fee_usd, created_at')
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error || !data) return EMPTY_STATS;
  return aggregateLedgerRows(data);
}
