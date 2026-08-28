-- Idempotent ledger hardening. Safe to re-run Monday.
-- Partial unique: only real client idempotency keys, never auto_* probes.

alter table public.ledger_requests drop constraint if exists ledger_requests_workspace_id_idempotency_key_key;

create unique index if not exists ledger_idem_uniq
  on public.ledger_requests (workspace_id, idempotency_key)
  where idempotency_key is not null
    and idempotency_key not like 'auto_%'
    and idempotency_key not like 'retry_%';

grant all on public.ledger_requests to service_role;
grant all on public.billing_ledger to service_role;
