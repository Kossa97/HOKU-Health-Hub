-- Profil-Zusatz Titel: Rang (Tage mit eigenem Eintrag) oder ein tragbares Abzeichen
-- unter dem Namen, mit Sichtbarkeitsstufe wie jedes Feld.
-- Spec: docs/superpowers/specs/2026-11-03-profil-titel-design.md (2, 3, 5, 6)
-- Plan: docs/superpowers/plans/2026-11-03-profil-titel.md (Task 1)
-- Setzt 2a, 2b und 2c voraus (Reihenfolge 2a -> 2b -> 2c -> Titel). Diese Datei
-- ersetzt profile_badge_ids, progress_earned_ok, profile_fields, profile_web_fields,
-- profile_badge_web_sensitive, profile_badge_web_borderline und profile_view.
-- 2a, 2b und 2c danach NICHT erneut laufen lassen: sie setzten die Fassungen ohne
-- Titel zurueck (die neuen Abzeichen-IDs waeren dann ungueltig, verdiente Titel
-- liessen sich nicht mehr speichern, profile_view gaebe keinen Titel aus).
--
-- Additiv und idempotent: drei Spalten in profiles per add column if not exists,
-- zwei Pruefungen nur wenn noch nicht da, Funktionen per create or replace. Kein
-- drop, kein delete, kein update, kein truncate. Bestehende Zeilen bleiben
-- unberuehrt (title_choice = null = Rang, personal_titles = false, title_consents = '{}';
-- field_visibility ohne "title" = Nur ich).
--
-- Neu:
-- - 42 Abzeichen-IDs (zusammen 81): Raenge rank_1..rank_6 (Gruppe rang, erscheinen
--   nicht in der Abzeichen-Liste), Sportarten mit drei Stufen, weitere tragbare.
--   Liste wie BADGE_IDS in src/features/profil/lib/badgeIds.ts (Test).
-- - progress_earned_ok: Groesse bis 8192 Byte (81 statt 39 moegliche Eintraege).
-- - Feld "title" in profile_fields() (Standard Nur ich, wie alle) und in
--   profile_web_fields() (Web nur bei "Alle" + Web-Link, wie jedes Feld aus 2c).
-- - profile_rank_ids(), profile_title_badge_ids() (56 tragbare, wie TITLE_BADGE_IDS in
--   src/features/profil/lib/titles.ts), profile_title_ladder(id) (Stufen der Leiter
--   oder null), profile_title_source(id) (Quellfeld persoenlicher Titel oder null).
-- - profiles.title_choice: null = Rang tragen, sonst eine ID aus profile_title_badge_ids().
-- - profiles.personal_titles: Schalter "Persoenliche Titel erlauben", Standard aus.
-- - profiles.title_consents: { persoenliche Titel-ID: "yyyy-MM-dd" } = Bestaetigung
--   (Einwilligung Art. 9 Abs. 2 a DSGVO), nur IDs mit Quellfeld.
-- - profile_view: "title" in fields = {"kind": "rank"|"badge", "id": ...} in jeder
--   Sicht, in der das Feld title sichtbar ist. Gewaehlt gilt nur verdient (aus
--   progress_settings.earned_badges; bei Leitern die hoechste verdiente Stufe),
--   persoenliche nur mit Schalter + Einwilligung + Quellfeld in dieser Sicht sichtbar,
--   im Web nie; im Web ausserdem nur, wenn das Abzeichen dort freigegeben ist
--   (profile_web_badge_on); sonst der hoechste verdiente Rang. Eigentuemer zusaetzlich
--   title_choice, personal_titles, title_consents. Sonst wie 2c.
--
-- Ausfuehren: Supabase -> SQL Editor -> diese Datei einfuegen -> Run.
-- VOR und NACH dem Lauf zaehlen (nur Zahlen, keine Inhalte ausgeben):
--   select count(*) from public.profiles;                                         -- unveraendert
--   select count(*) from public.progress_settings;                                -- unveraendert
--   select count(*) from public.profiles where field_visibility <> '{}'::jsonb;  -- unveraendert
-- Danach pruefen (Erwartung in Klammern):
--   select cardinality(public.profile_badge_ids());                               -- 81
--   select cardinality(public.profile_title_badge_ids());                         -- 56
--   select cardinality(public.profile_fields());                                  -- 33
--   select count(*) from information_schema.columns where table_schema = 'public'
--      and table_name = 'profiles' and column_name in ('title_choice','personal_titles','title_consents'); -- 3
--   select count(*) from public.profiles where title_choice is not null or personal_titles
--      or title_consents <> '{}'::jsonb;                                          -- 0
--   select count(*) from public.progress_settings where not public.progress_earned_ok(earned_badges); -- 0
--   select count(*) from public.profiles where not public.profile_visibility_ok(field_visibility);    -- 0

begin;

-- 1. Abzeichen-IDs (39 aus 2b + 42) -------------------------------------------
create or replace function public.profile_badge_ids()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'streak_7','streak_30','streak_100','streak_365','training_weeks_4','training_weeks_12',
    'training_weeks_52','intake_all_30','weighed_weeks_8','steps_weeks_12','journal_30','journal_100',
    'journal_365','sleep_tracked_30','first_daily_log','first_measurement','first_bloodwork','bloodwork_3',
    'workouts_10','workouts_50','workouts_100','workouts_250','first_cycle_done','wearable_connected',
    'profile_complete','first_progress_photo','entries_1000','body_fat_5','body_fat_10','body_fat_20',
    'weight_5','first_pr','pr_3_month','all_markers_in_range','resting_hr_5','steps_week_10k',
    'progress_10','progress_25','progress_50','prs_5','prs_25','prs_100',
    'sleep_rested_30','sleep_rested_100','run_10','run_50','run_150','cycle_10',
    'cycle_50','cycle_150','swim_10','swim_30','swim_100','row_10',
    'row_30','row_100','hike_10','hike_25','hike_75','hyrox_5',
    'hyrox_20','hyrox_60','hiit_10','hiit_50','hiit_150','yoga_10',
    'yoga_50','yoga_150','allrounder','first_review','reviews_5','reviews_25',
    'profile_shared','first_friend','friends_10','rank_1','rank_2','rank_3',
    'rank_4','rank_5','rank_6']::text[];
$$;

-- Verdiente Abzeichen: wie 2b, nur mehr Platz (81 moegliche Eintraege).
create or replace function public.progress_earned_ok(v jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(v) = 'object' then
           pg_column_size(v) <= 8192
           and not exists (
             select 1 from jsonb_each(v) e
              where e.key <> all (public.profile_badge_ids())
                 or jsonb_typeof(e.value) <> 'string'
                 or not public.progress_day_ok(e.value #>> '{}'))
         else false end;
$$;

-- 2. Feldlisten -----------------------------------------------------------------
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
    'progress','badges',
    'title']::text[];
$$;

create or replace function public.profile_web_fields()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['cover','country','goals','bio','streak','progress','badges','reviews','title']::text[];
$$;

-- 3. Abzeichen im Web: neue heikle (wie gut man schlaeft) und Grenzfaelle ------
create or replace function public.profile_badge_web_sensitive()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'first_bloodwork','bloodwork_3','all_markers_in_range','first_cycle_done','intake_all_30','body_fat_5',
    'body_fat_10','body_fat_20','weight_5','resting_hr_5','sleep_rested_30','sleep_rested_100']::text[];
$$;

create or replace function public.profile_badge_web_borderline()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'weighed_weeks_8','first_measurement','first_progress_photo','wearable_connected','steps_week_10k','progress_10',
    'progress_25','progress_50','sleep_tracked_30','steps_weeks_12']::text[];
$$;

-- 4. Titel-Listen ---------------------------------------------------------------
create or replace function public.profile_rank_ids()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['rank_1','rank_2','rank_3','rank_4','rank_5','rank_6']::text[];
$$;

-- Tragbare Abzeichen (Spec 3.1-3.3), wie TITLE_BADGE_IDS.
create or replace function public.profile_title_badge_ids()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'streak_100','streak_365','training_weeks_52','friends_10','steps_weeks_12','entries_1000',
    'allrounder','sleep_tracked_30','workouts_50','workouts_100','workouts_250','prs_5',
    'prs_25','prs_100','journal_30','journal_100','journal_365','run_10',
    'run_50','run_150','cycle_10','cycle_50','cycle_150','swim_10',
    'swim_30','swim_100','row_10','row_30','row_100','hike_10',
    'hike_25','hike_75','hyrox_5','hyrox_20','hyrox_60','hiit_10',
    'hiit_50','hiit_150','yoga_10','yoga_50','yoga_150','body_fat_5',
    'body_fat_10','body_fat_20','weight_5','first_bloodwork','all_markers_in_range','resting_hr_5',
    'intake_all_30','first_cycle_done','first_review','sleep_rested_30','sleep_rested_100','progress_10',
    'progress_25','progress_50']::text[];
$$;

-- Leiter einer Stufe (Spec 3.2): alle drei Stufen aufsteigend, sonst null.
create or replace function public.profile_title_ladder(p_id text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when p_id = any (array['workouts_50','workouts_100','workouts_250']) then array['workouts_50','workouts_100','workouts_250']
    when p_id = any (array['prs_5','prs_25','prs_100']) then array['prs_5','prs_25','prs_100']
    when p_id = any (array['journal_30','journal_100','journal_365']) then array['journal_30','journal_100','journal_365']
    when p_id = any (array['run_10','run_50','run_150']) then array['run_10','run_50','run_150']
    when p_id = any (array['cycle_10','cycle_50','cycle_150']) then array['cycle_10','cycle_50','cycle_150']
    when p_id = any (array['swim_10','swim_30','swim_100']) then array['swim_10','swim_30','swim_100']
    when p_id = any (array['row_10','row_30','row_100']) then array['row_10','row_30','row_100']
    when p_id = any (array['hike_10','hike_25','hike_75']) then array['hike_10','hike_25','hike_75']
    when p_id = any (array['hyrox_5','hyrox_20','hyrox_60']) then array['hyrox_5','hyrox_20','hyrox_60']
    when p_id = any (array['hiit_10','hiit_50','hiit_150']) then array['hiit_10','hiit_50','hiit_150']
    when p_id = any (array['yoga_10','yoga_50','yoga_150']) then array['yoga_10','yoga_50','yoga_150']
  end;
$$;

-- Quellfeld persoenlicher Titel (Spec 3.3), sonst null.
create or replace function public.profile_title_source(p_id text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_id
    when 'body_fat_5' then 'body_fat'
    when 'body_fat_10' then 'body_fat'
    when 'body_fat_20' then 'body_fat'
    when 'weight_5' then 'weight'
    when 'first_bloodwork' then 'markers'
    when 'all_markers_in_range' then 'in_range'
    when 'resting_hr_5' then 'resting_hr'
    when 'intake_all_30' then 'adherence'
    when 'first_cycle_done' then 'substances'
    when 'first_review' then 'reviews'
    when 'sleep_rested_30' then 'sleep'
    when 'sleep_rested_100' then 'sleep'
    when 'progress_10' then 'progress'
    when 'progress_25' then 'progress'
    when 'progress_50' then 'progress'
  end;
$$;

-- Bestaetigungen: { persoenliche Titel-ID: "yyyy-MM-dd" }, klein.
create or replace function public.profile_title_consents_ok(v jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(v) = 'object' then
           pg_column_size(v) <= 2048
           and not exists (
             select 1 from jsonb_each(v) e
              where public.profile_title_source(e.key) is null
                 or jsonb_typeof(e.value) <> 'string'
                 or not public.progress_day_ok(e.value #>> '{}'))
         else false end;
$$;

-- 5. Spalten --------------------------------------------------------------------
alter table public.profiles
  add column if not exists title_choice text,
  add column if not exists personal_titles boolean not null default false,
  add column if not exists title_consents jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'profiles_title_choice_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_title_choice_check
      check (title_choice is null or title_choice = any (public.profile_title_badge_ids()));
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'profiles_title_consents_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_title_consents_check
      check (public.profile_title_consents_ok(title_consents));
  end if;
end;
$$;

-- 6. Profilansicht --------------------------------------------------------------
-- Wie 2c (supabase-profil-p2c-web.sql, Abschnitt 6), dazu der Titel und fuer den
-- Eigentuemer title_choice, personal_titles, title_consents. Ein "title" aus dem
-- Schnappschuss wird nie uebernommen (nur der Server bestimmt ihn).
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
  roh jsonb;
  snap jsonb;
  oben jsonb;
  karte jsonb;
  verdient jsonb;
  wahl text;
  quelle text;
  stufen text[];
  titel jsonb;
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
    -- web: nur "Alle" und nur Felder, die ins Web duerfen
    erlaubt := array(select e.key from jsonb_each_text(p.field_visibility) e
                      where e.value = 'all' and e.key = any (public.profile_web_fields()));
  end if;

  -- Werte aus dem Profil selbst (immer aktuell)
  -- Bio im Web nur, wenn sie den Textfilter besteht (keine Links, Kontaktdaten,
  -- Handel, Beleidigungen); in der App unveraendert.
  if 'bio' = any(erlaubt) and nullif(trim(p.public_bio), '') is not null
     and (stufe <> 'web' or public.oeffentlicher_text_fehler(p.public_bio) is null) then
    werte := werte || jsonb_build_object('bio', p.public_bio);
  end if;
  if 'goals' = any(erlaubt) and cardinality(p.goals) > 0 then
    werte := werte || jsonb_build_object('goals', to_jsonb(p.goals));
  end if;
  if 'country' = any(erlaubt) and p.country is not null then
    werte := werte || jsonb_build_object('country', p.country);
  end if;
  if 'cover' = any(erlaubt) and p.cover_path is not null and (stufe = 'owner' or p.cover_status = 'approved') then
    werte := werte || jsonb_build_object('cover', p.cover_path);
  end if;
  -- Nie im Web (stehen auch nicht in profile_web_fields; doppelt haelt besser).
  if stufe <> 'web' then
    if 'gender' = any(erlaubt) and p.profile_gender is not null then
      werte := werte || jsonb_build_object('gender', p.profile_gender);
    end if;
    if 'member_since' = any(erlaubt) and p.created_at is not null then
      werte := werte || jsonb_build_object('member_since', to_char(p.created_at at time zone 'UTC', 'YYYY-MM'));
    end if;
  end if;

  -- Werte aus dem Schnappschuss, nur freigegebene Schluessel; fuer jede Sicht
  -- ausser der eigenen erst auf die bekannte Form gebracht (2a Abschnitt 7b, 2b).
  select s.data into roh from public.profile_snapshots s where s.user_id = p.id;
  snap := roh;
  if snap is not null and stufe <> 'owner' then
    snap := public.profile_snapshot_clean(snap);
  end if;
  if snap is not null then
    werte := werte || coalesce((
      select jsonb_object_agg(e.key, e.value)
        from jsonb_each(snap) e
       where e.key = any(erlaubt)
         and e.key not in ('bio', 'goals', 'country', 'gender', 'member_since', 'cover', 'title')
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

  -- Titel (Profil-Zusatz Titel, Spec 5 und 6): nur als bekannte ID, nie Freitext.
  -- Gewaehlt (title_choice) gilt nur, wenn verdient (bei Leitern die hoechste
  -- verdiente Stufe); ein persoenlicher Titel nur mit Schalter, Einwilligung und
  -- wenn sein Quellfeld in dieser Sicht selbst sichtbar ist, im Web und auf der
  -- Link-Karte nie (dort gibt es Fortschritt nur als Stufe mit Schutzregel; ein
  -- Titel wie "Verwandelt" verriete sonst, was die Stufe verbirgt). Sonst der
  -- hoechste Rang.
  if 'title' = any(erlaubt) then
    select ps.earned_badges into verdient from public.progress_settings ps where ps.user_id = p.id;
    verdient := coalesce(verdient, '{}'::jsonb);
    wahl := case when p.title_choice = any (public.profile_title_badge_ids()) then p.title_choice end;
    if wahl is not null then
      quelle := public.profile_title_source(wahl);
      if quelle is not null and not (p.personal_titles
                                     and coalesce(p.title_consents ? wahl, false)
                                     and stufe <> 'web'
                                     and (stufe = 'owner' or quelle = any(erlaubt))) then
        wahl := null;
      end if;
    end if;
    if wahl is not null then
      stufen := public.profile_title_ladder(wahl);
      if stufen is null then
        if not verdient ? wahl then
          wahl := null;
        end if;
      else
        wahl := (select s.x from unnest(stufen) with ordinality as s(x, nr)
                  where verdient ? s.x order by s.nr desc limit 1);
      end if;
    end if;
    -- Im Web gilt fuer den Titel dieselbe Freigabe wie fuer das Abzeichen selbst
    -- (web_badges bzw. Standard): ein Grenzfall wie "Schlafbeobachter" erscheint
    -- dort nur, wenn das Abzeichen fuers Web eingeschaltet ist.
    if wahl is not null and stufe = 'web' and not public.profile_web_badge_on(wahl, p.web_badges) then
      wahl := null;
    end if;
    if wahl is not null then
      titel := jsonb_build_object('kind', 'badge', 'id', wahl);
    else
      wahl := (select r.x from unnest(public.profile_rank_ids()) with ordinality as r(x, nr)
                where verdient ? r.x order by r.nr desc limit 1);
      if wahl is not null then
        titel := jsonb_build_object('kind', 'rank', 'id', wahl);
      end if;
    end if;
    if titel is not null then
      werte := werte || jsonb_build_object('title', titel);
    end if;
  end if;

  if stufe = 'web' then
    -- Gesamtfortschritt: nur die abgerundete Stufe (siehe Kopf). Zaehlt keiner
    -- der Bereiche Koerper, Training, Erholung & Fitness, gibt es keine Stufe
    -- (sonst verriete sie allein den Blut- oder Einnahmeverlauf). Die Stufe kommt
    -- aus der ungerundeten Zahl des Geraets; dass sie gueltig ist, hat
    -- profile_snapshot_clean schon geprueft (sonst fehlt progress).
    if werte ? 'progress' then
      oben := case when exists (select 1 from jsonb_object_keys(werte #> '{progress,areas}') a(k)
                                 where a.k in ('koerper', 'training', 'erholung'))
                   then to_jsonb(public.profile_web_progress_tier(
                          (public.profile_snap_num(roh #> '{progress,total}') #>> '{}')::numeric)) end;
      if oben is null then
        werte := werte - 'progress';
      else
        werte := jsonb_set(werte, '{progress}', jsonb_build_object('tier', oben));
      end if;
    end if;
    -- Abzeichen: nur mit Web-Freigabe, Reihenfolge des Geraets.
    if werte ? 'badges' then
      oben := (select jsonb_agg(b.x order by b.nr)
                 from jsonb_array_elements(werte -> 'badges') with ordinality as b(x, nr)
                where public.profile_web_badge_on(b.x #>> '{}', p.web_badges));
      if oben is null then
        werte := werte - 'badges';
      else
        werte := jsonb_set(werte, '{badges}', oben);
      end if;
    end if;
    -- Erfahrungsberichte: nur die Anzahl; 0 = kein Hinweis auf Verborgenes.
    if werte ? 'reviews' then
      if coalesce((werte #>> '{reviews,count}')::numeric, 0) > 0 then
        werte := jsonb_set(werte, '{reviews}', jsonb_build_object('count', werte #> '{reviews,count}'));
      else
        werte := werte - 'reviews';
      end if;
    end if;
    -- Link-Karte: je Angabe nur, wenn erlaubt (siehe Kopf).
    karte := jsonb_strip_nulls(jsonb_build_object(
      'member_since', public.profile_web_member_for(p.created_at, (now() at time zone 'UTC')::date),
      'web_value_count', public.profile_web_value_count(roh),
      'entry_count', case when werte ? 'progress' then public.profile_entry_count(p.id,
                       coalesce(p.field_visibility ->> 'markers' = 'all', false),
                       coalesce(p.field_visibility ->> 'adherence' = 'all', false)) end));
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
    -- nur in der Stufe web
    'card', case when stufe = 'web' and karte <> '{}'::jsonb then karte end,
    'web_indexable', case when stufe in ('web', 'owner') then p.web_indexable end,
    -- nur fuer den Eigentuemer in seiner eigenen Sicht
    'visibility', case when stufe = 'owner' then p.field_visibility end,
    'profile_private', case when stufe = 'owner' then p.profile_private end,
    'web_link_enabled', case when stufe = 'owner' then p.web_link_enabled end,
    'web_badges', case when stufe = 'owner' then p.web_badges end,
    'title_choice', case when stufe = 'owner' then p.title_choice end,
    'personal_titles', case when stufe = 'owner' then p.personal_titles end,
    'title_consents', case when stufe = 'owner' then p.title_consents end,
    'avatar_status', case when stufe = 'owner' then p.avatar_status end,
    'cover_status', case when stufe = 'owner' then p.cover_status end
  ));
end;
$$;

revoke all on function public.profile_view(text, text) from public;
grant execute on function public.profile_view(text, text) to anon, authenticated;

commit;
