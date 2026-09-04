/**
 * Deterministic published list prices (USD). AI never invents these.
 * Source and date are exported so any UI that shows prices can cite them.
 */
export type PriceRow = {
  provider: string;
  model: string;
  inPerMTok: number;
  outPerMTok: number;
  cheaperAlias?: string;
};

/** OpenAI and Anthropic public list prices. */
export const PRICE_SOURCE = 'OpenAI and Anthropic public list prices';
export const PRICE_AS_OF = '2026-08';

export const PRICES: PriceRow[] = [
  { provider: 'openai', model: 'gpt-4o', inPerMTok: 2.5, outPerMTok: 10, cheaperAlias: 'gpt-4o-mini' },
  { provider: 'openai', model: 'gpt-4o-mini', inPerMTok: 0.15, outPerMTok: 0.6 },
  { provider: 'openai', model: 'gpt-4.1', inPerMTok: 2.0, outPerMTok: 8.0, cheaperAlias: 'gpt-4.1-mini' },
  { provider: 'openai', model: 'gpt-4.1-mini', inPerMTok: 0.4, outPerMTok: 1.6 },
  { provider: 'openai', model: 'gpt-4.1-nano', inPerMTok: 0.1, outPerMTok: 0.4 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', inPerMTok: 3.0, outPerMTok: 15, cheaperAlias: 'claude-3-5-haiku-20241022' },
  { provider: 'anthropic', model: 'claude-3-5-haiku-20241022', inPerMTok: 0.8, outPerMTok: 4.0 },
  { provider: 'anthropic', model: 'claude-sonnet-4-20250514', inPerMTok: 3.0, outPerMTok: 15, cheaperAlias: 'claude-3-5-haiku-20241022' },
  // Short ids so dated Anthropic model strings still longest-prefix match.
  { provider: 'anthropic', model: 'claude-3-5-sonnet', inPerMTok: 3.0, outPerMTok: 15, cheaperAlias: 'claude-3-5-haiku-20241022' },
  { provider: 'anthropic', model: 'claude-3-5-haiku', inPerMTok: 0.8, outPerMTok: 4.0 },
  { provider: 'anthropic', model: 'claude-sonnet-4', inPerMTok: 3.0, outPerMTok: 15, cheaperAlias: 'claude-3-5-haiku-20241022' }
];

export function findPrice(provider: string, model: string): PriceRow | null {
  const p = provider.toLowerCase();
  const m = (model || '').toLowerCase();
  if (!m) return null;
  const exact = PRICES.find((r) => r.provider === p && r.model.toLowerCase() === m);
  if (exact) return exact;
  // Longest prefix wins so gpt-4o-mini-2024-* is not priced as gpt-4o (inflated savings).
  const prefixHits = PRICES.filter(
    (r) => r.provider === p && m.startsWith(r.model.toLowerCase())
  ).sort((a, b) => b.model.length - a.model.length);
  return prefixHits[0] || null;
}

/** Conservative pre-hop estimate used only for fail-closed budget checks. */
export function estimateHopUsd(provider: string, model: string): number {
  const row = findPrice(provider, model);
  if (!row) return /gpt-4o(?!-mini)/i.test(model) ? 0.25 : 0.05;
  return costUsd(row, 800, 400);
}

export function costUsd(row: PriceRow, promptTokens: number, completionTokens: number): number {
  const inn = (Math.max(0, promptTokens) / 1_000_000) * row.inPerMTok;
  const out = (Math.max(0, completionTokens) / 1_000_000) * row.outPerMTok;
  return round6(inn + out);
}

export function estimateTokensFromChars(chars: number): number {
  return Math.max(1, Math.ceil(Math.max(0, chars) / 4));
}

export function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

export const SAVINGS_FEE_BPS = 2000; // 20% of verified savings

export function feeFromSavingsUsd(savingsUsd: number, bps = SAVINGS_FEE_BPS): number {
  if (!(savingsUsd > 0)) return 0;
  return round6((savingsUsd * bps) / 10_000);
}
