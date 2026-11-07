-- Ernährung: Aktivitätskalorien.
--
-- 1. Ziele bekommen drei Einstellungen:
--    activity_mode    'deficit' = Ziel bleibt, Bewegung vergrößert das Defizit (Standard,
--                     so ändert sich für bestehende Nutzer nichts);
--                     'budget'  = Bewegung kommt aufs Tagesziel.
--    activity_share   'half' | 'full' — wie viel davon aufs Tagesziel kommt (nur bei 'budget').
--    activity_sources woher die Bewegung kommt: 'health' (Apple Health), 'training'
--                     (Trainings aus der App), 'manual' (selbst eingetragen).
-- 2. Neue Tabelle activity_logs für selbst eingetragene Aktivität je Tag.
--
-- Rein additiv und idempotent: keine bestehende Spalte oder Zeile wird geändert.

alter table public.nutrition_goals add column if not exists activity_mode text not null default 'deficit';
alter table public.nutrition_goals add column if not exists activity_share text not null default 'half';
alter table public.nutrition_goals add column if not exists activity_sources text[] not null default array['health', 'training', 'manual'];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'nutrition_goals_activity_mode_check') then
    alter table public.nutrition_goals add constraint nutrition_goals_activity_mode_check
      check (activity_mode in ('deficit', 'budget'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nutrition_goals_activity_share_check') then
    alter table public.nutrition_goals add constraint nutrition_goals_activity_share_check
      check (activity_share in ('half', 'full'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nutrition_goals_activity_sources_check') then
    alter table public.nutrition_goals add constraint nutrition_goals_activity_sources_check
      check (activity_sources <@ array['health', 'training', 'manual']);
  end if;
end $$;

-- ─── Selbst eingetragene Aktivität ───────────────────────────────────────
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  log_date date not null,
  label text not null check (char_length(btrim(label)) between 1 and 60),
  minutes integer check (minutes is null or minutes between 1 and 1440),
  kcal integer not null check (kcal between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_user_date_idx on public.activity_logs (user_id, log_date);

alter table public.activity_logs enable row level security;

do $$
declare
  op text;
  policy_name text;
begin
  foreach op in array array['select', 'insert', 'update', 'delete']
  loop
    policy_name := 'own activity_logs ' || op;
    if not exists (select 1 from pg_policies where schemaname = 'public'
        and tablename = 'activity_logs' and policyname = policy_name) then
      if op = 'insert' then
        execute format('create policy %I on public.activity_logs for insert to authenticated with check ((select auth.uid()) = user_id)', policy_name);
      elsif op = 'update' then
        execute format('create policy %I on public.activity_logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', policy_name);
      else
        execute format('create policy %I on public.activity_logs for %s to authenticated using ((select auth.uid()) = user_id)', policy_name, op);
      end if;
    end if;
  end loop;
end $$;
