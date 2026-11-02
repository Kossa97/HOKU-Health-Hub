-- Profil, Teilprojekt 2b: Gesamtfortschritt und Abzeichen.
-- Spec: docs/superpowers/specs/2026-11-02-profil-p2b-fortschritt-design.md
-- Setzt supabase-profil-p2a-sichtbarkeit.sql voraus (laeuft danach).
--
-- Additiv und idempotent: eine neue Tabelle (create table if not exists),
-- Pruefungen nur wenn noch nicht da, Funktionen per create or replace, Policy
-- per drop policy if exists + create policy. Kein drop von Tabellen oder
-- Spalten, kein delete, kein update. Bestehende Zeilen bleiben unberuehrt.
--
-- Neu:
-- - progress_settings: Start, fruehere Starts, Richtung je Wert, Baseline aus
--   Apple Health / Health Connect, Wochenreihe fuer die Zeitreise. Nur der
--   Nutzer selbst liest und schreibt (RLS); andere sehen davon nie etwas.
-- - Sichtbarkeitsfelder "progress" (Gesamt + Bereiche) und "badges" (verdiente
--   Abzeichen). Die Feldliste steht jetzt einmal in profile_fields();
--   profile_visibility_ok und die Eigentuemer-Sicht in profile_view lesen sie.
-- - profile_snapshot_clean baut fuer andere zusaetzlich "progress" (nur total,
--   die fuenf Bereiche und since; nie Einzelwerte, nie history) und "badges"
--   (nur bekannte IDs aus profile_badge_ids(), hoechstens 100) neu.
--
-- Diese Datei ersetzt profile_visibility_ok, profile_snapshot_clean und
-- profile_view aus 2a. 2a danach NICHT erneut laufen lassen: sie setzte die
-- alten Fassungen ohne "progress"/"badges" zurueck.
--
-- Feldliste (Sichtbarkeit): muss mit PROFILE_FIELDS in
-- src/features/profil/lib/profileVisibility.ts uebereinstimmen; Abzeichen-IDs mit
-- BADGE_IDS in src/features/profil/lib/badgeIds.ts; Wert-IDs mit
-- PROGRESS_METRIC_IDS in src/features/profil/lib/progressScore.ts (Tests pruefen das).
--
-- Ausfuehren: Supabase -> SQL Editor -> diese Datei einfuegen -> Run.
-- VOR und NACH dem Lauf zaehlen (nur Zahlen, keine Inhalte ausgeben):
--   select count(*) from public.profiles;                                   -- unveraendert
--   select count(*) from public.profile_snapshots;                          -- unveraendert
--   select count(*) from public.profiles where field_visibility <> '{}'::jsonb; -- unveraendert
-- Danach pruefen (Erwartung in Klammern):
--   select count(*) from pg_class where relname = 'progress_settings' and relrowsecurity;   -- 1
--   select count(*) from public.progress_settings;                                         -- 0
--   select count(*) from pg_policies where schemaname = 'public' and tablename = 'progress_settings'; -- 1
--   select count(*) from pg_constraint where conrelid = 'public.progress_settings'::regclass
--      and contype = 'c';                                                                  -- 6
--   select cardinality(public.profile_fields());                                           -- 32
--   select cardinality(public.profile_badge_ids());                                        -- 39
--   select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname in ('profile_fields','profile_badge_ids',
--          'progress_day_ok','progress_metric_ok','progress_directions_ok','progress_baselines_ok',
--          'progress_days_ok','profile_visibility_ok','profile_snapshot_clean','profile_view'); -- 10
--   select public.profile_visibility_ok('{"progress":"all","badges":"friends"}');          -- true
--   select count(*) from public.profiles where not public.profile_visibility_ok(field_visibility); -- 0

begin;

-- 1. Feldliste der Sichtbarkeit (30 aus 2a + progress, badges) ----------------
create or replace function public.profile_fields()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'cover','gender','country',
    'bio','goals','streak','member_since',
    'age','height','weight',
    'body_fat','muscle_mass','measurements',
    'adherence','substances',
    'markers','in_range',
    'steps','resting_hr','sleep','active_kcal','spo2','blood_pressure','hrv','vo2max',
    'workouts','routine','favorite_exercise','e1rm',
    'reviews',
    'progress','badges']::text[];
$$;

-- Sichtbarkeit: Objekt aus bekannten Feldern; fehlender Schluessel = Nur ich.
-- Die Pruefung profiles_field_visibility_check (2a) ruft diese Funktion auf und
-- kennt damit sofort die neuen Felder.
create or replace function public.profile_visibility_ok(v jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(v) = 'object'
     and not exists (
       select 1 from jsonb_each(v) e
        where e.key <> all (public.profile_fields())
           or jsonb_typeof(e.value) <> 'string'
           or e.value #>> '{}' not in ('friends', 'all'));
$$;

-- 2. Bekannte Abzeichen (Spec Abschnitt 4, erster Satz) -----------------------
-- Eine ID wird nie umbenannt; neue Abzeichen brauchen eine neue Migration.
create or replace function public.profile_badge_ids()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    -- Bestaendigkeit
    'streak_7','streak_30','streak_100','streak_365',
    'training_weeks_4','training_weeks_12','training_weeks_52',
    'intake_all_30','weighed_weeks_8',
    -- Meilensteine
    'first_daily_log','first_measurement','first_bloodwork','bloodwork_3',
    'workouts_10','workouts_50','workouts_100','workouts_250',
    'first_cycle_done','wearable_connected','profile_complete','first_progress_photo',
    -- Fortschritt
    'body_fat_5','body_fat_10','body_fat_20','weight_5',
    'first_pr','pr_3_month','all_markers_in_range','resting_hr_5','steps_week_10k',
    'progress_10','progress_25','progress_50',
    -- Gemeinschaft (first_friend, friends_10 erst mit Teilprojekt 3)
    'first_review','reviews_5','reviews_25','profile_shared',
    'first_friend','friends_10']::text[];
$$;

-- 3. Pruefbausteine fuer progress_settings ------------------------------------
-- Kalendertag als 'YYYY-MM-DD', gueltig und zwischen 2000 und 2100.
create or replace function public.progress_day_ok(v text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if v is null or v !~ '^\d{4}-\d{2}-\d{2}$' then
    return false;
  end if;
  return v::date between date '2000-01-01' and date '2100-12-31';
exception when others then
  return false;
end;
$$;

-- Wert-ID der Rechnung und die Richtungen, die fuer sie erlaubt sind.
-- Anteilswerte (Blut, Schlaf): Zielbereich oder aus; alle anderen runter/hoch/aus.
-- e1RM je Uebung: 'e1rm:' + Katalog-ID (snake_case) oder 'custom:<uuid>'.
create or replace function public.progress_metric_ok(k text, d text default null)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when k in ('markers_in_range', 'sleep_nights')
      then d is null or d in ('range', 'off')
    when k in ('weight', 'body_fat', 'muscle_mass',
               'circ_neck', 'circ_chest', 'circ_waist', 'circ_belly', 'circ_hips',
               'circ_upper_arm', 'circ_forearm', 'circ_thigh', 'circ_calf',
               'workouts_per_week', 'adherence',
               'steps', 'active_kcal', 'vo2max', 'resting_hr', 'bp_sys', 'hrv')
         or k ~ '^e1rm:([a-z0-9_]{1,64}|custom:[0-9a-f-]{36})$'
      then d is null or d in ('down', 'up', 'off')
    else false
  end;
$$;

-- Richtung je Wert: Objekt { Wert-ID: Richtung }, hoechstens 100 Eintraege.
create or replace function public.progress_directions_ok(v jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- case statt and: die Reihenfolge von and ist in SQL nicht festgelegt, und
  -- jsonb_each wirft bei allem ausser einem Objekt.
  select case when jsonb_typeof(v) = 'object' then
           (select count(*) from jsonb_object_keys(v)) <= 100
           and not exists (
             select 1 from jsonb_each(v) e
              where jsonb_typeof(e.value) <> 'string'
                 or not public.progress_metric_ok(e.key, e.value #>> '{}'))
         else false end;
$$;

-- Baseline der Wearable-Werte: Objekt { Wert-ID: Objekt }, nur die sieben
-- Werte aus Apple Health / Health Connect, klein.
create or replace function public.progress_baselines_ok(v jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(v) = 'object' then
           pg_column_size(v) <= 4096
           and not exists (
             select 1 from jsonb_each(v) e
              where e.key not in ('steps', 'active_kcal', 'resting_hr', 'bp_sys', 'sleep_nights', 'hrv', 'vo2max')
                 or jsonb_typeof(e.value) <> 'object')
         else false end;
$$;

-- Fruehere Starts: Liste von Kalendertagen, hoechstens 50.
create or replace function public.progress_days_ok(v jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(v) = 'array' then
           jsonb_array_length(v) <= 50
           and not exists (
             select 1 from jsonb_array_elements(v) e(x)
              where jsonb_typeof(e.x) <> 'string' or not public.progress_day_ok(e.x #>> '{}'))
         else false end;
$$;

-- 4. Einstellungen des Gesamtfortschritts -------------------------------------
-- Gehoert nur dem Nutzer. Das Geraet rechnet; andere sehen nur, was im
-- Schnappschuss unter "progress" steht und profile_view freigibt.
create table if not exists public.progress_settings (
  user_id uuid primary key references auth.users on delete cascade,
  start_on date,
  previous_starts jsonb not null default '[]'::jsonb,
  directions jsonb not null default '{}'::jsonb,
  baselines jsonb not null default '{}'::jsonb,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'progress_settings_start_on_check') then
    alter table public.progress_settings add constraint progress_settings_start_on_check
      check (start_on is null or start_on between date '2000-01-01' and date '2100-12-31');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'progress_settings_previous_starts_check') then
    alter table public.progress_settings add constraint progress_settings_previous_starts_check
      check (public.progress_days_ok(previous_starts));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'progress_settings_directions_check') then
    alter table public.progress_settings add constraint progress_settings_directions_check
      check (public.progress_directions_ok(directions));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'progress_settings_baselines_check') then
    alter table public.progress_settings add constraint progress_settings_baselines_check
      check (public.progress_baselines_ok(baselines));
  end if;
  -- Wochenreihe der Zeitreise: hoechstens 104 Wochen (zwei Jahre).
  if not exists (select 1 from pg_constraint where conname = 'progress_settings_history_check') then
    alter table public.progress_settings add constraint progress_settings_history_check
      check (case when jsonb_typeof(history) = 'array'
                  then jsonb_array_length(history) <= 104 and pg_column_size(history) <= 32768
                  else false end);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'progress_settings_size_check') then
    alter table public.progress_settings add constraint progress_settings_size_check
      check (pg_column_size(directions) <= 8192 and pg_column_size(previous_starts) <= 2048);
  end if;
end;
$$;

alter table public.progress_settings enable row level security;
drop policy if exists "Own progress settings" on public.progress_settings;
create policy "Own progress settings" on public.progress_settings
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on table public.progress_settings from anon;
grant select, insert, update, delete on table public.progress_settings to authenticated;

-- 5. Schnappschuss fuer andere auf seine bekannte Form bringen ---------------
-- Wie 2a (Abschnitt 7b), dazu "progress" und "badges". Fassung aus 2a
-- unveraendert bis auf den Block am Ende.
create or replace function public.profile_snapshot_clean(s jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  num constant jsonb := '{"height":"cm","weight":"kg","body_fat":"%","muscle_mass":"kg","steps":"steps",
                          "resting_hr":"bpm","sleep":"min","active_kcal":"kcal","spo2":"%"}';
  aus jsonb := '{}'::jsonb;
  k text;
  x jsonb;
  liste jsonb;
begin
  if jsonb_typeof(s) is distinct from 'object' then
    return aus;
  end if;

  if public.profile_snap_num(s #> '{age,v}') is not null then
    aus := aus || jsonb_build_object('age', jsonb_build_object('v', s #> '{age,v}'));
  end if;

  for k in select jsonb_object_keys(num) loop
    if public.profile_snap_num(s -> k -> 'v') is not null then
      aus := aus || jsonb_build_object(k, jsonb_strip_nulls(jsonb_build_object(
        'v', s -> k -> 'v', 'unit', num ->> k, 'delta', public.profile_snap_num(s -> k -> 'delta'))));
    end if;
  end loop;

  if jsonb_typeof(s #> '{measurements,sites}') = 'array' then
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'site', t.x ->> 'site', 'v', t.x -> 'v', 'delta', public.profile_snap_num(t.x -> 'delta'))) order by t.nr)
      into liste
      from (select distinct on (e.x ->> 'site') e.x, e.nr
              from jsonb_array_elements(s #> '{measurements,sites}') with ordinality as e(x, nr)
             where jsonb_typeof(e.x) = 'object'
               and jsonb_typeof(e.x -> 'site') = 'string'
               and e.x ->> 'site' in ('neck', 'chest', 'waist', 'belly', 'hips', 'upper_arm', 'forearm', 'thigh', 'calf')
               and public.profile_snap_num(e.x -> 'v') is not null
             order by e.x ->> 'site', e.nr) t;
    if liste is not null then
      aus := aus || jsonb_build_object('measurements', jsonb_build_object('unit', 'cm', 'sites', liste));
    end if;
  end if;

  x := s -> 'adherence';
  if public.profile_snap_num(x -> 'pct') is not null then
    aus := aus || jsonb_build_object('adherence', jsonb_strip_nulls(jsonb_build_object(
      'pct', x -> 'pct', 'confirmed', public.profile_snap_num(x -> 'confirmed'),
      'missed', public.profile_snap_num(x -> 'missed'), 'days', public.profile_snap_num(x -> 'days'))));
  end if;

  x := s -> 'substances';
  if public.profile_snap_num(x -> 'count') is not null then
    aus := aus || jsonb_build_object('substances', jsonb_strip_nulls(jsonb_build_object(
      'count', x -> 'count', 'activeCycles', public.profile_snap_num(x -> 'activeCycles'))));
  end if;

  if public.profile_snap_num(s #> '{markers,count}') is not null then
    aus := aus || jsonb_build_object('markers', jsonb_build_object('count', s #> '{markers,count}'));
  end if;

  x := s -> 'in_range';
  if public.profile_snap_num(x -> 'inRange') is not null and public.profile_snap_num(x -> 'of') is not null then
    aus := aus || jsonb_build_object('in_range', jsonb_build_object('inRange', x -> 'inRange', 'of', x -> 'of'));
  end if;

  x := s -> 'blood_pressure';
  if public.profile_snap_num(x -> 'sys') is not null and public.profile_snap_num(x -> 'dia') is not null then
    aus := aus || jsonb_build_object('blood_pressure', jsonb_strip_nulls(jsonb_build_object(
      'sys', x -> 'sys', 'dia', x -> 'dia', 'unit', 'mmHg',
      'deltaSys', public.profile_snap_num(x -> 'deltaSys'), 'deltaDia', public.profile_snap_num(x -> 'deltaDia'))));
  end if;

  x := s -> 'workouts';
  if public.profile_snap_num(x -> 'total') is not null then
    aus := aus || jsonb_build_object('workouts', jsonb_strip_nulls(jsonb_build_object(
      'total', x -> 'total', 'perWeek', public.profile_snap_num(x -> 'perWeek'))));
  end if;

  x := s -> 'reviews';
  if public.profile_snap_num(x -> 'count') is not null then
    aus := aus || jsonb_build_object('reviews', jsonb_strip_nulls(jsonb_build_object(
      'count', x -> 'count', 'avgRating', public.profile_snap_num(x -> 'avgRating'))));
  end if;

  if public.profile_snap_num(s #> '{streak,days}') is not null then
    aus := aus || jsonb_build_object('streak', jsonb_build_object('days', s #> '{streak,days}'));
  end if;

  if public.profile_snap_text(s #> '{routine,name}', 80) is not null then
    aus := aus || jsonb_build_object('routine', jsonb_build_object('name', public.profile_snap_text(s #> '{routine,name}', 80)));
  end if;

  if public.profile_snap_text(s #> '{favorite_exercise,name}', 80) is not null then
    aus := aus || jsonb_build_object('favorite_exercise', jsonb_build_object(
      'id', coalesce(public.profile_snap_text(s #> '{favorite_exercise,id}', 80), ''),
      'name', public.profile_snap_text(s #> '{favorite_exercise,name}', 80)));
  end if;

  if jsonb_typeof(s #> '{e1rm,top}') = 'array' then
    select jsonb_agg(jsonb_build_object(
             'id', coalesce(public.profile_snap_text(t.x -> 'id', 80), ''),
             'name', public.profile_snap_text(t.x -> 'name', 80),
             'v', t.x -> 'v') order by t.nr)
      into liste
      from (select e.x, e.nr
              from jsonb_array_elements(s #> '{e1rm,top}') with ordinality as e(x, nr)
             where jsonb_typeof(e.x) = 'object'
               and public.profile_snap_text(e.x -> 'name', 80) is not null
               and public.profile_snap_num(e.x -> 'v') is not null
             order by e.nr
             limit 3) t;
    if liste is not null then
      aus := aus || jsonb_build_object('e1rm', jsonb_build_object('unit', 'kg', 'top', liste));
    end if;
  end if;

  -- Neu in 2b: Gesamtfortschritt. Nur total, die fuenf Bereiche und since;
  -- Prozentzahlen auf eine Stelle gerundet und auf +-10000 begrenzt. Einzelwerte
  -- der Aufschluesselung, history und alles andere fallen weg.
  x := s -> 'progress';
  if jsonb_typeof(x) = 'object'
     and abs((public.profile_snap_num(x -> 'total') #>> '{}')::numeric) <= 10000
     and jsonb_typeof(x -> 'since') = 'string'
     and public.progress_day_ok(x ->> 'since') then
    -- Zahl erst nach profile_snap_num umwandeln (null bei allem anderen):
    -- die Reihenfolge der Bedingungen ist in SQL nicht festgelegt.
    select jsonb_object_agg(b.k, round(b.v, 1))
      into liste
      from (select a.k, (public.profile_snap_num(x -> 'areas' -> a.k) #>> '{}')::numeric as v
              from unnest(array['koerper', 'blut', 'training', 'einnahmen', 'erholung']) as a(k)) b
     where abs(b.v) <= 10000;
    aus := aus || jsonb_build_object('progress', jsonb_build_object(
      'total', round((public.profile_snap_num(x -> 'total') #>> '{}')::numeric, 1),
      'areas', coalesce(liste, '{}'::jsonb),
      'since', x ->> 'since'));
  end if;

  -- Neu in 2b: verdiente Abzeichen. Nur bekannte IDs, jede einmal, in der
  -- Reihenfolge des Geraets, hoechstens 100.
  if jsonb_typeof(s -> 'badges') = 'array' then
    select jsonb_agg(to_jsonb(u.id) order by u.nr)
      into liste
      from (select t.id, t.nr
              from (select distinct on (e.x #>> '{}') e.x #>> '{}' as id, e.nr
                      from jsonb_array_elements(s -> 'badges') with ordinality as e(x, nr)
                     where jsonb_typeof(e.x) = 'string'
                       and e.x #>> '{}' = any (public.profile_badge_ids())
                     order by e.x #>> '{}', e.nr) t
             order by t.nr
             limit 100) u;
    if liste is not null then
      aus := aus || jsonb_build_object('badges', liste);
    end if;
  end if;

  return aus;
end;
$$;

-- 6. Profilansicht: wie 2a, die Eigentuemer-Sicht liest die Feldliste aus
-- profile_fields() (damit auch progress und badges). Sonst unveraendert.
create or replace function public.profile_view(p_username text, p_as text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p record;
  betrachter uuid := auth.uid();
  stufe text;
  eigen boolean;
  erlaubt text[];
  werte jsonb := '{}'::jsonb;
  snap jsonb;
  oben jsonb;
begin
  select pr.* into p
    from public.profiles pr
   where lower(pr.username) = lower(trim(p_username))
   order by (pr.username = trim(p_username)) desc
   limit 1;
  if p.id is null then
    return null;
  end if;

  eigen := betrachter is not null and betrachter = p.id;
  if eigen then
    stufe := case p_as when 'friends' then 'friends' when 'all' then 'all' when 'web' then 'web' else 'owner' end;
  else
    if p.hidden_by_moderation then
      return null;
    end if;
    if betrachter is null then
      stufe := 'web';
    else
      if public.profile_blocked_between(betrachter, p.id) then
        return jsonb_build_object('username', p.username, 'blocked', true, 'own', false);
      end if;
      stufe := 'all';
    end if;
  end if;

  if stufe = 'web' and (not p.web_link_enabled or p.profile_private) then
    return null;
  end if;

  if stufe = 'owner' then
    erlaubt := public.profile_fields();
  elsif p.profile_private then
    erlaubt := '{}';
  elsif stufe = 'friends' then
    erlaubt := array(select e.key from jsonb_each_text(p.field_visibility) e where e.value in ('friends', 'all'));
  elsif stufe = 'all' then
    erlaubt := array(select e.key from jsonb_each_text(p.field_visibility) e where e.value = 'all');
  else
    erlaubt := array(select e.key from jsonb_each_text(p.field_visibility) e where e.key = 'bio' and e.value = 'all');
  end if;

  -- Werte aus dem Profil selbst (immer aktuell)
  if 'bio' = any(erlaubt) and nullif(trim(p.public_bio), '') is not null then
    werte := werte || jsonb_build_object('bio', p.public_bio);
  end if;
  if stufe <> 'web' then
    if 'goals' = any(erlaubt) and cardinality(p.goals) > 0 then
      werte := werte || jsonb_build_object('goals', to_jsonb(p.goals));
    end if;
    if 'country' = any(erlaubt) and p.country is not null then
      werte := werte || jsonb_build_object('country', p.country);
    end if;
    if 'gender' = any(erlaubt) and p.profile_gender is not null then
      werte := werte || jsonb_build_object('gender', p.profile_gender);
    end if;
    if 'member_since' = any(erlaubt) and p.created_at is not null then
      werte := werte || jsonb_build_object('member_since', to_char(p.created_at at time zone 'UTC', 'YYYY-MM'));
    end if;
    if 'cover' = any(erlaubt) and p.cover_path is not null and (stufe = 'owner' or p.cover_status = 'approved') then
      werte := werte || jsonb_build_object('cover', p.cover_path);
    end if;

    -- Werte aus dem Schnappschuss, nur freigegebene Schluessel; fuer jede Sicht
    -- ausser der eigenen erst auf die bekannte Form gebracht (Abschnitt 7b).
    select s.data into snap from public.profile_snapshots s where s.user_id = p.id;
    if snap is not null and stufe <> 'owner' then
      snap := public.profile_snapshot_clean(snap);
    end if;
    if snap is not null then
      werte := werte || coalesce((
        select jsonb_object_agg(e.key, e.value)
          from jsonb_each(snap) e
         where e.key = any(erlaubt)
           and e.key not in ('bio', 'goals', 'country', 'gender', 'member_since', 'cover')
      ), '{}'::jsonb);
    end if;

    -- Freitext im Schnappschuss (Routinename, eigene Uebungsnamen) geht an
    -- andere nur, wenn er den Textfilter besteht; das Geraet ist dafuer nicht
    -- vertrauenswuerdig. Die Form ist oben schon neu gebaut.
    if stufe <> 'owner' then
      if werte ? 'routine' and public.oeffentlicher_text_fehler(werte #>> '{routine,name}') is not null then
        werte := werte - 'routine';
      end if;
      if werte ? 'favorite_exercise' and public.oeffentlicher_text_fehler(werte #>> '{favorite_exercise,name}') is not null then
        werte := werte - 'favorite_exercise';
      end if;
      if werte ? 'e1rm' then
        oben := coalesce((
          select jsonb_agg(t.x order by t.nr)
            from jsonb_array_elements(werte #> '{e1rm,top}') with ordinality as t(x, nr)
           where public.oeffentlicher_text_fehler(t.x ->> 'name') is null
        ), '[]'::jsonb);
        if jsonb_array_length(oben) = 0 then
          werte := werte - 'e1rm';
        else
          werte := jsonb_set(werte, '{e1rm,top}', oben);
        end if;
      end if;
    end if;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'username', p.username,
    -- Aeltere Anzeigenamen wurden nur bei is_public geprueft: andere bekommen
    -- ihn nur, wenn er den Textfilter besteht (sonst zeigt die App den Nutzernamen).
    'display_name', case when stufe = 'owner' or public.oeffentlicher_text_fehler(p.display_name) is null
                         then p.display_name end,
    'own', eigen,
    'blocked', false,
    'as', case when eigen then stufe end,
    'private', case when not eigen or stufe <> 'owner' then p.profile_private end,
    'avatar', case when p.avatar_path is not null and (stufe = 'owner' or p.avatar_status = 'approved') then p.avatar_path end,
    'fields', werte,
    -- nur fuer den Eigentuemer in seiner eigenen Sicht
    'visibility', case when stufe = 'owner' then p.field_visibility end,
    'profile_private', case when stufe = 'owner' then p.profile_private end,
    'web_link_enabled', case when stufe = 'owner' then p.web_link_enabled end,
    'avatar_status', case when stufe = 'owner' then p.avatar_status end,
    'cover_status', case when stufe = 'owner' then p.cover_status end
  ));
end;
$$;

revoke all on function public.profile_view(text, text) from public;
grant execute on function public.profile_view(text, text) to anon, authenticated;

commit;
