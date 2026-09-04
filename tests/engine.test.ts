import { describe, expect, it } from 'vitest';
import { computeCost, costForCompletedHop } from '../lib/engine/cost';
import { estimateHopUsd, findPrice } from '../lib/engine/prices';
import { feeFromSavingsUsd } from '../lib/engine/prices';
import { applyModelToBody, decideRoute } from '../lib/engine/route';
import { evaluatePolicy, looksLikeTrapKey } from '../lib/engine/policy';
import { decryptSecret, encryptSecret, hashToken, maskSecret } from '../lib/engine/vault';
import { requestFingerprint } from '../lib/engine/dedup';
import { buildLedgerPayload } from '../lib/engine/workspace';
import { aggregateLedgerRows } from '../lib/engine/stats';
import { summarizeLedger } from '../lib/engine/workspace';
import { mintTrapSecret } from '../lib/vacuum';
import { isUniqueViolation, shouldMeterSavingsFee } from '../lib/engine/proxy-utils';
import { bodyWantsStream, parseSseUsage, prepareOutboundBody } from '../lib/engine/stream';
import { savingsFeeBpsForPlan } from '../lib/billing';
import { isGzToken } from '../lib/engine/auth';
import { NextRequest } from 'next/server';

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
        provider: 'sim',
        action: 'spike',
        actual_usd: 10000,
        baseline_usd: 10000,
        savings_usd: 0,
        fee_usd: 0,
        created_at: '2026-08-31T21:00:00Z'
      },
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

  it('spend windows ignore sim spikes so disarm still works', () => {
    const s = summarizeLedger([
      {
        id: '1',
        provider: 'openai',
        model: 'gpt-4o-mini',
        path: '/v1/chat',
        action: 'cheaper_alias',
        baseline_usd: 0.01,
        actual_usd: 0.002,
        savings_usd: 0.008,
        fee_usd: 0.0016,
        status: 200,
        created_at: new Date().toISOString()
      },
      {
        id: '2',
        provider: 'sim',
        model: 'spike',
        path: '/sim/10k',
        action: 'spike',
        baseline_usd: 10000,
        actual_usd: 10000,
        savings_usd: 0,
        fee_usd: 0,
        status: 402,
        created_at: new Date().toISOString()
      }
    ]);
    expect(s.spend.monthly).toBeCloseTo(0.002);
    expect(s.totals.requests).toBe(1);
  });
});

describe('trap mint', () => {
  it('issues unique sk-trap_ secrets', () => {
    const a = mintTrapSecret();
    const b = mintTrapSecret();
    expect(a.startsWith('sk-trap_')).toBe(true);
    expect(a).not.toBe(b);
    expect(looksLikeTrapKey(a)).toBe(true);
  });
});

describe('price matching', () => {
  it('does not price gpt-4o-mini dated ids as gpt-4o', () => {
    const mini = findPrice('openai', 'gpt-4o-mini-2024-07-18');
    expect(mini?.model).toBe('gpt-4o-mini');
    expect(mini?.cheaperAlias).toBeUndefined();
    const dated = findPrice('openai', 'gpt-4o-2024-08-06');
    expect(dated?.model).toBe('gpt-4o');
    expect(dated?.cheaperAlias).toBe('gpt-4o-mini');
  });

  it('estimates next hop from the price table', () => {
    expect(estimateHopUsd('openai', 'gpt-4o-mini')).toBeGreaterThan(0);
    expect(estimateHopUsd('openai', 'gpt-4o')).toBeGreaterThan(estimateHopUsd('openai', 'gpt-4o-mini'));
  });
});

describe('failed hop cost', () => {
  it('zeros savings and fee when upstream fails', () => {
    const ok = computeCost({
      provider: 'openai',
      requestedModel: 'gpt-4o',
      routedModel: 'gpt-4o-mini',
      promptTokens: 1000,
      completionTokens: 100,
      savingsFeeBps: 2000
    });
    expect(ok.feeUsd).toBeGreaterThan(0);
    const failed = costForCompletedHop(false, ok);
    expect(failed.feeUsd).toBe(0);
    expect(failed.savingsUsd).toBe(0);
    expect(failed.actualUsd).toBe(0);
  });
});

describe('policy daily cap', () => {
  it('fail-closed daily returns 429 without killing monthly', () => {
    const d = evaluatePolicy({
      killed: false,
      failMode: 'closed',
      monthlySpentUsd: 1,
      dailySpentUsd: 9.5,
      monthlyBudgetUsd: 50,
      dailyBudgetUsd: 10,
      trapHit: false,
      estimatedNextUsd: 1
    });
    expect(d.allow).toBe(false);
    expect(d.status).toBe(429);
    expect(d.code).toBe('DAILY_CAP');
  });
});

describe('meter gating', () => {
  it('meters only new ledger writes with verified savings', () => {
    expect(
      shouldMeterSavingsFee({
        feeUsd: 0.02,
        upstreamOk: true,
        stripeCustomerId: 'cus_x',
        ledgerVia: 'ledger_requests'
      })
    ).toBe(true);
    expect(
      shouldMeterSavingsFee({
        feeUsd: 0.02,
        upstreamOk: true,
        stripeCustomerId: 'cus_x',
        ledgerVia: 'idempotent'
      })
    ).toBe(false);
    expect(
      shouldMeterSavingsFee({
        feeUsd: 0.02,
        upstreamOk: false,
        stripeCustomerId: 'cus_x',
        ledgerVia: 'ledger_requests'
      })
    ).toBe(false);
  });

  it('treats postgres 23505 as unique', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ code: '42501' })).toBe(false);
  });
});

describe('stream helpers', () => {
  it('injects OpenAI stream_options.include_usage', () => {
    const raw = JSON.stringify({ model: 'gpt-4o', stream: true, messages: [] });
    expect(bodyWantsStream(raw)).toBe(true);
    const out = JSON.parse(prepareOutboundBody(raw, 'gpt-4o-mini', 'openai'));
    expect(out.model).toBe('gpt-4o-mini');
    expect(out.stream_options.include_usage).toBe(true);
  });

  it('parses OpenAI and Anthropic SSE usage', () => {
    const openai = parseSseUsage('data: {"usage":{"prompt_tokens":11,"completion_tokens":4}}\n');
    expect(openai?.prompt_tokens).toBe(11);
    expect(openai?.completion_tokens).toBe(4);
    const anthropic = parseSseUsage(
      'data: {"type":"message_start","message":{"usage":{"input_tokens":20}}}\ndata: {"type":"message_delta","usage":{"output_tokens":7}}\n'
    );
    expect(anthropic?.prompt_tokens).toBe(20);
    expect(anthropic?.completion_tokens).toBe(7);
  });
});

describe('plan fee bps', () => {
  it('enterprise is 15%', () => {
    expect(savingsFeeBpsForPlan('enterprise')).toBe(1500);
    expect(savingsFeeBpsForPlan('pro')).toBe(2000);
    expect(savingsFeeBpsForPlan('free')).toBe(2000);
  });
});

describe('workspace token', () => {
  it('accepts live and test prefixes only', () => {
    expect(isGzToken('gz_live_abc')).toBe(true);
    expect(isGzToken('gz_test_abc')).toBe(true);
    expect(isGzToken('gz_foo')).toBe(false);
    const req = new NextRequest('http://localhost/api/v1/ledger', {
      headers: { 'x-gz-key': 'gz_live_abc' }
    });
    expect(req.headers.get('x-gz-key')).toBe('gz_live_abc');
  });
});

describe('vault production key', () => {
  it('refuses a missing wrapping key in production', () => {
    const prevKey = process.env.GATEZERO_VAULT_KEY;
    const prevNode = process.env.NODE_ENV;
    const prevVercel = process.env.VERCEL_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.GATEZERO_VAULT_KEY;
    delete process.env.VERCEL_ENV;
    expect(() => encryptSecret('sk-test')).toThrow(/GATEZERO_VAULT_KEY/);
    process.env.NODE_ENV = prevNode;
    process.env.VERCEL_ENV = prevVercel;
    process.env.GATEZERO_VAULT_KEY = prevKey;
  });
});
