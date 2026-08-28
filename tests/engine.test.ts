import { describe, expect, it } from 'vitest';
import { computeCost } from '../lib/engine/cost';
import { feeFromSavingsUsd } from '../lib/engine/prices';
import { applyModelToBody, decideRoute } from '../lib/engine/route';
import { evaluatePolicy, looksLikeTrapKey } from '../lib/engine/policy';
import { decryptSecret, encryptSecret, hashToken, maskSecret } from '../lib/engine/vault';
import { requestFingerprint } from '../lib/engine/dedup';
import { buildLedgerPayload } from '../lib/engine/workspace';
import { aggregateLedgerRows } from '../lib/engine/stats';

describe('cost engine', () => {
  it('charges 20% of verified savings when routing to cheaper model', () => {
    const r = computeCost({
      provider: 'openai',
      requestedModel: 'gpt-4o',
      routedModel: 'gpt-4o-mini',
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
      savingsFeeBps: 2000
    });
    expect(r.baselineUsd).toBe(12.5);
    expect(r.actualUsd).toBe(0.75);
    expect(r.savingsUsd).toBe(11.75);
    expect(r.feeUsd).toBe(2.35);
  });

  it('fee is 0 when no savings', () => {
    expect(feeFromSavingsUsd(0)).toBe(0);
    expect(feeFromSavingsUsd(-1)).toBe(0);
    const r = computeCost({
      provider: 'openai',
      requestedModel: 'gpt-4o-mini',
      routedModel: 'gpt-4o-mini',
      promptTokens: 100,
      completionTokens: 50,
      savingsFeeBps: 2000
    });
    expect(r.savingsUsd).toBe(0);
    expect(r.feeUsd).toBe(0);
  });

  it('15% enterprise bps', () => {
    expect(feeFromSavingsUsd(10, 1500)).toBe(1.5);
  });
});

describe('routing', () => {
  it('aliases gpt-4o to mini when preferCheap', () => {
    const d = decideRoute({
      provider: 'openai',
      requestedModel: 'gpt-4o',
      preferCheap: true,
      killed: false
    });
    expect(d.action).toBe('cheaper_alias');
    expect(d.routedModel).toBe('gpt-4o-mini');
  });

  it('passthrough when preferCheap is false', () => {
    const d = decideRoute({
      provider: 'openai',
      requestedModel: 'gpt-4o',
      preferCheap: false,
      killed: false
    });
    expect(d.action).toBe('passthrough');
    expect(d.routedModel).toBe('gpt-4o');
  });

  it('rewrites model field only', () => {
    const out = applyModelToBody(JSON.stringify({ model: 'gpt-4o', messages: [1] }), 'gpt-4o-mini');
    expect(JSON.parse(out).model).toBe('gpt-4o-mini');
    expect(JSON.parse(out).messages).toEqual([1]);
  });
});

describe('policy', () => {
  it('fail-closed on monthly budget', () => {
    const d = evaluatePolicy({
      killed: false,
      failMode: 'closed',
      monthlySpentUsd: 49,
      dailySpentUsd: 1,
      monthlyBudgetUsd: 50,
      dailyBudgetUsd: 10,
      trapHit: false,
      estimatedNextUsd: 2
    });
    expect(d.allow).toBe(false);
    expect(d.status).toBe(402);
  });

  it('fail-open allows over-budget', () => {
    const d = evaluatePolicy({
      killed: false,
      failMode: 'open',
      monthlySpentUsd: 99,
      dailySpentUsd: 9,
      monthlyBudgetUsd: 50,
      dailyBudgetUsd: 10,
      trapHit: false,
      estimatedNextUsd: 2
    });
    expect(d.allow).toBe(true);
  });

  it('killed always 402 even if fail-open', () => {
    const d = evaluatePolicy({
      killed: true,
      failMode: 'open',
      monthlySpentUsd: 0,
      dailySpentUsd: 0,
      monthlyBudgetUsd: 50,
      dailyBudgetUsd: 10,
      trapHit: false,
      estimatedNextUsd: 0
    });
    expect(d.allow).toBe(false);
    expect(d.status).toBe(402);
    expect(d.code).toBe('KILL');
  });

  it('trap returns 451', () => {
    expect(looksLikeTrapKey('Bearer sk_test_trap_abc')).toBe(true);
    const d = evaluatePolicy({
      killed: false,
      failMode: 'closed',
      monthlySpentUsd: 0,
      dailySpentUsd: 0,
      monthlyBudgetUsd: 50,
      dailyBudgetUsd: 10,
      trapHit: true,
      estimatedNextUsd: 0
    });
    expect(d.status).toBe(451);
  });
});

describe('vault', () => {
  it('roundtrips AES-GCM', () => {
    process.env.GATEZERO_VAULT_KEY = 'a'.repeat(64);
    const enc = encryptSecret('sk-secret-value');
    expect(decryptSecret(enc)).toBe('sk-secret-value');
    expect(maskSecret('sk-secret-value')).toContain('…');
    expect(hashToken('gz_live_x')).toHaveLength(64);
  });
});

describe('dedup fingerprint', () => {
  it('stable for identical payloads', () => {
    const a = requestFingerprint({ method: 'POST', provider: 'openai', path: 'v1/x', body: '{"a":1}' });
    const b = requestFingerprint({ method: 'POST', provider: 'openai', path: 'v1/x', body: '{"a":1}' });
    const c = requestFingerprint({ method: 'POST', provider: 'openai', path: 'v1/x', body: '{"a":2}' });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
  });
});

describe('ledger payload', () => {
  it('always has id, action and numeric costs', () => {
    const p = buildLedgerPayload({
      workspace_id: '11111111-1111-1111-1111-111111111111',
      provider: 'openai',
      model: 'gpt-4o-mini',
      path: 'v1/chat/completions',
      action: 'passthrough',
      baseline_usd: 0.001,
      actual_usd: 0.001,
      savings_usd: 0,
      fee_usd: 0,
      status: 200
    });
    expect(p.id).toHaveLength(36);
    expect(p.idempotency_key.startsWith('auto_')).toBe(true);
    expect(p.action).toBe('passthrough');
    expect(p.actual_usd).toBe(0.001);
    expect(p.status).toBe(200);
  });
});

describe('public stats', () => {
  it('skips probes and sums savings/fee', () => {
    const s = aggregateLedgerRows([
      {
        provider: 'openai',
        action: 'cheaper_alias',
        actual_usd: 0.001,
        baseline_usd: 0.005,
        savings_usd: 0.004,
        fee_usd: 0.0008,
        created_at: '2026-08-28T10:00:00Z'
      },
      { provider: 'probe', action: 'probe', actual_usd: 0, baseline_usd: 0, savings_usd: 0, fee_usd: 0 },
      {
        provider: 'openai',
        action: 'passthrough',
        actual_usd: 0.002,
        baseline_usd: 0.002,
        savings_usd: 0,
        fee_usd: 0,
        created_at: '2026-08-28T11:00:00Z'
      }
    ]);
    expect(s.requests).toBe(2);
    expect(s.savingsUsd).toBeCloseTo(0.004);
    expect(s.feeUsd).toBeCloseTo(0.0008);
    expect(s.byProvider[0].provider).toBe('openai');
    expect(s.lastAt).toBe('2026-08-28T11:00:00Z');
  });
});
