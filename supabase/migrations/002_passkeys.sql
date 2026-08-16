-- Public passkey credential handles only (never private key material).
-- High-spend path (>= $5000) expects passkey + YubiKey client-side.

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  display_name text,
  passkey_credential_id text,
  passkey_created_at timestamptz,
  role text default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now(),
  unique (user_id, passkey_credential_id)
);

alter table team_members enable row level security;

create policy "Users manage own team rows"
  on team_members for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists team_members_user_idx on team_members (user_id);
