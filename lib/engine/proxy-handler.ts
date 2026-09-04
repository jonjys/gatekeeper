import { NextRequest, NextResponse } from 'next/server';
import { computeCost, costForCompletedHop, tokensFromBodyAndUsage } from '@/lib/engine/cost';
import { decideRoute, extractModel } from '@/lib/engine/route';
import { estimateHopUsd } from '@/lib/engine/prices';
import { evaluatePolicy, looksLikeTrapKey } from '@/lib/engine/policy';
import { memGet, memSet } from '@/lib/engine/idempotency';
import { rateLimit } from '@/lib/engine/ratelimit';
import { fetchWithRetry, FORWARD, HOP, UPSTREAM } from '@/lib/engine/upstream';
import { decryptSecret, hashToken } from '@/lib/engine/vault';
import { dedupGet, dedupSet, requestFingerprint } from '@/lib/engine/dedup';
import { slog } from '@/lib/engine/log';
import { isGzToken, readGzToken } from '@/lib/engine/auth';
import { bodyWantsStream, parseSseUsage, prepareOutboundBody } from '@/lib/engine/stream';
import {
  MAX_PROXY_BODY_BYTES,
  replayHeaders,
  shouldMeterSavingsFee,
  truncateForCache
} from '@/lib/engine/proxy-utils';
import {
  insertLedger,
  loadCredential,
  loadIdempotency,
  loadTrapHashes,
  loadWorkspaceByToken,
  markKilled,
  saveIdempotency,
  spendWindows,
  type LedgerWrite,
  type Workspace
} from '@/lib/engine/workspace';
import { recordSavingsFee } from '@/lib/stripe';
import type { CostResult } from '@/lib/engine/cost';

function extractBearerSecret(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  const m = auth.match(/^(?:Bearer|Basic)\s+(.+)$/i);
  if (m) return m[1].trim();
  return req.headers.get('x-api-key') || '';
}

function withLedgerHeaders(
  res: NextResponse,
  info: { via?: string; error?: string; id?: string; ok?: boolean }
) {
  res.headers.set('x-gz-ledger', info.ok ? 'ok' : 'fail');
  if (info.via) res.headers.set('x-gz-ledger-via', info.via);
  if (info.id) res.headers.set('x-gz-ledger-id', info.id);
  if (info.error) res.headers.set('x-gz-ledger-error', info.error.slice(0, 180));
  return res;
}

function applyCostHeaders(headers: Headers, cost: CostResult, requestedModel: string, action: string) {
  headers.set('x-gz-action', action);
  headers.set('x-gz-requested-model', cost.requestedModel || requestedModel || '');
  headers.set('x-gz-routed-model', cost.routedModel || '');
  headers.set('x-gz-baseline-usd', String(cost.baselineUsd));
  headers.set('x-gz-actual-usd', String(cost.actualUsd));
  headers.set('x-gz-savings-usd', String(cost.savingsUsd));
  headers.set('x-gz-fee-usd', String(cost.feeUsd));
}

function copyUpstreamHeaders(upstream: Response): Headers {
  const outHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    if (!HOP.has(k.toLowerCase())) outHeaders.set(k, v);
  });
  return outHeaders;
}

async function rememberIdempotent(
  gz: string,
  idem: string,
  workspaceId: string,
  status: number,
  body: string,
  contentType?: string
) {
  if (!idem) return;
  memSet(`${gz}:${idem}`, status, truncateForCache(body));
  await saveIdempotency(workspaceId, idem, status, body, contentType || 'application/json');
}

async function maybeMeter(opts: {
  cost: CostResult;
  upstreamOk: boolean;
  ws: Workspace;
  ledgerVia?: string;
  ledgerId?: string;
}) {
  if (
    !shouldMeterSavingsFee({
      feeUsd: opts.cost.feeUsd,
      upstreamOk: opts.upstreamOk,
      stripeCustomerId: opts.ws.stripe_customer_id,
      ledgerVia: opts.ledgerVia
    })
  ) {
    return;
  }
  const result = await recordSavingsFee(
    opts.ws.stripe_customer_id as string,
    opts.cost.feeUsd,
    opts.ledgerId ? `gz_${opts.ledgerId}` : undefined
  );
  if (!result.ok && 'error' in result) {
    slog('stripe_meter', { level: 'error', detail: result.error });
  }
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
  if (!isGzToken(gz)) {
    return NextResponse.json(
      {
        error: 'missing_workspace_token',
        hint: 'Send x-gz-key: gz_live_… (create via POST /api/v1/workspace)'
      },
      { status: 401 }
    );
  }

  if (!rateLimit(gz, 180, 60_000)) {
    const res = NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    res.headers.set('retry-after', '60');
    return res;
  }

  const idem =
    req.headers.get('idempotency-key') || req.headers.get('x-gz-idempotency') || '';
  if (idem) {
    const hit = memGet(`${gz}:${idem}`);
    if (hit) {
      return new NextResponse(hit.body, {
        status: hit.status,
        headers: replayHeaders()
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

  if (idem) {
    const durable = await loadIdempotency(ws.id, idem);
    if (durable) {
      memSet(`${gz}:${idem}`, durable.status, durable.body);
      return new NextResponse(durable.body, {
        status: durable.status,
        headers: replayHeaders(durable.contentType)
      });
    }
  }

  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > MAX_PROXY_BODY_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  const rawBody = req.method === 'GET' || req.method === 'HEAD' ? '' : await req.text();
  if (rawBody.length > MAX_PROXY_BODY_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

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
  const estimatedNextUsd = estimateHopUsd(provider, requestedModel || '');
  const policy = evaluatePolicy({
    killed: ws.killed || headerKilled,
    failMode: ws.fail_mode,
    monthlySpentUsd: spend.monthly,
    dailySpentUsd: spend.daily,
    monthlyBudgetUsd: Number(ws.monthly_budget_usd) || 0,
    dailyBudgetUsd: Number(ws.daily_budget_usd) || 0,
    trapHit,
    estimatedNextUsd
  });

  if (!policy.allow) {
    if (policy.code === 'BUDGET') {
      await markKilled(ws.id, policy.message);
    }
    const blocked = JSON.stringify({ error: policy.code, message: policy.message });
    if (idem) await rememberIdempotent(gz, idem, ws.id, policy.status, blocked);
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
  const outboundBody = prepareOutboundBody(rawBody, route.routedModel, provider);
  const stream = bodyWantsStream(rawBody);

  let upstreamAuth = '';
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
    if (FORWARD.has(k.toLowerCase())) headers.set(k, v);
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
    const failBody = JSON.stringify({ error: 'upstream_failed', detail: msg });
    if (idem) await rememberIdempotent(gz, idem, ws.id, 504, failBody);
    const wrote = await insertLedger({
      workspace_id: ws.id,
      idempotency_key: idem || null,
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

  if (stream && upstream.body) {
    return streamUpstream({
      upstream,
      ws,
      gz,
      idem,
      provider,
      path,
      requestedModel,
      routeAction: route.action,
      routeRouted: route.routedModel,
      outboundBody
    });
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
  const toks = tokensFromBodyAndUsage(outboundBody || respText, upstream.ok ? usage : undefined);
  const rawCost = computeCost({
    provider,
    requestedModel: requestedModel || route.requestedModel,
    routedModel: route.routedModel,
    promptTokens: toks.promptTokens,
    completionTokens: toks.completionTokens,
    savingsFeeBps: Number(ws.savings_fee_bps) || 2000
  });
  const cost = costForCompletedHop(upstream.ok, rawCost);

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
  await maybeMeter({
    cost,
    upstreamOk: upstream.ok,
    ws,
    ledgerVia: wrote.via,
    ledgerId: wrote.id
  });

  const outHeaders = copyUpstreamHeaders(upstream);
  applyCostHeaders(outHeaders, cost, requestedModel, route.action);
  if (idem) await rememberIdempotent(gz, idem, ws.id, upstream.status, respText, outHeaders.get('content-type') || 'application/json');
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

async function streamUpstream(opts: {
  upstream: Response;
  ws: Workspace;
  gz: string;
  idem: string;
  provider: string;
  path: string;
  requestedModel: string;
  routeAction: string;
  routeRouted: string;
  outboundBody: string;
}): Promise<NextResponse> {
  const { upstream, ws, provider, path, requestedModel, routeAction, routeRouted, outboundBody, gz, idem } = opts;
  const decoder = new TextDecoder();
  let tail = '';
  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      tail = (tail + decoder.decode(chunk, { stream: true })).slice(-16_000);
      controller.enqueue(chunk);
    },
    async flush() {
      const usage = parseSseUsage(tail);
      const toks = tokensFromBodyAndUsage(outboundBody, upstream.ok ? usage : undefined);
      const rawCost = computeCost({
        provider,
        requestedModel: requestedModel || routeRouted,
        routedModel: routeRouted,
        promptTokens: toks.promptTokens,
        completionTokens: toks.completionTokens,
        savingsFeeBps: Number(ws.savings_fee_bps) || 2000
      });
      const cost = costForCompletedHop(upstream.ok, rawCost);
      const wrote = await insertLedger({
        workspace_id: ws.id,
        idempotency_key: idem || null,
        provider,
        model: cost.routedModel,
        path,
        action: routeAction,
        baseline_usd: cost.baselineUsd,
        actual_usd: cost.actualUsd,
        savings_usd: cost.savingsUsd,
        fee_usd: cost.feeUsd,
        status: upstream.status
      });
      await maybeMeter({
        cost,
        upstreamOk: upstream.ok,
        ws,
        ledgerVia: wrote.via,
        ledgerId: wrote.id
      });
      if (idem) {
        await rememberIdempotent(
          gz,
          idem,
          ws.id,
          upstream.status,
          JSON.stringify({
            error: 'idempotent_replay',
            message: 'Original hop was a stream; replay the cached status without SSE bytes.',
            status: upstream.status,
            action: routeAction
          })
        );
      }
      slog('proxy.stream', {
        workspace: ws.id,
        provider,
        action: routeAction,
        savings: cost.savingsUsd,
        fee: cost.feeUsd,
        status: upstream.status,
        ledger: wrote.ok,
        ledgerVia: wrote.via
      });
    }
  });

  const outHeaders = copyUpstreamHeaders(upstream);
  applyCostHeaders(
    outHeaders,
    {
      baselineUsd: 0,
      actualUsd: 0,
      savingsUsd: 0,
      feeUsd: 0,
      requestedModel: requestedModel || routeRouted,
      routedModel: routeRouted,
      priceFound: false
    },
    requestedModel,
    routeAction
  );
  outHeaders.set('x-gz-stream', '1');
  outHeaders.set('x-gz-ledger', 'pending');
  const piped = upstream.body!.pipeThrough(transform);
  return new NextResponse(piped, { status: upstream.status, headers: outHeaders });
}
