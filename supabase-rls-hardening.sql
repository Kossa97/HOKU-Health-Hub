-- ============================================================
-- RLS-Härtung für geteilte Referenzdaten (pk_profiles, peptide_library)
-- Im Supabase SQL Editor ausführen.
--
-- Vorher: pk_profiles war für JEDEN (auch anonym) beschreibbar,
-- peptide_library für jeden eingeloggten User. Beides sind geteilte
-- Referenzdaten, auf denen Blutspiegel-Simulation und Peptipedia
-- basieren — Schreibzugriff gehört nur Admins (profiles.is_admin),
-- analog zum bestehenden Admin-Check im Admin-Panel (/lab/admin).
--
-- Seed-Skripte (scripts/seed-pk-profiles.ts) nutzen den Service-Key
-- und umgehen RLS — sie funktionieren weiterhin.
-- ============================================================

-- Admin-Flag sicherstellen (wird vom Admin-Panel bereits gelesen)
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Zentraler Admin-Check. SECURITY DEFINER, damit die Funktion unabhängig
-- von den RLS-Policies auf profiles auswerten kann.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  )
$$;

revoke all on function public.is_admin() from public;
-- Nur angemeldete: alle Policies mit is_admin() gelten fuer `authenticated`
-- (siehe supabase-function-grants.sql). Frueher stand hier auch `anon`.
grant execute on function public.is_admin() to authenticated;

-- ── pk_profiles: lesen alle, schreiben nur Admins ───────────────────────

drop policy if exists "pk_profiles_insert" on public.pk_profiles;
create policy "pk_profiles_insert"
  on public.pk_profiles for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "pk_profiles_update" on public.pk_profiles;
create policy "pk_profiles_update"
  on public.pk_profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "pk_profiles_delete" on public.pk_profiles;
create policy "pk_profiles_delete"
  on public.pk_profiles for delete
  to authenticated
  using (public.is_admin());

-- ── peptide_library: lesen alle, schreiben nur Admins ───────────────────

drop policy if exists "authenticated_insert" on public.peptide_library;
create policy "peptide_library_admin_insert"
  on public.peptide_library for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "authenticated_update" on public.peptide_library;
create policy "peptide_library_admin_update"
  on public.peptide_library for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "peptide_library_admin_delete" on public.peptide_library;
create policy "peptide_library_admin_delete"
  on public.peptide_library for delete
  to authenticated
  using (public.is_admin());

-- Eigenen Account zum Admin machen (E-Mail anpassen):
-- update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'devinko97@gmail.com');
