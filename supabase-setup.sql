-- Bekhruz IELTS — database setup
-- Run this ONCE in Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE where possible).

-- 1. Profiles table (one row per user, extends auth.users with a role)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

-- 2. Auto-create a profile row whenever someone signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Test attempts table (one row per completed test)
create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  test_path text not null,
  test_title text,
  section text,
  score int not null,
  total int not null,
  completed_at timestamptz not null default now()
);

-- 4. Helper function to check admin role without triggering RLS recursion
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- 5. Row Level Security
alter table public.profiles enable row level security;
alter table public.test_attempts enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles" on public.profiles
  for select using (public.is_admin());

drop policy if exists "Users can insert own attempts" on public.test_attempts;
create policy "Users can insert own attempts" on public.test_attempts
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can view own attempts" on public.test_attempts;
create policy "Users can view own attempts" on public.test_attempts
  for select using (auth.uid() = user_id);

drop policy if exists "Admins can view all attempts" on public.test_attempts;
create policy "Admins can view all attempts" on public.test_attempts
  for select using (public.is_admin());

-- 6. Make yourself admin — RUN THIS LAST, after you've signed up on the site
--    with your real email. Replace the email below with the one you used.
-- update public.profiles set role = 'admin' where email = 'your-real-email@example.com';
