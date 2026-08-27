# Imorgon — 4 klick, sedan trafik

Live nu:
- https://gatekeeper-beta-three.vercel.app/api/health  → engine: gatezero-2.0
- https://gatekeeper-beta-three.vercel.app/start
- POST /api/proxy/openai/... utan nyckel = 401 (rätt)

## 1. Supabase SQL Editor (gatezero-prod)
Kör filen `supabase/migrations/003_engine.sql`

## 2. Vercel → gatekeeper → Env
Lägg till (Production):
```
GATEZERO_VAULT_KEY=<64 hex-tecken, openssl rand -hex 32>
```
Stripe-nycklarna du redan har ska vara kvar.
Webhook-URL:
`https://gatekeeper-beta-three.vercel.app/api/webhooks/stripe`
events: `checkout.session.completed`, `invoice.paid`

Redeploy efter env.

## 3. Workspace
```
curl -s -X POST https://gatekeeper-beta-three.vercel.app/api/v1/workspace \
  -H 'content-type: application/json' \
  -d '{"monthlyBudgetUsd":50,"dailyBudgetUsd":10}'
```
Spara `token` (`gz_live_…`).

## 4. Credential en gång
```
curl -s -X POST https://gatekeeper-beta-three.vercel.app/api/v1/credentials \
  -H 'content-type: application/json' \
  -H "x-gz-key: gz_live_…" \
  -d '{"provider":"openai","secret":"sk-..."}'
```

Sedan: byt app-bas till
`https://gatekeeper-beta-three.vercel.app/api/proxy/openai`

Fee = 20% av verifierad besparing. Ingen besparing = 0 kr.
