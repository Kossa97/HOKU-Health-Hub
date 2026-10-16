\set ON_ERROR_STOP on
-- Trockenlauf fuer supabase-injection-testaccount-sites.sql, danach
-- supabase-injection-regions-v2.sql. Nur gegen ein Wegwerf-PostgreSQL 16.
-- Stellt den Prod-Zustand nach: Seed-Pins des Testkontos (ohne uv, Namen
-- passen nicht zur Position) und echte Long-Press-Pins eines anderen
-- Kontos (mit uv, alter Name).
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth; create table auth.users (id uuid primary key, email text);
insert into auth.users values
  ('00000000-0000-4000-8000-00000000000a', 'test1@trackyourdose.test'),
  ('00000000-0000-4000-8000-00000000000b', 'jemand@example.org');
create table public.injection_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  site text not null, logged_at timestamptz not null default now(),
  body_region text, body_side text, model_version text, position jsonb, normal jsonb, uv jsonb);

-- Testkonto: wie das Seed-Skript (86/86 Bauch, 26/26 Oberschenkel), hier verkleinert.
insert into public.injection_logs (user_id, site, model_version, body_region, body_side, position, normal)
select '00000000-0000-4000-8000-00000000000a', r || '_' || s, 'placeholder-v1', r, s,
  jsonb_build_object('x', case s when 'left' then -0.18 else 0.18 end, 'y', y + (g % 5) * 0.004, 'z', 0.14),
  '{"x":0,"y":-0.2,"z":0.9}'
from (values ('abdomen', 'left', 0.03), ('abdomen', 'right', -0.11), ('thigh', 'left', -0.42), ('thigh', 'right', -0.42)) v(r, s, y),
     generate_series(1, 20) g;
-- Testkonto, aber per App gesetzt (uv): bleibt
insert into public.injection_logs (user_id, site, model_version, body_region, body_side, position, normal, uv) values
  ('00000000-0000-4000-8000-00000000000a', 'abdomen_left', 'placeholder-v1', 'abdomen', 'left', '{"x":-0.2,"y":0.1,"z":0.12}', '{"x":0,"y":0,"z":1}', '{"u":0.1,"v":0.2}');
-- Anderes Konto: echter Pin, alter Name „Bauch“ fuer den Oberschenkel; bleibt hier, regions-v2 benennt ihn um.
insert into public.injection_logs (user_id, site, model_version, body_region, body_side, position, normal, uv) values
  ('00000000-0000-4000-8000-00000000000b', 'abdomen_left', 'placeholder-v1', 'abdomen', 'left', '{"x":-0.2,"y":0.1,"z":0.12}', '{"x":0,"y":0,"z":1}', '{"u":0.1,"v":0.2}'),
  ('00000000-0000-4000-8000-00000000000b', 'abdomen', null, null, null, null, null, null);

create table pg_temp.vorher as select * from public.injection_logs;

\ir ../../supabase-injection-testaccount-sites.sql
create table pg_temp.nach_erstem as select * from public.injection_logs;
\ir ../../supabase-injection-testaccount-sites.sql

create function pg_temp.expect(ok boolean, what text) returns void language plpgsql as $$
begin if not ok then raise exception 'FEHLGESCHLAGEN: %', what; end if; end $$;

select pg_temp.expect((select count(*) = 80 from public.injection_logs_position_backup_testaccount), 'Sicherung: genau die 80 Seed-Pins');
select pg_temp.expect(not exists (
  select from public.injection_logs l join pg_temp.vorher v using (id)
  where l.position is distinct from v.position and l.uv is not null), 'Pins mit uv unberuehrt');
select pg_temp.expect(not exists (
  select from public.injection_logs l join pg_temp.vorher v using (id)
  where (l.site, l.body_region, l.body_side, l.model_version) is distinct from (v.site, v.body_region, v.body_side, v.model_version)), 'Namen unberuehrt');
select pg_temp.expect(not exists (
  select from public.injection_logs l join pg_temp.nach_erstem n using (id) where l.position is distinct from n.position), 'zweiter Lauf aendert nichts');
select pg_temp.expect((select count(*) = 80 from public.injection_logs l join pg_temp.vorher v using (id) where l.position is distinct from v.position), '80 Pins verschoben');
select pg_temp.expect((select bool_and(abs((position->>'y')::float8 - 0.68) <= 0.02) from public.injection_logs where uv is null and body_region = 'abdomen'), 'Bauch bei y 0.68');
select pg_temp.expect((select bool_and(abs((position->>'y')::float8 + 0.1) <= 0.02) from public.injection_logs where uv is null and body_region = 'thigh'), 'Oberschenkel bei y -0.1');
select pg_temp.expect((select count(distinct position) = 80 from public.injection_logs where uv is null and model_version = 'placeholder-v1'), 'Pins liegen nicht aufeinander');

-- Danach regions-v2 (zweimal): die Seed-Pins behalten ihren Namen, nur die echten Pins werden umbenannt.
\ir ../../supabase-injection-regions-v2.sql
\ir ../../supabase-injection-regions-v2.sql
select pg_temp.expect(not exists (
  select from public.injection_logs l join pg_temp.vorher v using (id)
  where l.uv is null and l.site is distinct from v.site), 'regions-v2 laesst die verschobenen Seed-Pins in Ruhe');
select pg_temp.expect((select count(*) = 2 from public.injection_logs where uv is not null and site = 'thigh_left'), 'regions-v2 benennt echte Pins um');
select pg_temp.expect((select site = 'abdomen' from public.injection_logs where model_version is null), 'alter Eintrag unberuehrt');

-- Rueckweg
update public.injection_logs l set position = b.position, normal = b.normal
from public.injection_logs_position_backup_testaccount b where b.id = l.id;
select pg_temp.expect(not exists (
  select from public.injection_logs l join pg_temp.vorher v using (id) where l.position is distinct from v.position), 'Rueckweg');
\echo 'injection-testaccount-sites: alle Pruefungen bestanden'
