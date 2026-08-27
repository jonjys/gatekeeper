# GateZero 2.0 — API spend router

Canonical repo. Promptslaktaren/BridgeControl is read-only reference.

Customer systems send traffic through `/api/proxy/{provider}/...`.
Policy + cost engine + cheaper-model routing run automatically.
Verified savings → 20% success fee via Stripe meter `api_proxy_usage`.
No savings → no success fee.

## Honest secrets

- **Server proxy (money path):** provider API keys stored encrypted at rest (`GATEZERO_VAULT_KEY`, AES-256-GCM). Decrypted only in memory for the upstream hop.
- **Browser SW (`/api/gate/…`):** keys stay in IndexedDB under Web Locks. Not a substitute for backend proxy.

## Flow

REQUEST → POLICY → COST ENGINE → ROUTING → UPSTREAM → LEDGER → STRIPE METER

## Onboard

1. Run `supabase/migrations/003_engine.sql`
2. Set env (see `.env.example`)
3. `POST /api/v1/workspace` → `gz_live_…`
4. `POST /api/v1/credentials` once
5. Swap base URL to `/api/proxy/openai`

## Scripts

```
npm test
npm run typecheck
npm run lint
npm run build
```
