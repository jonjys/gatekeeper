create table if not exists keys_meta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  key_name text not null,
  provider text not null,
  last_used timestamptz,
  usage_count int default 0,
  created_at timestamptz default now(),
  unique (user_id, key_name)
);

alter table keys_meta enable row level security;

create policy "Users own keys"
  on keys_meta for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists usage_events (
  id bigserial primary key,
  user_id uuid references auth.users,
  key_id uuid references keys_meta,
  provider text not null,
  cost_usd numeric(10,6),
  status int,
  created_at timestamptz default now()
);

alter table usage_events enable row level security;

create policy "Users own usage"
  on usage_events for select
  using (auth.uid() = user_id);

create policy "Users insert own usage"
  on usage_events for insert
  with check (auth.uid() = user_id);

create table if not exists billing_accounts (
  user_id uuid primary key references auth.users,
  stripe_customer_id text,
  plan text default 'free',
  take_rate numeric(3,2) default 2.00,
  created_at timestamptz default now()
);

alter table billing_accounts enable row level security;

create policy "Users own billing"
  on billing_accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
