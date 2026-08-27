/**
 * Deterministic published list prices (USD). AI never invents these.
 * Source: vendor public pricing as of 2026-08 — operator can override via env JSON.
 */
export type PriceRow = {
  provider: string;
  model: string;
  inPerMTok: number;
  outPerMTok: number;
  cheaperAlias?: string;
};

export const PRICES: PriceRow[] = [
  { provider: 'openai', model: 'gpt-4o', inPerMTok: 2.5, outPerMTok: 10, cheaperAlias: 'gpt-4o-mini' },
  { provider: 'openai', model: 'gpt-4o-mini', inPerMTok: 0.15, outPerMTok: 0.6 },
  { provider: 'openai', model: 'gpt-4.1', inPerMTok: 2.0, outPerMTok: 8.0, cheaperAlias: 'gpt-4.1-mini' },
  { provider: 'openai', model: 'gpt-4.1-mini', inPerMTok: 0.4, outPerMTok: 1.6 },
  { provider: 'openai', model: 'gpt-4.1-nano', inPerMTok: 0.1, outPerMTok: 0.4 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', inPerMTok: 3.0, outPerMTok: 15, cheaperAlias: 'claude-3-5-haiku-20241022' },
  { provider: 'anthropic', model: 'claude-3-5-haiku-20241022', inPerMTok: 0.8, outPerMTok: 4.0 },
  { provider: 'anthropic', model: 'claude-sonnet-4-20250514', inPerMTok: 3.0, outPerMTok: 15, cheaperAlias: 'claude-3-5-haiku-20241022' }
];

export function findPrice(provider: string, model: string): PriceRow | null {
  const p = provider.toLowerCase();
  const m = (model || '').toLowerCase();
  return (
    PRICES.find((r) => r.provider === p && r.model.toLowerCase() === m) ||
    PRICES.find((r) => r.provider === p && m.startsWith(r.model.toLowerCase())) ||
    null
  );
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
