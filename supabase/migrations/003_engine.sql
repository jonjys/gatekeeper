-- GateZero 2.0 spend-router engine (server proxy + ledgers)
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'default',
  token_hash text not null unique,
  stripe_customer_id text,
  plan text not null default 'free',
  fail_mode text not null default 'closed' check (fail_mode in ('closed','open')),
  monthly_budget_usd numeric not null default 50,
  daily_budget_usd numeric not null default 10,
  killed boolean not null default false,
  kill_reason text,
  killed_at timestamptz,
  prefer_cheap boolean not null default true,
  savings_fee_bps int not null default 2000,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  ciphertext text not null,
  iv text not null,
  tag text not null,
  masked text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create table if not exists public.ledger_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  idempotency_key text,
  provider text not null,
  model text,
  path text,
  action text not null,
  baseline_usd numeric not null default 0,
  actual_usd numeric not null default 0,
  savings_usd numeric not null default 0,
  fee_usd numeric not null default 0,
  status int,
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create table if not exists public.billing_ledger (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text unique,
  stripe_customer_id text,
  amount_cents int not null default 0,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists ledger_ws_created on public.ledger_requests (workspace_id, created_at desc);

alter table public.workspaces enable row level security;
alter table public.provider_credentials enable row level security;
alter table public.ledger_requests enable row level security;
alter table public.billing_ledger enable row level security;

grant all on public.workspaces to service_role;
grant all on public.provider_credentials to service_role;
grant all on public.ledger_requests to service_role;
grant all on public.billing_ledger to service_role;
