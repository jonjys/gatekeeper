# GateZero — BridgeControl Solo

Canonical API spend router. `promptslaktaren` is read-only reference.

Customer systems send traffic through `/api/proxy/{provider}/...`.
Policy + cost engine + cheaper-model routing run automatically.
Verified savings → 20% success fee via Stripe meter `api_proxy_usage`.
No savings → no success fee.

```
REQUEST → POLICY → COST → ROUTE → UPSTREAM → LEDGER → STRIPE
```

## Honest secrets

Server proxy stores provider keys AES-256-GCM at rest (`GATEZERO_VAULT_KEY`).
Decrypted in memory for the upstream hop. Optional browser SW vault is separate
and on-device. We do not claim the money path is keyless.

## Onboard

See `MORNING.md`. Short path:

1. SQL `003_engine.sql` + `004_bridge.sql`
2. Env from `.env.example`
3. Open `/start` or `POST /api/v1/workspace`
4. `POST /api/v1/credentials`
5. Swap base URL to `/api/proxy/openai`

## Control plane

- `POST /api/v1/kill` `{ action: "arm" | "disarm" }`
- `POST /api/v1/trap` honeypot key → 451
- `DELETE /api/v1/credentials?provider=openai` burn
- `GET /api/v1/ledger`

## Scripts

```
npm test && npm run typecheck && npm run lint && npm run build
```
