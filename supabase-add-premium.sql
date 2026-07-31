-- Bekhruz IELTS — Premium access migration
-- Run this ONCE in Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run.

-- 1. Add the premium flag to profiles
alter table public.profiles add column if not exists is_premium boolean not null default false;

-- 2. Let admins update any profile (needed so the Admin dashboard's
--    Premium toggle button works) — restricted to admins only via is_admin().
drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- 3. Manual one-off grant (optional — the Admin dashboard now has a toggle
--    button for this too, so you don't need to run this by hand anymore).
-- update public.profiles set is_premium = true where email = 'someone@example.com';
