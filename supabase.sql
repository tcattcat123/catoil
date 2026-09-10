-- Pixel World accounts: nickname-only login, no passwords.
-- Run this in Supabase SQL editor, then paste project URL + anon key into chuv.html (SUPABASE_URL / SUPABASE_KEY).
create table if not exists profiles (
  nickname text primary key,
  cid text not null,
  created_at timestamptz default now(),
  last_seen timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "open read" on profiles;
create policy "open read" on profiles for select using (true);

drop policy if exists "open insert" on profiles;
create policy "open insert" on profiles for insert with check (true);

drop policy if exists "open update" on profiles;
create policy "open update" on profiles for update using (true);
