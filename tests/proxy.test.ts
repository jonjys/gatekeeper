import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { encryptSecret } from '../lib/engine/vault';

const loadWorkspaceByToken = vi.fn();
const spendWindows = vi.fn();
const loadCredential = vi.fn();
const insertLedger = vi.fn();
const loadTrapHashes = vi.fn();
const markKilled = vi.fn();
const loadIdempotency = vi.fn();
const saveIdempotency = vi.fn();

vi.mock('@/lib/engine/workspace', () => ({
  loadWorkspaceByToken: (...args: unknown[]) => loadWorkspaceByToken(...args),
  spendWindows: (...args: unknown[]) => spendWindows(...args),
  loadCredential: (...args: unknown[]) => loadCredential(...args),
  insertLedger: (...args: unknown[]) => insertLedger(...args),
  loadTrapHashes: (...args: unknown[]) => loadTrapHashes(...args),
  markKilled: (...args: unknown[]) => markKilled(...args),
  loadIdempotency: (...args: unknown[]) => loadIdempotency(...args),
  saveIdempotency: (...args: unknown[]) => saveIdempotency(...args)
}));

vi.mock('@/lib/stripe', () => ({
  stripe: null,
  recordSavingsFee: vi.fn(async () => ({ ok: false, skipped: 'unconfigured' }))
}));

process.env.GATEZERO_VAULT_KEY = 'a'.repeat(64);

const { handleProxy } = await import('../lib/engine/proxy-handler');

const ws = {
  id: '11111111-1111-1111-1111-111111111111',
  token_hash: 'x',
  stripe_customer_id: null as string | null,
  plan: 'free',
  fail_mode: 'closed' as const,
  monthly_budget_usd: 50,
  daily_budget_usd: 10,
  killed: false,
  prefer_cheap: true,
  savings_fee_bps: 2000
};

function req(path: string, init: RequestInit & { gz?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.gz !== '') headers.set('x-gz-key', init.gz || 'gz_live_testtoken');
  return new NextRequest(`http://localhost/api/proxy/${path}`, { ...init, headers });
}

describe('handleProxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadWorkspaceByToken.mockReset();
    spendWindows.mockReset();
    loadCredential.mockReset();
    insertLedger.mockReset();
    loadTrapHashes.mockReset();
    markKilled.mockReset();
    loadIdempotency.mockReset();
    saveIdempotency.mockReset();
    spendWindows.mockResolvedValue({ monthly: 0, daily: 0 });
    loadTrapHashes.mockResolvedValue([]);
    loadIdempotency.mockResolvedValue(null);
    insertLedger.mockResolvedValue({ ok: true, id: 'led_1', via: 'ledger_requests' });
    global.fetch = vi.fn();
  });

  it('401 without workspace token', async () => {
    const res = await handleProxy(req('openai/v1/models', { gz: '' }), 'openai', ['v1', 'models']);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'missing_workspace_token' });
  });

  it('400 unknown provider', async () => {
    const res = await handleProxy(req('nope/v1/x'), 'nope', ['v1', 'x']);
    expect(res.status).toBe(400);
  });

  it('401 unknown workspace', async () => {
    loadWorkspaceByToken.mockResolvedValue(null);
    const res = await handleProxy(req('openai/v1/models'), 'openai', ['v1', 'models']);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'unknown_workspace' });
  });

  it('402 when kill is armed', async () => {
    loadWorkspaceByToken.mockResolvedValue({ ...ws, killed: true });
    const res = await handleProxy(req('openai/v1/models'), 'openai', ['v1', 'models']);
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ error: 'KILL' });
    expect(insertLedger).toHaveBeenCalled();
  });

  it('451 on trap key', async () => {
    loadWorkspaceByToken.mockResolvedValue({ ...ws });
    const r = req('openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer sk-trap_abc' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [] })
    });
    const res = await handleProxy(r, 'openai', ['v1', 'chat', 'completions']);
    expect(res.status).toBe(451);
  });

  it('401 without vaulted credential', async () => {
    loadWorkspaceByToken.mockResolvedValue({ ...ws });
    loadCredential.mockResolvedValue(null);
    const res = await handleProxy(req('openai/v1/models'), 'openai', ['v1', 'models']);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'missing_provider_credential' });
  });

  it('504 on upstream network failure', async () => {
    loadWorkspaceByToken.mockResolvedValue({ ...ws });
    loadCredential.mockResolvedValue(encryptSecret('sk-test'));
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('econnreset'));
    const res = await handleProxy(req('openai/v1/models'), 'openai', ['v1', 'models']);
    expect(res.status).toBe(504);
    expect(insertLedger.mock.calls[0][0].action).toBe('upstream_fail');
  });

  it('routes gpt-4o to mini and records savings on 200', async () => {
    loadWorkspaceByToken.mockResolvedValue({ ...ws });
    loadCredential.mockResolvedValue(encryptSecret('sk-test'));
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'ok' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    const r = req('openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] })
    });
    const res = await handleProxy(r, 'openai', ['v1', 'chat', 'completions']);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-gz-action')).toBe('cheaper_alias');
    expect(res.headers.get('x-gz-routed-model')).toBe('gpt-4o-mini');
    expect(Number(res.headers.get('x-gz-savings-usd'))).toBeGreaterThan(0);
    const sent = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(sent[1].body as string);
    expect(body.model).toBe('gpt-4o-mini');
    expect(insertLedger.mock.calls[0][0].action).toBe('cheaper_alias');
  });

  it('zeros cost on upstream 401', async () => {
    loadWorkspaceByToken.mockResolvedValue({ ...ws });
    loadCredential.mockResolvedValue(encryptSecret('sk-test'));
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: { type: 'invalid_request_error', code: 'invalid_api_key' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      })
    );
    const r = req('openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] })
    });
    const res = await handleProxy(r, 'openai', ['v1', 'chat', 'completions']);
    expect(res.status).toBe(401);
    expect(res.headers.get('x-gz-fee-usd')).toBe('0');
    expect(insertLedger.mock.calls[0][0].fee_usd).toBe(0);
  });

  it('413 on oversized body', async () => {
    loadWorkspaceByToken.mockResolvedValue({ ...ws });
    const r = req('openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '3000000' },
      body: '{"model":"gpt-4o"}'
    });
    const res = await handleProxy(r, 'openai', ['v1', 'chat', 'completions']);
    expect(res.status).toBe(413);
  });

  it('replays durable idempotency without calling upstream', async () => {
    loadWorkspaceByToken.mockResolvedValue({ ...ws });
    loadIdempotency.mockResolvedValue({
      status: 200,
      body: '{"cached":true}',
      contentType: 'application/json'
    });
    const r = req('openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'abc' },
      body: JSON.stringify({ model: 'gpt-4o', messages: [] })
    });
    const res = await handleProxy(r, 'openai', ['v1', 'chat', 'completions']);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-gz-idempotent')).toBe('1');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
