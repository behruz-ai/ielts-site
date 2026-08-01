-- Bekhruz IELTS -- manual completion tracking
-- Run this ONCE in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run.
--
-- Separate from test_attempts (which stores real scores from auto-detection)
-- because automatic score detection has proven unreliable across this many
-- different test-file generations. This lets a student directly tick "I did
-- this" on a catalog card regardless of whether a score was ever captured --
-- a plain checkbox, not something that pollutes score-based averages/Insights
-- with fake zero-score rows.

create table if not exists public.completed_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  test_path text not null,
  completed_at timestamptz not null default now(),
  unique (user_id, test_path)
);

alter table public.completed_tests enable row level security;

drop policy if exists "Users can view own completions" on public.completed_tests;
create policy "Users can view own completions" on public.completed_tests
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own completions" on public.completed_tests;
create policy "Users can insert own completions" on public.completed_tests
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete own completions" on public.completed_tests;
create policy "Users can delete own completions" on public.completed_tests
  for delete using (auth.uid() = user_id);

drop policy if exists "Admins can view all completions" on public.completed_tests;
create policy "Admins can view all completions" on public.completed_tests
  for select using (public.is_admin());
