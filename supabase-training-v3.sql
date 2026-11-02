-- Workout-Tracker v3: Zeitplan je Plan
--
-- Ein Plan („Push/Pull/Beine") ist weiterhin der Name im Feld `folder` der
-- Workouts (training_routines). Neu ist nur, WIE der Plan geplant wird:
--   {"mode":"weekdays"}                 feste Wochentage (an den Workouts, wie bisher)
--   {"mode":"per_week","perWeek":4}     X-mal pro Woche, Workouts der Reihe nach
--   {"mode":"interval","everyDays":2}   alle X Tage ab der letzten Einheit
-- Fehlt die Zeile, gilt „weekdays" — also genau das bisherige Verhalten.
--
-- Nur eine neue Tabelle mit Zeilenschutz; keine bestehende Zeile, Spalte oder
-- Policy wird veraendert. Reihenfolge beim Ausrollen: diese Migration VOR dem
-- Frontend-Deploy in Prod (das Frontend liest ohne Tabelle weiter, kann den
-- Zeitplan dann aber nicht speichern).
-- Idempotent: zweimal ausfuehren aendert nichts.

create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  schedule jsonb not null default '{"mode":"weekdays"}'::jsonb
    check (jsonb_typeof(schedule) = 'object' and pg_column_size(schedule) <= 1024),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.training_plans enable row level security;

do $$
declare
  op text;
  policy_name text;
begin
  foreach op in array array['select','insert','update','delete']
  loop
    policy_name := 'own training_plans ' || op;
    if not exists (select 1 from pg_policies where schemaname = 'public'
        and tablename = 'training_plans' and policyname = policy_name) then
      if op = 'insert' then
        execute format('create policy %I on public.training_plans for insert to authenticated with check ((select auth.uid()) = user_id)', policy_name);
      elsif op = 'update' then
        execute format('create policy %I on public.training_plans for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', policy_name);
      else
        execute format('create policy %I on public.training_plans for %s to authenticated using ((select auth.uid()) = user_id)', policy_name, op);
      end if;
    end if;
  end loop;
end
$$;

grant select, insert, update, delete on public.training_plans to authenticated;
