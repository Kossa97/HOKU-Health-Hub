-- Profil, Teilprojekt 1 (Datenbasis): Profilfelder, Koerpermasse, Gesundheitsdaten
-- je Tag und der private Speicher fuer Profil- und Titelbild.
--
-- Rein additiv und idempotent: neue Spalten (add column if not exists), zwei neue
-- Tabellen (create table if not exists), Pruefungen nur wenn noch nicht da,
-- Policies per drop policy if exists + create policy, Bucket per on conflict do
-- update (bleibt privat, hoechstens 1 MB, nur JPEG). Nichts wird geloescht oder
-- umgeschrieben; bestehende Profilzeilen
-- behalten alle Werte (neue Spalten: goals = '{}', der Rest NULL).
--
-- Ausfuehren: Supabase -> SQL Editor -> diese Datei einfuegen -> Run.
-- Danach pruefen (Erwartung in Klammern):
--   select count(*) from information_schema.columns
--    where table_schema = 'public' and table_name = 'profiles'
--      and column_name in ('goals','country','profile_gender','avatar_path',
--                          'cover_path','measurement_sites','health_store_consent_at');   -- 7
--   select count(*) from pg_class
--    where relname in ('body_measurements','health_daily') and relkind = 'r'
--      and relrowsecurity = true;                                                          -- 2
--   select count(*) from storage.buckets
--    where id = 'profile-media' and public = false and file_size_limit = 1048576
--      and allowed_mime_types = '{image/jpeg}';                                            -- 1
--   select count(*) from pg_policies
--    where schemaname = 'public' and tablename = 'health_daily';                           -- 4
--   select count(*) from public.profiles;                         -- unveraendert gegenueber vorher
--
-- Stellenliste (Koerpermasse): neck, chest, waist, belly, hips, upper_arm, forearm,
-- thigh, calf. Muss mit der Liste im Code uebereinstimmen.

begin;

-- 1. Profilfelder. Alle freiwillig (NULL bzw. leere Liste = keine Angabe).
alter table public.profiles
  add column if not exists goals text[] not null default '{}',
  add column if not exists country text,
  add column if not exists profile_gender text,
  add column if not exists avatar_path text,
  add column if not exists cover_path text,
  add column if not exists measurement_sites text[] not null default '{}',
  add column if not exists health_store_consent_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_goals_values' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_goals_values
      check (goals <@ array['fettabbau', 'muskelaufbau', 'recomp', 'kraft', 'ausdauer',
                            'longevity', 'blutwerte', 'schlaf', 'wohlbefinden']::text[]);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_country_format' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_country_format
      check (country is null or country ~ '^[A-Z]{2}$');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_profile_gender_values' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_profile_gender_values
      check (profile_gender is null or profile_gender in ('male', 'female', 'diverse'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_measurement_sites_values' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_measurement_sites_values
      check (measurement_sites <@ array['neck', 'chest', 'waist', 'belly', 'hips',
                                        'upper_arm', 'forearm', 'thigh', 'calf']::text[]);
  end if;
end;
$$;

-- 2. Koerpermasse: ein Wert je Nutzer, Tag und Koerperstelle.
create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  measured_on date not null,
  site text not null,
  value_cm numeric(5,1) not null check (value_cm between 10 and 250),
  created_at timestamptz default now(),
  unique (user_id, measured_on, site)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'body_measurements_site_values' and conrelid = 'public.body_measurements'::regclass
  ) then
    alter table public.body_measurements add constraint body_measurements_site_values
      check (site in ('neck', 'chest', 'waist', 'belly', 'hips',
                      'upper_arm', 'forearm', 'thigh', 'calf'));
  end if;
end;
$$;

create index if not exists body_measurements_user_day_idx
  on public.body_measurements (user_id, measured_on);

alter table public.body_measurements enable row level security;
drop policy if exists "Own body measurements" on public.body_measurements;
create policy "Own body measurements" on public.body_measurements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Gesundheitsdaten je Tag (aus Apple Health / Health Connect).
create table if not exists public.health_daily (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  steps int,
  resting_hr numeric(5,1),
  sleep_min int,
  active_kcal int,
  spo2_pct numeric(4,1),
  resp_rate numeric(4,1),
  bp_sys int,
  bp_dia int,
  source text not null check (source in ('healthkit', 'health_connect')),
  updated_at timestamptz default now(),
  primary key (user_id, day)
);

alter table public.health_daily enable row level security;
-- Lesen und Loeschen immer (Loeschen auch nach Widerruf). Schreiben nur mit
-- Einwilligung im eigenen Profil: ein Abgleich, der den Widerruf verpasst hat,
-- wird hier abgewiesen (Art. 9 Abs. 2 lit. a DSGVO).
drop policy if exists "Own health daily" on public.health_daily;
drop policy if exists "Own health daily select" on public.health_daily;
create policy "Own health daily select" on public.health_daily
  for select using (auth.uid() = user_id);
drop policy if exists "Own health daily delete" on public.health_daily;
create policy "Own health daily delete" on public.health_daily
  for delete using (auth.uid() = user_id);
drop policy if exists "Own health daily insert with consent" on public.health_daily;
create policy "Own health daily insert with consent" on public.health_daily
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.health_store_consent_at is not null)
  );
drop policy if exists "Own health daily update with consent" on public.health_daily;
create policy "Own health daily update with consent" on public.health_daily
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.health_store_consent_at is not null)
  );

-- 4. Privater Speicher fuer Profil- und Titelbild; Ordner = Nutzer-ID.
-- Die App laedt nur JPEG bis 500 KB hoch; der Bucket laesst hoechstens 1 MB JPEG zu.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', false, 1048576, '{image/jpeg}')
on conflict (id) do update set public = false, file_size_limit = 1048576, allowed_mime_types = '{image/jpeg}';

drop policy if exists "Own profile media select" on storage.objects;
create policy "Own profile media select" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Own profile media insert" on storage.objects;
create policy "Own profile media insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Own profile media update" on storage.objects;
create policy "Own profile media update" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Own profile media delete" on storage.objects;
create policy "Own profile media delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
