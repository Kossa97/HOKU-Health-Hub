-- Workout-Tracker: Einheiten, Routinen, eigene Uebungen, Einstellungen
--
-- Eine Einheit (`training_sessions`) gilt fuer JEDE Art von Training —
-- Krafttraining, Lauf, Hyrox, Yoga. Die Uebungen mit ihren Saetzen stehen als
-- jsonb in der Einheit: gespeichert wird immer die ganze Einheit in einem
-- Schreibvorgang, ausgewertet wird in der App. Der Uebungskatalog liegt im
-- App-Code; hier stehen nur die eigenen Uebungen des Nutzers.
--
-- Nur neue Tabellen, keine bestehende wird angefasst.
-- Idempotent: zweimal ausfuehren aendert nichts.

-- ─── Einheiten ──────────────────────────────────────────────────────────────

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'strength','run','cycle','swim','row','walk','hike',
    'hiit','hyrox','yoga','mobility','sport','other')),
  title text not null default '' check (char_length(title) <= 80),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_s integer check (duration_s is null or duration_s between 0 and 172800),
  distance_m numeric(9,1) check (distance_m is null or distance_m between 0 and 1000000),
  kcal integer check (kcal is null or kcal between 0 and 20000),
  avg_hr smallint check (avg_hr is null or avg_hr between 20 and 250),
  rpe numeric(3,1) check (rpe is null or rpe between 1 and 10),
  notes text check (notes is null or char_length(notes) <= 2000),
  routine_id uuid,
  exercises jsonb not null default '[]'::jsonb
    check (jsonb_typeof(exercises) = 'array' and pg_column_size(exercises) <= 262144),
  source text not null default 'manual' check (source in (
    'manual','live','healthkit','health_connect','import_hevy','import_strong')),
  external_id text check (external_id is null or char_length(external_id) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create index if not exists training_sessions_user_started_idx
  on public.training_sessions (user_id, started_at desc);

-- Ein importiertes Training (Uhr, CSV) gibt es je Nutzer nur einmal. Bewusst
-- OHNE `where external_id is not null`: der Import schreibt per
-- `on conflict (user_id, external_id) do nothing`, und das findet nur einen
-- Index ohne Bedingung. Mehrere NULL-Werte bleiben trotzdem erlaubt (NULL ist
-- in Postgres nie gleich NULL).
create unique index if not exists training_sessions_user_external_uidx
  on public.training_sessions (user_id, external_id);

-- ─── Routinen (Vorlagen) ────────────────────────────────────────────────────

create table if not exists public.training_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  kind text not null default 'strength' check (kind in (
    'strength','run','cycle','swim','row','walk','hike',
    'hiit','hyrox','yoga','mobility','sport','other')),
  exercises jsonb not null default '[]'::jsonb
    check (jsonb_typeof(exercises) = 'array' and pg_column_size(exercises) <= 131072),
  weekdays smallint[] not null default '{}'
    check (weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_routines_user_idx
  on public.training_routines (user_id, sort_order, created_at);

-- ─── Eigene Uebungen ────────────────────────────────────────────────────────

create table if not exists public.training_custom_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  category text not null default 'strength'
    check (category in ('strength','cardio','hyrox','mobility','plyometric')),
  equipment text not null default 'other' check (char_length(equipment) <= 30),
  tracking text not null default 'weight_reps' check (tracking in (
    'weight_reps','bodyweight_reps','assisted_reps','reps','duration',
    'weight_duration','distance_duration','weight_distance')),
  primary_muscles text[] not null default '{}' check (cardinality(primary_muscles) <= 10),
  secondary_muscles text[] not null default '{}' check (cardinality(secondary_muscles) <= 10),
  created_at timestamptz not null default now()
);

create index if not exists training_custom_exercises_user_idx
  on public.training_custom_exercises (user_id, name);

-- ─── Einstellungen (eine Zeile je Nutzer) ───────────────────────────────────

create table if not exists public.training_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 8192),
  updated_at timestamptz not null default now()
);

-- ─── Zeilenschutz ───────────────────────────────────────────────────────────
-- Ohne `drop policy`: eine Policy wird nur angelegt, wenn es sie noch nicht
-- gibt. Jeder sieht und aendert nur seine eigenen Zeilen.

alter table public.training_sessions enable row level security;
alter table public.training_routines enable row level security;
alter table public.training_custom_exercises enable row level security;
alter table public.training_settings enable row level security;

do $$
declare
  t text;
  op text;
  policy_name text;
begin
  foreach t in array array['training_sessions','training_routines','training_custom_exercises','training_settings']
  loop
    foreach op in array array['select','insert','update','delete']
    loop
      policy_name := 'own ' || t || ' ' || op;
      if not exists (select 1 from pg_policies where schemaname = 'public'
          and tablename = t and policyname = policy_name) then
        if op = 'insert' then
          execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', policy_name, t);
        elsif op = 'update' then
          execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', policy_name, t);
        else
          execute format('create policy %I on public.%I for %s to authenticated using ((select auth.uid()) = user_id)', policy_name, t, op);
        end if;
      end if;
    end loop;
  end loop;
end
$$;

grant select, insert, update, delete on public.training_sessions to authenticated;
grant select, insert, update, delete on public.training_routines to authenticated;
grant select, insert, update, delete on public.training_custom_exercises to authenticated;
grant select, insert, update, delete on public.training_settings to authenticated;
