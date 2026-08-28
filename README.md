# GateZero

Live: [https://gatekeeper-beta-three.vercel.app/](https://gatekeeper-beta-three.vercel.app/)

API spend router. Point traffic at `/api/proxy/{provider}/...`.
Policy, cheaper-model routing, ledger. **20% of verified savings** — zero if we save nothing.

```
REQUEST → POLICY → COST → ROUTE → UPSTREAM → LEDGER → STRIPE
```

Open [`/start`](https://gatekeeper-beta-three.vercel.app/start) → vault a key → **Prove 20%**.
Index: [`/gate`](https://gatekeeper-beta-three.vercel.app/gate) · ticker: [`/live`](https://gatekeeper-beta-three.vercel.app/live)

## Honest secrets

Server proxy stores provider keys AES-256-GCM (`GATEZERO_VAULT_KEY`).
Decrypted in memory for the upstream hop. We do not claim the money path is keyless.

## Control plane

- `POST /api/v1/workspace` then `POST /api/v1/credentials`
- `POST /api/v1/kill` `{ action: "arm" | "disarm" }`
- `GET /api/v1/ledger` · `GET /api/stats`
- Header: `x-gz-key: gz_live_…`

```
npm test && npm run typecheck && npm run build
```
