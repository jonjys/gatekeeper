# Live — weekend max

SQL 003+004 is already on Gatezero-prod. Vault key is in Vercel.
Workspace + OpenAI vault + proxy 200 are live.

## This deploy
- Ledger writes every hop (errors included). GET-only cache. POST never cached.
- Fallback write to `billing_ledger` if `ledger_requests` rejects a row.
- `/start` has Ping models / Send hi — no PowerShell.
- Probe: `GET /api/v1/ledger?probe=1` with `x-gz-key`.

## Optional Monday SQL
`supabase/migrations/005_ledger_fix.sql` — unique index that ignores auto_* keys.
