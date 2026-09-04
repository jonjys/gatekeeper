# GateZero

Live: **[https://getgatezero.com](https://getgatezero.com)**  
Code: **[github.com/jonjys/gatezero](https://github.com/jonjys/gatezero)**

API spend router. Point one base URL at GateZero.

Ask for `gpt-4o`. We send `gpt-4o-mini` when cheaper. Hit the budget → kill. **No save → no fee.**

```
REQUEST → POLICY → ROUTE → UPSTREAM → COST → LEDGER → STRIPE
```

Cost is computed **after** the upstream hop, from real token usage.

## Try it

1. Open [getgatezero.com/start](https://getgatezero.com/start)
2. Create workspace
3. Vault a **restricted** OpenAI key (spend cap in the OpenAI dashboard — not your master key)
4. **Prove cheaper route** → `gpt-4o` → `gpt-4o-mini`
5. Optional: simulate spike → kill arms → hops return 402 until you disarm

Index of live hops: [getgatezero.com/gate](https://getgatezero.com/gate)  
Pricing: [getgatezero.com/pricing](https://getgatezero.com/pricing)

## Proxy

```
https://getgatezero.com/api/proxy/openai/v1/chat/completions
Header: x-gz-key: gz_live_…
```

Same shape for `anthropic`. Providers: `openai`, `anthropic`, `stripe`.

```http
POST /api/v1/workspace
POST /api/v1/credentials     { "provider": "openai", "secret": "sk-…" }
POST /api/v1/kill            { "action": "arm" | "disarm" }
GET  /api/v1/ledger
GET  /api/health
GET  /api/stats
```

Health: [getgatezero.com/api/health](https://getgatezero.com/api/health)

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
Do not POST `/api/*` through a `www` redirect — clients drop the body.

Required for the proxy: `GATEZERO_VAULT_KEY` (64 hex chars), Supabase service role, Stripe secret.

Apply SQL in order: `001`…`004`, then **`005_ledger_fix.sql`** (partial unique index — ignore `auto_*` keys) and **`006_spend_windows.sql`** (month/day spend RPC + durable idempotency cache).

## Not the product

Old names (`gatekeeper`, `gatekeeper-beta-three`, `gatezero-inky`) are leftover Vercel URLs. Canonical: **getgatezero.com**.

`/onboard/*`, YubiKey UI, and the Service Worker `/api/gate` path are demos. They are not the spend router.
