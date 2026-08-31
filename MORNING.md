# Live — getgatezero.com

Prod: https://getgatezero.com
Proxy: `https://getgatezero.com/api/proxy/openai/v1/chat/completions`
Stripe webhook: `https://getgatezero.com/api/webhooks/stripe`

SQL 003+004 is on Gatezero-prod. Vault key is in Vercel.
Workspace + OpenAI vault + proxy 200 are live.

## Domain
Apex `getgatezero.com` must be primary. Do **not** 308 POST `/api/*` to www —
clients will drop the body. Redirect `www` → apex, never the other way.

## Optional SQL
`supabase/migrations/005_ledger_fix.sql` — unique index that ignores auto_* keys.
