import { NextRequest, NextResponse } from 'next/server';
import { computeCost, tokensFromBodyAndUsage } from '@/lib/engine/cost';
import { applyModelToBody, decideRoute, extractModel } from '@/lib/engine/route';
import { evaluatePolicy, looksLikeTrapKey } from '@/lib/engine/policy';
import { memGet, memSet } from '@/lib/engine/idempotency';
import { rateLimit } from '@/lib/engine/ratelimit';
import { fetchWithRetry, HOP, UPSTREAM } from '@/lib/engine/upstream';
import { decryptSecret, hashToken } from '@/lib/engine/vault';
import { dedupGet, dedupSet, requestFingerprint } from '@/lib/engine/dedup';
import { slog } from '@/lib/engine/log';
import { readGzToken } from '@/lib/engine/auth';
import {
  insertLedger,
  loadCredential,
  loadTrapHashes,
  loadWorkspaceByToken,
  markKilled,
  spendWindows,
  type LedgerWrite
} from '@/lib/engine/workspace';
import { stripe } from '@/lib/stripe';

function extractBearerSecret(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  const m = auth.match(/^(?:Bearer|Basic)\s+(.+)$/i);
  if (m) return m[1].trim();
  return req.headers.get('x-api-key') || '';
}

function withLedgerHeaders(res: NextResponse, info: { via?: string; error?: string; id?: string; ok?: boolean }) {
  res.headers.set('x-gz-ledger', info.ok ? 'ok' : 'fail');
  if (info.via) res.headers.set('x-gz-ledger-via', info.via);
  if (info.id) res.headers.set('x-gz-ledger-id', info.id);
  if (info.error) res.headers.set('x-gz-ledger-error', info.error.slice(0, 180));
  return res;
}

export async function handleProxy(
  req: NextRequest,
  providerRaw: string,
  pathParts: string[]
) {
  const provider = (providerRaw || '').toLowerCase();
  const path = (pathParts || []).join('/');
  const base = UPSTREAM[provider];
  if (!base) {
    return NextResponse.json({ error: 'unknown_provider' }, { status: 400 });
  }

  const gz = readGzToken(req);
  if (!gz.startsWith('gz_live_') && !gz.startsWith('gz_test_')) {
    return NextResponse.json(
      {
        error: 'missing_workspace_token',
        hint: 'Send x-gz-key: gz_live_… (create via POST /api/v1/workspace)'
      },
      { status: 401 }
    );
  }

  if (!rateLimit(gz, 180, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const idem =
    req.headers.get('idempotency-key') || req.headers.get('x-gz-idempotency') || '';
  if (idem) {
    const hit = memGet(`${gz}:${idem}`);
    if (hit) {
      return new NextResponse(hit.body, {
        status: hit.status,
        headers: { 'content-type': 'application/json', 'x-gz-idempotent': '1' }
      });
    }
  }

  const ws = await loadWorkspaceByToken(gz);
  if (!ws) {
    return NextResponse.json(
      {
        error: 'unknown_workspace',
        hint: 'Run supabase/migrations/003_engine.sql then POST /api/v1/workspace'
      },
      { status: 401 }
    );
  }

  const rawBody = req.method === 'GET' || req.method === 'HEAD' ? '' : await req.text();
  const isGet = req.method === 'GET' || req.method === 'HEAD';
  const fp = requestFingerprint({ method: req.method, provider, path, body: rawBody });
  if (isGet) {
    const deduped = dedupGet(ws.id, fp);
    if (deduped) {
      slog('proxy.dedup', { workspace: ws.id, provider, path });
      const cached = new NextResponse(deduped.body, {
        status: deduped.status,
        headers: {
          'content-type': 'application/json',
          'x-gz-dedup': '1'
        }
      });
      const wrote = await insertLedger({
        workspace_id: ws.id,
        provider,
        model: extractModel(rawBody) || null,
        path,
        action: 'cache',
        baseline_usd: 0,
        actual_usd: 0,
        savings_usd: 0,
        fee_usd: 0,
        status: deduped.status
      });
      return withLedgerHeaders(cached, wrote);
    }
  }

  const requestedModel = extractModel(rawBody);
  const bearer = extractBearerSecret(req);
  const trapHashes = await loadTrapHashes(ws.id);
  const trapHit =
    looksLikeTrapKey(req.headers.get('authorization') || '') ||
    looksLikeTrapKey(bearer) ||
    (bearer ? trapHashes.includes(hashToken(bearer)) : false);

  const headerKilled = req.headers.get('x-bc-killed') === '1' || req.headers.get('x-gz-killed') === '1';

  const spend = await spendWindows(ws.id);
  const policy = evaluatePolicy({
    killed: ws.killed || headerKilled,
    failMode: ws.fail_mode,
    monthlySpentUsd: spend.monthly,
    dailySpentUsd: spend.daily,
    monthlyBudgetUsd: Number(ws.monthly_budget_usd) || 0,
    dailyBudgetUsd: Number(ws.daily_budget_usd) || 0,
    trapHit,
    estimatedNextUsd: 0.01
  });

  if (!policy.allow) {
    if (policy.code === 'BUDGET' || policy.code === 'KILL') {
      await markKilled(ws.id, policy.message);
    }
    const blocked = JSON.stringify({ error: policy.code, message: policy.message });
    if (idem) memSet(`${gz}:${idem}`, policy.status, blocked);
    const wrote = await insertLedger({
      workspace_id: ws.id,
      idempotency_key: idem ? `${idem}:blocked:${policy.code}` : null,
      provider,
      model: requestedModel || null,
      path,
      action: 'blocked',
      baseline_usd: 0,
      actual_usd: 0,
      savings_usd: 0,
      fee_usd: 0,
      status: policy.status
    });
    slog('proxy.block', { workspace: ws.id, provider, code: policy.code, status: policy.status });
    const res = new NextResponse(blocked, {
      status: policy.status,
      headers: { 'content-type': 'application/json' }
    });
    return withLedgerHeaders(res, wrote);
  }

  const route = decideRoute({
    provider,
    requestedModel,
    preferCheap: ws.prefer_cheap !== false,
    killed: false
  });
  const outboundBody = applyModelToBody(rawBody, route.routedModel);

  let upstreamAuth = req.headers.get('x-upstream-authorization') || '';
  const cred = await loadCredential(ws.id, provider);
  if (cred) {
    try {
      upstreamAuth = decryptSecret(cred);
    } catch (e) {
      slog('vault_decrypt', { level: 'error', detail: String(e) });
      return NextResponse.json({ error: 'vault_decrypt_failed' }, { status: 500 });
    }
  }
  if (!upstreamAuth) {
    return NextResponse.json(
      {
        error: 'missing_provider_credential',
        hint: 'POST /api/v1/credentials with { provider, secret } once'
      },
      { status: 401 }
    );
  }

  const headers = new Headers();
  req.headers.forEach((v, k) => {
    const lk = k.toLowerCase();
    if (!HOP.has(lk) && !lk.startsWith('x-gz') && !lk.startsWith('x-bc') && lk !== 'authorization') {
      headers.set(k, v);
    }
  });
  if (provider === 'anthropic') {
    headers.set('x-api-key', upstreamAuth.replace(/^Bearer\s+/i, ''));
    headers.set('anthropic-version', headers.get('anthropic-version') || '2023-06-01');
  } else {
    headers.set(
      'authorization',
      upstreamAuth.startsWith('Bearer ') || upstreamAuth.startsWith('Basic ')
        ? upstreamAuth
        : `Bearer ${upstreamAuth}`
    );
  }
  headers.set('content-type', req.headers.get('content-type') || 'application/json');

  const url = `${base}/${path}${req.nextUrl.search}`;
  let upstream: Response;
  try {
    upstream = await fetchWithRetry(url, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : outboundBody
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'upstream_failed';
    slog('proxy.upstream_fail', { level: 'error', workspace: ws.id, provider, detail: msg });
    const wrote = await insertLedger({
      workspace_id: ws.id,
      provider,
      model: requestedModel || null,
      path,
      action: 'upstream_fail',
      baseline_usd: 0,
      actual_usd: 0,
      savings_usd: 0,
      fee_usd: 0,
      status: 504
    });
    return withLedgerHeaders(
      NextResponse.json({ error: 'upstream_failed', detail: msg }, { status: 504 }),
      wrote
    );
  }

  const respText = await upstream.text();
  let usage:
    | { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number }
    | undefined;
  let errType: string | undefined;
  try {
    const j = JSON.parse(respText) as { usage?: typeof usage; error?: { type?: string; code?: string } };
    usage = j.usage;
    errType = j.error?.code || j.error?.type;
  } catch {
    /* ignore */
  }
  const toks = tokensFromBodyAndUsage(outboundBody || respText, usage);
  const cost = computeCost({
    provider,
    requestedModel: requestedModel || route.requestedModel,
    routedModel: route.routedModel,
    promptTokens: toks.promptTokens,
    completionTokens: toks.completionTokens,
    savingsFeeBps: Number(ws.savings_fee_bps) || 2000
  });

  const action = !upstream.ok && errType ? `error:${errType}` : route.action;
  const ledgerRow: LedgerWrite = {
    workspace_id: ws.id,
    idempotency_key: idem || null,
    provider,
    model: cost.routedModel,
    path,
    action,
    baseline_usd: cost.baselineUsd,
    actual_usd: cost.actualUsd,
    savings_usd: cost.savingsUsd,
    fee_usd: cost.feeUsd,
    status: upstream.status
  };
  const wrote = await insertLedger(ledgerRow);

  if (cost.feeUsd > 0 && ws.stripe_customer_id && stripe) {
    try {
      const cents = Math.max(1, Math.round(cost.feeUsd * 100));
      await stripe.billing.meterEvents.create({
        event_name: 'api_proxy_usage',
        timestamp: Math.floor(Date.now() / 1000),
        payload: {
          stripe_customer_id: ws.stripe_customer_id,
          value: String(cents)
        }
      } as Parameters<typeof stripe.billing.meterEvents.create>[0]);
    } catch (e) {
      slog('stripe_meter', { level: 'error', detail: String(e) });
    }
  }

  const outHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    if (!HOP.has(k.toLowerCase())) outHeaders.set(k, v);
  });
  outHeaders.set('x-gz-action', route.action);
  outHeaders.set('x-gz-requested-model', cost.requestedModel || requestedModel || '');
  outHeaders.set('x-gz-routed-model', cost.routedModel || '');
  outHeaders.set('x-gz-baseline-usd', String(cost.baselineUsd));
  outHeaders.set('x-gz-actual-usd', String(cost.actualUsd));
  outHeaders.set('x-gz-savings-usd', String(cost.savingsUsd));
  outHeaders.set('x-gz-fee-usd', String(cost.feeUsd));
  if (idem) memSet(`${gz}:${idem}`, upstream.status, respText);
  if (isGet && upstream.ok) dedupSet(ws.id, fp, upstream.status, respText);

  slog('proxy.ok', {
    workspace: ws.id,
    provider,
    action,
    savings: cost.savingsUsd,
    fee: cost.feeUsd,
    status: upstream.status,
    ledger: wrote.ok,
    ledgerVia: wrote.via,
    ledgerError: wrote.error
  });

  const res = new NextResponse(respText, { status: upstream.status, headers: outHeaders });
  return withLedgerHeaders(res, wrote);
}
