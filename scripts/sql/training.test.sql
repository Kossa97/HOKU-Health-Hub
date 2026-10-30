\set ON_ERROR_STOP on
-- Trockenlauf fuer supabase-training.sql und supabase-training-v2.sql.
-- Nur gegen ein Wegwerf-PostgreSQL 16 (siehe CLAUDE.md, Datenbankaenderungen).
-- Die Migration legt nur neue Tabellen an; nachgestellt wird deshalb nur, was
-- sie voraussetzt (auth.users, auth.uid(), Rollen). Synthetische Daten.
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
insert into auth.users values ('00000000-0000-4000-8000-00000000000a'), ('00000000-0000-4000-8000-00000000000b');

-- Zweimal: die zweite Ausfuehrung darf nichts aendern und nicht scheitern.
\ir ../../supabase-training.sql
\ir ../../supabase-training.sql

create function pg_temp.expect(ok boolean, what text) returns void language plpgsql as $$
begin if not ok then raise exception 'FEHLGESCHLAGEN: %', what; end if; end $$;

select pg_temp.expect((select count(*) = 16 from pg_policies where schemaname = 'public' and tablename like 'training_%'), 'P 16 Policies, keine doppelt');
select pg_temp.expect((select count(*) = 4 from pg_tables where schemaname = 'public' and tablename like 'training_%' and rowsecurity), 'P RLS auf allen 4 Tabellen');

-- 1) Nutzer A legt Einheit, Routine, Uebung, Einstellungen an
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', false);
insert into public.training_sessions (kind, title, started_at, ended_at, duration_s, exercises, source)
values ('strength', 'Push', '2026-10-18T08:00:00Z', '2026-10-18T09:00:00Z', 3600,
  '[{"exerciseId":"bench_press_barbell","sets":[{"type":"normal","weightKg":80,"reps":5,"done":true}]}]', 'live');
insert into public.training_sessions (kind, started_at, duration_s, distance_m, source, external_id)
values ('run', '2026-10-17T07:00:00Z', 1800, 5000, 'healthkit', 'hk-1');
insert into public.training_routines (name, weekdays) values ('Push', '{1,4}');
insert into public.training_custom_exercises (name) values ('Meine Uebung');
reset role;

-- v2: Ist-Zustand nachgestellt (eine Routine ohne Spalte `folder`), dann die
-- Migration zweimal. Die bestehende Zeile bleibt, `folder` ist dort null.
\ir ../../supabase-training-v2.sql
\ir ../../supabase-training-v2.sql
select pg_temp.expect((select count(*) = 1 from information_schema.columns where table_schema = 'public' and table_name = 'training_routines' and column_name = 'folder'), 'V2 Spalte folder genau einmal');
select pg_temp.expect((select count(*) = 1 from public.training_routines), 'V2 Routinen nach Migration 1');
select pg_temp.expect((select folder is null from public.training_routines where name = 'Push'), 'V2 bestehende Routine ohne Ordner');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', false);
insert into public.training_routines (name, weekdays, folder) values ('Pull', '{2,5}', 'Push/Pull/Beine');
do $$ begin
  insert into public.training_routines (name, folder) values ('X', '   ');
  raise exception 'FEHLGESCHLAGEN: V2 leerer Ordner';
exception when check_violation then null; end $$;
do $$ begin
  insert into public.training_routines (name, folder) values ('X', repeat('a', 41));
  raise exception 'FEHLGESCHLAGEN: V2 Ordner zu lang';
exception when check_violation then null; end $$;
insert into public.training_settings (settings) values ('{"unit":"kg"}');

-- 2) Doppelter Import derselben Uhr-Einheit scheitert
do $$ begin
  insert into public.training_sessions (kind, started_at, source, external_id) values ('run', '2026-10-17T07:00:00Z', 'healthkit', 'hk-1');
  raise exception 'FEHLGESCHLAGEN: T2 Duplikat';
exception when unique_violation then null; end $$;

-- 2b) Import-Weg der App: on conflict do nothing ueberspringt das Duplikat,
-- ohne die bestehende Zeile anzufassen; Einheiten ohne external_id gehen beliebig oft.
insert into public.training_sessions (kind, title, started_at, source, external_id)
values ('run', 'neu', '2026-10-17T07:00:00Z', 'healthkit', 'hk-1'),
       ('run', 'neu', '2026-10-16T07:00:00Z', 'healthkit', 'hk-2')
on conflict (user_id, external_id) do nothing;
insert into public.training_sessions (kind, started_at) values ('walk', now()), ('walk', now());

-- 3) Ungueltige Werte scheitern
do $$ begin
  insert into public.training_sessions (kind, started_at) values ('tanzen', now());
  raise exception 'FEHLGESCHLAGEN: T3 kind';
exception when check_violation then null; end $$;
do $$ begin
  insert into public.training_sessions (kind, started_at, ended_at) values ('run', '2026-10-17T07:00:00Z', '2026-10-17T06:00:00Z');
  raise exception 'FEHLGESCHLAGEN: T3 Ende vor Start';
exception when check_violation then null; end $$;
do $$ begin
  insert into public.training_routines (name, weekdays) values ('X', '{8}');
  raise exception 'FEHLGESCHLAGEN: T3 Wochentag';
exception when check_violation then null; end $$;

-- 4) Fremde Zeilen: Nutzer B sieht und aendert nichts von A
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', false);
select pg_temp.expect((select count(*) = 0 from public.training_sessions), 'T4 fremde Einheiten unsichtbar');
select pg_temp.expect((select count(*) = 0 from public.training_routines), 'T4 fremde Routinen unsichtbar');
update public.training_sessions set title = 'gekapert';
delete from public.training_routines;
do $$ begin
  insert into public.training_sessions (user_id, kind, started_at) values ('00000000-0000-4000-8000-00000000000a', 'run', now());
  raise exception 'FEHLGESCHLAGEN: T4 fremde user_id';
exception when insufficient_privilege then null; end $$;
-- Gleiche external_id bei einem anderen Nutzer ist erlaubt
insert into public.training_sessions (kind, started_at, source, external_id) values ('run', '2026-10-17T07:00:00Z', 'healthkit', 'hk-1');

-- 5) anon: kein Zugriff
reset role; set role anon;
do $$ begin
  perform 1 from public.training_sessions;
  raise exception 'FEHLGESCHLAGEN: T5 anon';
exception when insufficient_privilege then null; end $$;
reset role;

-- Zaehlung (als Eigentuemer, ohne RLS)
select pg_temp.expect((select count(*) = 6 from public.training_sessions), 'Z Einheiten 6');
select pg_temp.expect((select count(*) = 1 from public.training_sessions where title = 'Push'), 'Z Titel unveraendert');
select pg_temp.expect((select title = '' from public.training_sessions where external_id = 'hk-1' and user_id = '00000000-0000-4000-8000-00000000000a'), 'Z Duplikat nicht ueberschrieben');
select pg_temp.expect((select count(*) = 2 from public.training_routines), 'Z Routinen 2');
select pg_temp.expect((select count(*) = 1 from public.training_routines where folder = 'Push/Pull/Beine'), 'Z Routinen mit Ordner 1');
select pg_temp.expect((select count(*) = 1 from public.training_custom_exercises), 'Z eigene Uebungen 1');
select pg_temp.expect((select count(*) = 1 from public.training_settings), 'Z Einstellungen 1');
\echo 'training: alle Pruefungen bestanden'
