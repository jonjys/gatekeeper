-- BridgeControl layers: honeypot traps + credential listing helpers
create table if not exists public.trap_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  secret_hash text not null,
  label text,
  created_at timestamptz not null default now(),
  unique (workspace_id, secret_hash)
);

alter table public.trap_keys enable row level security;
grant all on public.trap_keys to service_role;

create index if not exists trap_ws on public.trap_keys (workspace_id);
