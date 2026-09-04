# GateZero

Live: **[https://getgatezero.com](https://getgatezero.com)**  
Code: **[github.com/jonjys/gatezero](https://github.com/jonjys/gatezero)**

API spend router. Point one base URL at GateZero.

Ask for `gpt-4o` or Claude sonnet. We send the cheap alias when cheaper. Hit the budget → kill. **No save → no fee.**

```
REQUEST → POLICY → ROUTE → UPSTREAM → COST → LEDGER → STRIPE
```

Cost is computed **after** the upstream hop, from real token usage.

## Try it

1. Open [getgatezero.com/start](https://getgatezero.com/start)
2. Create workspace
3. Vault a **restricted** OpenAI or Anthropic key (spend cap in the vendor dashboard — not your master key)
4. **Prove cheaper route** → `gpt-4o` → `gpt-4o-mini` (or Claude sonnet → haiku)
5. Copy the hop URL. Optional: arm kill — hops return 402 until you disarm. Real budget kill is monthly cap, not the demo spike.

Index of live hops: [getgatezero.com/gate](https://getgatezero.com/gate)  
Pricing: [getgatezero.com/pricing](https://getgatezero.com/pricing)

## Proxy

```
https://getgatezero.com/api/proxy/openai/v1/chat/completions
Header: x-gz-key: gz_live_…
```

Anthropic:

```
https://getgatezero.com/api/proxy/anthropic/v1/messages
Header: x-gz-key: gz_live_…
```

Routable providers (cheaper-model table): `openai`, `anthropic`. Stripe API may be proxied as passthrough with $0 savings — it is not a spend-routed model.

```http
POST /api/v1/workspace
POST /api/v1/credentials     { "provider": "openai"|"anthropic", "secret": "sk-…" }
POST /api/v1/kill            { "action": "arm" | "disarm" }
PATCH /api/v1/workspace      { "monthlyBudgetUsd", "dailyBudgetUsd", "failMode", "preferCheap" }
GET  /api/v1/ledger
GET  /api/health
GET  /api/stats
POST /api/checkout           Header x-gz-key (Pro / Enterprise)
POST /api/portal             Header x-gz-key
```

Errors are `{ error, message?, hint?, detail? }` with a stable HTTP status. Policy blocks use `error: KILL | BUDGET | DAILY_CAP | TRAP`.

Health: [getgatezero.com/api/health](https://getgatezero.com/api/health)

Streaming (`stream: true`) returns tokens immediately. Cost headers on the stream response are `0` with `x-gz-ledger: pending` until flush — read the ledger after the stream ends. OpenAI hops request `stream_options.include_usage`. Anthropic usage is parsed from `message_start` / `message_delta` SSE.

## Billing

Seat $0 / $29 / $299. Success fee is 20% of verified savings (15% Enterprise), **$0 if we do not save**. Stripe meters the fee only after Checkout binds a `cus_` to the workspace. Free tracks the fee on the ledger.

## Secrets (honest)

The **money path is a server proxy**. Provider keys are stored AES-256-GCM (`GATEZERO_VAULT_KEY`) and decrypted in memory for the upstream hop.

We do **not** claim keys never leave the device. Use a restricted key with a cap. Burn it anytime.

## Stack

Next.js 14 · TypeScript · Supabase (ledger + workspaces) · Stripe (seats + meter) · Vercel

Money path lives in `lib/engine/proxy-handler.ts` (`handleProxy`).

```
npm test && npm run typecheck && npm run build
```

## Env

See `.env.example`. Production site URL is **https://getgatezero.com** (apex).  
Stripe webhook: `https://getgatezero.com/api/webhooks/stripe`  
Events: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_succeeded`.  
Do not POST `/api/*` through a `www` redirect — clients drop the body.

Required for the proxy: `GATEZERO_VAULT_KEY` (64 hex chars), Supabase service role, Stripe secret.

## Not the product

Old names (`gatekeeper`, `gatekeeper-beta-three`, `gatezero-inky`) are leftover Vercel URLs. Canonical: **getgatezero.com**.

`/onboard/*`, YubiKey UI, and `/api/gate` are demos. They are not the spend router. The app unregisters leftover Service Workers so `/api/gate` is not mistaken for `/api/proxy`.
