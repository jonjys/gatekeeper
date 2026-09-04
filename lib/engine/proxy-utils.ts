import type { CostResult } from './cost';

export const MAX_PROXY_BODY_BYTES = 2_000_000;
export const MAX_IDEMPOTENCY_BODY_CHARS = 262_144;

export function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === '23505';
}

export function shouldMeterSavingsFee(opts: {
  feeUsd: number;
  upstreamOk: boolean;
  stripeCustomerId?: string | null;
  ledgerVia?: string;
}): boolean {
  return (
    opts.upstreamOk &&
    opts.feeUsd > 0 &&
    Boolean(opts.stripeCustomerId) &&
    opts.ledgerVia === 'ledger_requests'
  );
}

export function replayHeaders(contentType?: string | null): HeadersInit {
  return {
    'content-type': contentType || 'application/json',
    'x-gz-idempotent': '1'
  };
}

export function truncateForCache(body: string, max = MAX_IDEMPOTENCY_BODY_CHARS): string {
  if (body.length <= max) return body;
  return JSON.stringify({
    error: 'idempotent_replay',
    message: 'This idempotency-key already completed. Original body exceeded cache size.',
    truncated: true
  });
}

export function zeroedCost(cost: CostResult): CostResult {
  return {
    ...cost,
    baselineUsd: 0,
    actualUsd: 0,
    savingsUsd: 0,
    feeUsd: 0
  };
}
