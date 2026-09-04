-- Accurate month/day spend for fail-closed budget (not last-N rows).
-- Durable idempotency so serverless retries do not double-hop or double-meter.

create or replace function public.workspace_spend_windows(p_workspace uuid)
returns table (monthly numeric, daily numeric)
language sql
stable
as $$
  select
    coalesce(sum(actual_usd) filter (
      where created_at >= date_trunc('month', timezone('utc', now()))
    ), 0) as monthly,
    coalesce(sum(actual_usd) filter (
      where created_at >= date_trunc('day', timezone('utc', now()))
    ), 0) as daily
  from public.ledger_requests
  where workspace_id = p_workspace
    and action not in ('probe', 'spike')
    and lower(coalesce(provider, '')) <> 'sim';
$$;

grant execute on function public.workspace_spend_windows(uuid) to service_role;

create table if not exists public.idempotency_cache (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  idempotency_key text not null,
  status int not null,
  body text not null,
  content_type text not null default 'application/json',
  created_at timestamptz not null default now(),
  primary key (workspace_id, idempotency_key)
);

create index if not exists idempotency_cache_created
  on public.idempotency_cache (created_at desc);

alter table public.idempotency_cache enable row level security;
grant all on public.idempotency_cache to service_role;
