# Imorgon — 4 klick, sedan trafik

Live (efter denna push):
- `/` toll-booth landing
- `/start` skapa workspace + vault + kill
- `/api/health` engine gatezero-2.0 + kill
- `POST /api/proxy/openai/...` utan nyckel = 401

## 1. Supabase SQL Editor (gatezero-prod)
Kör i ordning:
- `supabase/migrations/003_engine.sql`
- `supabase/migrations/004_bridge.sql`

## 2. Vercel → gatekeeper → Env (Production)
```
GATEZERO_VAULT_KEY=<openssl rand -hex 32>
```
Stripe-nycklarna du redan har ska vara kvar.
Webhook: `https://gatekeeper-beta-three.vercel.app/api/webhooks/stripe`
Events: `checkout.session.completed`, `invoice.paid`

Redeploy efter env.

## 3. /start
Create workspace → spara `gz_live_…` → vault OpenAI key.

## 4. Byt endpoint i appen
`https://gatekeeper-beta-three.vercel.app/api/proxy/openai`

Kill: `/start` → Kill. Trap: `POST /api/v1/trap`.
Fee = 20% av verifierad besparing. Ingen besparing = 0 kr.
