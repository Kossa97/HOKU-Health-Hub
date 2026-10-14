\set ON_ERROR_STOP on
-- Trockenlauf fuer supabase-injection-atomic-confirm.sql.
-- Nur gegen ein Wegwerf-PostgreSQL 16 (siehe CLAUDE.md, Datenbankaenderungen).
-- `injection_logs` und `dose_logs` bilden Spalten, Indizes und Policies des
-- Produktivstands vom 14.10.2026 nach. `confirm_intake_group` ist ein
-- schlanker Ersatz mit derselben Signatur (SECURITY DEFINER, setof
-- dose_logs, Upsert ueber dose_log_id) -- die echte Funktion haengt an der
-- ganzen Planungs-Kette und ist in den my-stack-Tests abgedeckt. Geprueft
-- wird hier, was die neue Funktion selbst verspricht. Synthetische Daten.
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
create table public.cycles (id uuid primary key);
create table public.stack_items (id uuid primary key);
-- dose_logs wie in Prod
create table public.dose_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, stack_item_id uuid, vial_id uuid,
  dose numeric, unit text, method text not null, notes text, logged_at timestamptz not null default now(),
  created_at timestamptz default now(), taken boolean, routine_slot_key text, cycle_id uuid, plan_version_id uuid);
alter table public.dose_logs enable row level security;
create policy "Own dose logs" on public.dose_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- injection_logs wie in Prod (Spalten, FKs, Indizes, Policy)
create table public.injection_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  dose_log_id uuid, site text not null, notes text, logged_at timestamptz not null default now(), created_at timestamptz default now(),
  stack_item_id uuid references public.stack_items(id) on delete set null, cycle_id uuid references public.cycles(id) on delete set null,
  dose numeric, unit text, method text, body_region text, body_side text, model_version text,
  position jsonb, normal jsonb, uv jsonb, camera_state jsonb, warning_state text, substance_label text);
create index injection_logs_cycle_id_idx on public.injection_logs (cycle_id);
create index injection_logs_stack_item_id_idx on public.injection_logs (stack_item_id);
create index injection_logs_user_cycle_idx on public.injection_logs (user_id, cycle_id, logged_at desc);
create index injection_logs_user_logged_at_idx on public.injection_logs (user_id, logged_at desc);
create index injection_logs_user_region_idx on public.injection_logs (user_id, body_region, body_side, logged_at desc);
create index injection_logs_user_site_idx on public.injection_logs (user_id, site, logged_at desc);
create unique index injection_logs_dose_log_id_unique_idx on public.injection_logs (dose_log_id) where dose_log_id is not null;
alter table public.injection_logs enable row level security;
create policy "Own injection logs" on public.injection_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.dose_logs, public.injection_logs to authenticated;
-- Ersatz fuer confirm_intake_group: gleiche Signatur, DEFINER, upsert ueber dose_log_id.
create function public.confirm_intake_group(p_entries jsonb) returns setof public.dose_logs
language plpgsql security definer set search_path to 'pg_catalog','public','pg_temp' as $$
declare e jsonb; r public.dose_logs;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  for e in select * from jsonb_array_elements(p_entries) loop
    if (e->>'fail')::boolean then raise exception 'simulated confirm failure'; end if;
    if e->>'dose_log_id' is not null then
      update public.dose_logs set taken = coalesce((e->>'taken')::boolean, false), dose = (e->>'dose')::numeric, unit = e->>'unit', method = e->>'method', logged_at = (e->>'logged_at')::timestamptz
        where id = (e->>'dose_log_id')::uuid and user_id = auth.uid() returning * into r;
    else
      insert into public.dose_logs (user_id, stack_item_id, cycle_id, plan_version_id, routine_slot_key, dose, unit, method, logged_at, taken)
      values (auth.uid(), (e->>'stack_item_id')::uuid, (e->>'cycle_id')::uuid, (e->>'plan_version_id')::uuid, e->>'slot_key',
              (e->>'dose')::numeric, e->>'unit', e->>'method', (e->>'logged_at')::timestamptz, coalesce((e->>'taken')::boolean, false)) returning * into r;
    end if;
    return next r;
  end loop;
end $$;
revoke execute on function public.confirm_intake_group(jsonb) from public, anon;
grant execute on function public.confirm_intake_group(jsonb) to authenticated;
-- Ist-Zustand: zwei Nutzer, Zyklus, Substanz, eine bestehende Injektion (ohne Einnahme) und eine bestehende verknuepfte.
insert into auth.users values ('00000000-0000-4000-8000-00000000000a'), ('00000000-0000-4000-8000-00000000000b');
insert into public.cycles values ('00000000-0000-4000-8000-0000000000c1');
insert into public.stack_items values ('00000000-0000-4000-8000-0000000000e1') on conflict do nothing;
insert into public.dose_logs (id, user_id, stack_item_id, cycle_id, dose, unit, method, logged_at, taken) values
  ('00000000-0000-4000-8000-0000000000d0', '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000c1', 250, 'mcg', 'Subkutan', '2026-09-26T08:00Z', true),
  ('00000000-0000-4000-8000-0000000000d9', '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000c1', 250, 'mcg', 'Subkutan', '2026-09-28T08:00Z', null);
insert into public.injection_logs (user_id, dose_log_id, site, logged_at) values
  ('00000000-0000-4000-8000-00000000000a', null, 'abdomen_left', '2026-09-25T08:00Z'),
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000d0', 'abdomen_right', '2026-09-26T08:00Z');

\ir ../../supabase-injection-atomic-confirm.sql
\ir ../../supabase-injection-atomic-confirm.sql

create function pg_temp.expect(ok boolean, what text) returns void language plpgsql as $$
begin if not ok then raise exception 'FEHLGESCHLAGEN: %', what; end if; end $$;
create function pg_temp.counts(out d bigint, out i bigint) language sql as $$
  select (select count(*) from public.dose_logs), (select count(*) from public.injection_logs) $$;

-- 1) Erfolg: neue Einnahme + Stelle; Dosis/Nutzer vom Geraet werden ignoriert
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', false);
select public.confirm_intake_with_injection(
  '{"cycle_id":"00000000-0000-4000-8000-0000000000c1","stack_item_id":"00000000-0000-4000-8000-0000000000e1","dose":300,"unit":"mcg","method":"Subkutan","logged_at":"2026-09-28T09:15:00Z","dose_log_id":null}',
  '{"site":"thigh_left","body_region":"thigh","body_side":"left","position":{"x":-0.2,"y":-0.4,"z":0.1},"uv":null,"notes":"  ok  ","dose":999,"user_id":"00000000-0000-4000-8000-00000000000b"}');
reset role;
select pg_temp.expect((select (d, i) = (3::bigint, 3::bigint) from pg_temp.counts()), 'T1 Zaehlung');
select pg_temp.expect(exists (select 1 from public.injection_logs i join public.dose_logs d on d.id = i.dose_log_id
  where i.site = 'thigh_left' and i.user_id = '00000000-0000-4000-8000-00000000000a' and i.dose = 300 and i.unit = 'mcg'
    and i.logged_at = d.logged_at and i.notes = 'ok' and i.uv is null and d.taken), 'T1 Werte aus der Einnahme');

-- 2) taken:false vom Geraet wird ueberschrieben
set role authenticated;
select public.confirm_intake_with_injection(
  '{"dose_log_id":"00000000-0000-4000-8000-0000000000d9","dose":250,"unit":"mcg","method":"Subkutan","logged_at":"2026-09-28T08:05:00Z","taken":false}',
  '{"site":"abdomen_left"}');
reset role;
select pg_temp.expect((select taken from public.dose_logs where id = '00000000-0000-4000-8000-0000000000d9'), 'T2 taken erzwungen');

-- 3) Stelle scheitert (Einnahme hat schon eine) => Bestaetigung rollt zurueck
update public.dose_logs set taken = null where id = '00000000-0000-4000-8000-0000000000d0';
set role authenticated;
do $$ begin
  perform public.confirm_intake_with_injection('{"dose_log_id":"00000000-0000-4000-8000-0000000000d0","dose":500,"unit":"mcg","method":"Subkutan","logged_at":"2026-09-26T08:00:00Z"}', '{"site":"deltoid_left"}');
  raise exception 'FEHLGESCHLAGEN: T3 kein Abbruch';
exception when unique_violation then null; end $$;
reset role;
select pg_temp.expect((select taken is null and dose = 250 from public.dose_logs where id = '00000000-0000-4000-8000-0000000000d0'), 'T3 Rollback der Einnahme');
select pg_temp.expect((select (d, i) = (3::bigint, 4::bigint) from pg_temp.counts()), 'T3 Zaehlung');

-- 4) Bestaetigung scheitert / Stelle fehlt => nichts gespeichert
set role authenticated;
do $$ begin perform public.confirm_intake_with_injection('{"fail":true}', '{"site":"glute_left"}');
  raise exception 'FEHLGESCHLAGEN: T4'; exception when raise_exception then if sqlerrm like 'FEHLGESCHLAGEN%' then raise; end if; end $$;
do $$ begin perform public.confirm_intake_with_injection('{"dose":1,"unit":"mg","method":"Subkutan","logged_at":"2026-09-28T10:00:00Z"}', '{"site":"  "}');
  raise exception 'FEHLGESCHLAGEN: T5'; exception when invalid_parameter_value then null; end $$;
reset role;
select pg_temp.expect((select (d, i) = (3::bigint, 4::bigint) from pg_temp.counts()), 'T4/T5 Zaehlung');

-- 6) anon und ohne Anmeldung: nein. 7) Fremde sehen nichts.
set role anon;
do $$ begin perform public.confirm_intake_with_injection('{}', '{"site":"x"}');
  raise exception 'FEHLGESCHLAGEN: T6 anon'; exception when insufficient_privilege then null; end $$;
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin perform public.confirm_intake_with_injection('{}', '{"site":"x"}');
  raise exception 'FEHLGESCHLAGEN: T6 anonym'; exception when insufficient_privilege then null; end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', false);
select pg_temp.expect((select count(*) = 0 from public.injection_logs), 'T7 fremde Stellen unsichtbar');
reset role;
\echo 'injection-atomic-confirm: alle Pruefungen bestanden'
