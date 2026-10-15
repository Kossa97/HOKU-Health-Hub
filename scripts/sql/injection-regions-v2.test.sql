\set ON_ERROR_STOP on
-- Trockenlauf fuer supabase-injection-regions-v2.sql.
-- Nur gegen ein Wegwerf-PostgreSQL 16. Synthetische Punkte auf der Haut des
-- Modells (dieselben wie in src/lib/injectionGeometry.test.ts), mit den
-- alten, falschen Namen gespeichert -- so wie sie in Prod lagen.
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth; create table auth.users (id uuid primary key);
insert into auth.users values ('00000000-0000-4000-8000-00000000000a');
create table public.injection_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  site text not null, logged_at timestamptz not null default now(),
  body_region text, body_side text, model_version text, position jsonb, normal jsonb);

insert into public.injection_logs (user_id, site, model_version, body_region, body_side, position, normal) values
  ('00000000-0000-4000-8000-00000000000a', 'chest_right',  'placeholder-v1', 'chest',   'right', '{"x":0.12,"y":0.68,"z":0.16}',  '{"x":0,"y":0,"z":1}'),   -- Bauch
  ('00000000-0000-4000-8000-00000000000a', 'abdomen_left', 'placeholder-v1', 'abdomen', 'left',  '{"x":-0.2,"y":0.1,"z":0.12}',  '{"x":0,"y":0,"z":1}'),   -- Oberschenkel oben
  ('00000000-0000-4000-8000-00000000000a', 'thigh_right',  'placeholder-v1', 'thigh',   'right', '{"x":0.2,"y":-0.8,"z":0.05}',  '{"x":0,"y":0,"z":1}'),   -- Unterschenkel
  ('00000000-0000-4000-8000-00000000000a', 'abdomen_right','placeholder-v1', 'abdomen', 'right', '{"x":0.17,"y":0.42,"z":-0.21}','{"x":0,"y":0,"z":-1}'),  -- Gesaess
  ('00000000-0000-4000-8000-00000000000a', 'chest_right',  'placeholder-v1', 'chest',   'right', '{"x":0.42,"y":1.1,"z":-0.03}', '{"x":0,"y":0,"z":1}'),   -- Schulter
  ('00000000-0000-4000-8000-00000000000a', 'deltoid_left', 'placeholder-v1', 'deltoid', 'left',  '{"x":-0.55,"y":0.87,"z":-0.09}', null),                   -- Oberarm, ohne Normale
  ('00000000-0000-4000-8000-00000000000a', 'abdomen_center','placeholder-v1','abdomen', 'center','{"x":0.03,"y":0.25,"z":0.1}',  '{"x":0,"y":0,"z":1}'),   -- Leiste
  ('00000000-0000-4000-8000-00000000000a', 'abdomen',      null,             null,      null,    null, null);                                               -- alter Eintrag

\ir ../../supabase-injection-regions-v2.sql
\ir ../../supabase-injection-regions-v2.sql

create function pg_temp.expect(ok boolean, what text) returns void language plpgsql as $$
begin if not ok then raise exception 'FEHLGESCHLAGEN: %', what; end if; end $$;

select pg_temp.expect(
  (select array_agg(body_region || '_' || body_side order by (position->>'y')::float8 desc) from public.injection_logs where model_version = 'placeholder-v1')
  = array['deltoid_right', 'upper_arm_left', 'abdomen_right', 'glute_right', 'outside_typical_center', 'thigh_left', 'lower_leg_right'],
  'neue Regionen');
select pg_temp.expect(bool_and(site = body_region || '_' || body_side), 'site') from public.injection_logs where model_version = 'placeholder-v1';
select pg_temp.expect((select site = 'abdomen' and body_region is null from public.injection_logs where model_version is null), 'alter Eintrag unberuehrt');
select pg_temp.expect((select count(*) = 7 from public.injection_logs_region_backup_v2), 'Sicherung');
select pg_temp.expect((select b.body_region = 'chest' from public.injection_logs_region_backup_v2 b join public.injection_logs l using (id) where l.body_region = 'abdomen'), 'Sicherung haelt alten Namen');
select pg_temp.expect(not has_table_privilege('authenticated', 'public.injection_logs_region_backup_v2', 'select'), 'Sicherung fuer Nutzer unsichtbar');

-- Rueckweg
update public.injection_logs l set body_region = b.body_region, body_side = b.body_side, site = b.site
from public.injection_logs_region_backup_v2 b where b.id = l.id;
select pg_temp.expect((select count(*) = 2 from public.injection_logs where body_region = 'chest'), 'Rueckweg');
\echo 'injection-regions-v2: alle Pruefungen bestanden'
