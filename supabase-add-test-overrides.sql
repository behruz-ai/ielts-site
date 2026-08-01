-- Bekhruz IELTS -- admin-editable content categorization for Premium passages
-- Run this ONCE in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run.
--
-- tests.json ships a default `access` ("free" | "premium") per passage, but
-- that file is static and redeployed by the developer, not something the
-- admin can edit live. This table lets the admin move any premium-passage
-- test between Free / Premium / Real Exam from the Admin Dashboard without
-- a code change. Every visitor's catalog page reads this table (public
-- select) to know the *current* category; only an admin can write to it.
-- A row's absence just means "use the tests.json default".

create table if not exists public.test_overrides (
  test_path text primary key,
  access text not null check (access in ('free', 'premium', 'real-exam')),
  updated_at timestamptz not null default now()
);

alter table public.test_overrides enable row level security;

drop policy if exists "Anyone can view overrides" on public.test_overrides;
create policy "Anyone can view overrides" on public.test_overrides
  for select using (true);

drop policy if exists "Admins can insert overrides" on public.test_overrides;
create policy "Admins can insert overrides" on public.test_overrides
  for insert with check (public.is_admin());

drop policy if exists "Admins can update overrides" on public.test_overrides;
create policy "Admins can update overrides" on public.test_overrides
  for update using (public.is_admin());

drop policy if exists "Admins can delete overrides" on public.test_overrides;
create policy "Admins can delete overrides" on public.test_overrides
  for delete using (public.is_admin());
