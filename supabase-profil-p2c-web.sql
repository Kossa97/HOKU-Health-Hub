-- Profil, Teilprojekt 2c: Web-Stufe der Profilansicht, Abzeichen im Web,
-- Suchmaschinen-Schalter, Titelbild ohne Anmeldung, Angaben fuer die Link-Karte.
-- Spec: docs/superpowers/specs/2026-11-02-profil-p2c-web-design.md (2, 3.3, 6, 7.2)
-- Plan: docs/superpowers/plans/2026-11-02-profil-p2c-web.md (Task 1)
-- Setzt supabase-profil-p2a-sichtbarkeit.sql und supabase-profil-p2b-fortschritt.sql
-- voraus (Reihenfolge 2a -> 2b -> 2c). Diese Datei ersetzt profile_view und
-- profile_media_visible. 2a und 2b danach NICHT erneut laufen lassen: sie setzten
-- die Fassungen ohne Web-Regeln zurueck (anon bekaeme dann wieder die ungepruefte Bio).
--
-- Additiv und idempotent: zwei Spalten per add column if not exists, eine Pruefung
-- nur wenn noch nicht da, Funktionen per create or replace. Kein drop, kein
-- delete, kein update, kein truncate. Bestehende Zeilen bleiben unberuehrt
-- (web_badges = '{}' = alles nach Standard, web_indexable = false).
--
-- Neu:
-- - profiles.web_badges: nur ABWEICHUNGEN vom Standard je Abzeichen (true = im Web
--   zeigen, false = verbergen). Standard: aus fuer die heiklen (profile_badge_web_sensitive,
--   10, "verraet Gesundheitsdaten") und die Grenzfaelle (profile_badge_web_borderline, 8;
--   Nutzer 04.11.), sonst an. "Auf Standard zuruecksetzen" = '{}'.
-- - profiles.web_indexable: Schalter "In Suchmaschinen auffindbar" (Standard aus).
--   profile_view gibt ihn in der Stufe web heraus, damit api/u.js noindex weglassen
--   kann. Die Stufe web gibt es nur bei Web-Link an und nicht privat.
-- - profile_view, Stufe web (ohne Anmeldung und "Ansehen als Web-Link"):
--   fields nur aus profile_web_fields() mit Stufe "Alle":
--     cover, country, goals    aus profiles (cover nur gepruefte Datei)
--     bio                      nur wenn sie oeffentlicher_text_fehler besteht (Nutzer 04.11.)
--     streak                   aus dem bereinigten Schnappschuss
--     progress                 NUR {"tier": 10|20|30|50|75|100} = groesste Stufe <= total
--                              (Nutzer 04.11.: "ueber X %", abgerundet). Kein total,
--                              keine areas, kein since: sonst liesse sich der Blut- und
--                              Einnahmeanteil aus total minus Web-Bereichen ausrechnen.
--                              Fehlt, wenn total < 10 (oder nicht positiv) oder wenn
--                              keiner der Bereiche koerper/training/erholung zaehlt
--                              (Schutzregel Spec 1.1).
--     badges                   nur die mit Web-Freigabe (web_badges bzw. Standard)
--     reviews                  nur {count}, nur wenn > 0
--   card (fuer die Link-Karte und die Web-Seite; fehlt ein Wert, fehlt der Schluessel):
--     member_since    nur als Dauer {"unit": "days"|"months"|"years", "n": ganze Zahl},
--                     abgerundet, nie das Datum: unter 31 Tagen Tage, bis 365 Tage Monate
--                     (Tage / 30.44), sonst Jahre (Tage / 365.25), gezaehlt in UTC.
--                     Immer in der Stufe web (Nutzer 04.11.: kein Feld-Gate).
--     web_value_count Zahl der Werte in Koerper/Training/Erholung aus progress.counts
--                     des Schnappschusses, immer in der Stufe web (unabhaengig von
--                     progress), wenn alle vorhandenen der drei Zahlen gueltig sind
--     entry_count     Zahl aller Eintraege (ohne Aufschluesselung), nur wenn progress
--                     (die Stufe) im Web steht; Blutwerte nur bei Feld markers auf
--                     "Alle", Einnahmen nur bei Feld adherence auf "Alle"
--                     (Nutzer 04.11.); gezaehlt: profile_entry_count unten
--   web_indexable  true/false
--   Kartenwahl in api/_lib/profileCard.js: progress.tier da -> Fortschrittskarte,
--   sonst Rueckfallkarte ("trackt N Werte" aus card.web_value_count).
--   Nie in web: gender, Gesundheitswerte, genaue Fortschrittszahlen, Bereiche,
--   Blut/Einnahmen (auch nicht als Bereich), Substanzen, Routine, Uebungen, e1RM,
--   Berichte-Inhalte oder avgRating, Freunde, visibility, web_badges, Beitrittsdatum.
-- - profile_view, Eigentuemer in eigener Sicht: zusaetzlich web_badges und web_indexable.
-- - profile_media_visible: Titelbild auch ohne Anmeldung bei Web-Link an, nicht privat,
--   cover auf "Alle", geprueft, Objekt-ID passt (wie das Profilbild in 2a).
-- Stufen owner/friends/all bleiben wie in 2b (Probe 9 im Trockenlauf vergleicht sie).
--
-- Vertrag mit dem Geraet (Task 2): Der Schnappschuss darf unter progress.counts je
-- Bereich die Zahl der Werte ablegen, die in den Fortschritt eingehen, z. B.
-- {"koerper": 4, "training": 3, "erholung": 2}. Gelesen werden nur die drei
-- Web-Bereiche, je ganze Zahl 0..1000; profile_snapshot_clean (2b) gibt counts an
-- andere nicht weiter. Fehlt counts, fehlt web_value_count.
--
-- Abzeichen-Listen: profile_badge_web_sensitive() und profile_badge_web_borderline()
-- muessen mit BADGES_WEB_SENSITIVE / BADGES_WEB_BORDERLINE in
-- src/features/profil/lib/badgeIds.ts uebereinstimmen (Test in Task 2).
--
-- Ausfuehren: Supabase -> SQL Editor -> diese Datei einfuegen -> Run.
-- VOR dem Lauf (Erwartung in Klammern; profile_entry_count braucht diese Tabellen):
--   select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relkind = 'r'
--      and c.relname in ('daily_logs','weight_logs','body_measurements','bloodwork',
--                        'training_sessions','food_logs','water_logs','dose_logs',
--                        'progress_photos');                                           -- 9
--   select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'profile_fields';                      -- 1 (2b lief)
-- VOR und NACH dem Lauf zaehlen (nur Zahlen, keine Inhalte ausgeben):
--   select count(*) from public.profiles;                                       -- unveraendert
--   select count(*) from public.profile_snapshots;                              -- unveraendert
--   select count(*) from public.profiles where field_visibility <> '{}'::jsonb; -- unveraendert
--   select count(*) from public.profiles where web_link_enabled;                -- unveraendert
-- Danach pruefen (Erwartung in Klammern):
--   select count(*) from information_schema.columns
--    where table_schema = 'public' and table_name = 'profiles'
--      and column_name in ('web_badges','web_indexable');                       -- 2
--   select count(*) from pg_constraint where conname = 'profiles_web_badges_check'
--      and conrelid = 'public.profiles'::regclass;                              -- 1
--   select count(*) from public.profiles where web_badges <> '{}'::jsonb;       -- 0
--   select count(*) from public.profiles where web_indexable;                   -- 0
--   select count(*) from public.profiles where not public.profile_web_badges_ok(web_badges); -- 0
--   select cardinality(public.profile_badge_web_sensitive());                   -- 10
--   select cardinality(public.profile_badge_web_borderline());                  -- 8
--   select cardinality(public.profile_web_fields());                            -- 8
--   select count(distinct p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname in ('profile_badge_web_sensitive',
--          'profile_badge_web_borderline','profile_web_badge_on','profile_web_badges_ok',
--          'profile_web_fields','profile_web_value_count','profile_web_progress_tier',
--          'profile_web_member_for','profile_entry_count',
--          'profile_view','profile_media_visible');                              -- 11
--   select has_function_privilege('anon', 'public.profile_entry_count(uuid, boolean, boolean)', 'execute'); -- false
--   select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
--      and policyname = 'Visible profile media select';                         -- 1
--   select public.profile_view('<ein Name>', null) is null;  -- als anon, Web-Link aus: true
--
-- Trockenlauf und Proben (Postgres 16, als anon): docs/profil/profil-p2c-trockenlauf.md

begin;

-- 1. Spalten ------------------------------------------------------------------
alter table public.profiles
  add column if not exists web_badges jsonb not null default '{}'::jsonb,
  add column if not exists web_indexable boolean not null default false;

-- 2. Abzeichen im Web (Spec 6.1) ----------------------------------------------
-- Heikel: verraten Blut, Zyklen, Einnahmen oder Koerperwerte. Ab Werk aus, in der
-- Einstellung mit "verraet Gesundheitsdaten".
create or replace function public.profile_badge_web_sensitive()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'first_bloodwork','bloodwork_3','all_markers_in_range',
    'first_cycle_done',
    'intake_all_30',
    'body_fat_5','body_fat_10','body_fat_20','weight_5','resting_hr_5']::text[];
$$;

-- Grenzfaelle: ab Werk ebenfalls aus (Nutzer 04.11., Spec Frage 7), ohne den Hinweis.
create or replace function public.profile_badge_web_borderline()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'weighed_weeks_8','first_measurement','first_progress_photo',
    'wearable_connected','steps_week_10k',
    'progress_10','progress_25','progress_50']::text[];
$$;

-- Wirksam im Web: Abweichung des Nutzers, sonst Standard.
create or replace function public.profile_web_badge_on(p_id text, p_overrides jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    case when jsonb_typeof(p_overrides -> p_id) = 'boolean' then (p_overrides ->> p_id)::boolean end,
    not (p_id = any (public.profile_badge_web_sensitive() || public.profile_badge_web_borderline())));
$$;

-- web_badges: Objekt { Abzeichen-ID: true|false }, nur bekannte IDs, hoechstens so
-- viele Schluessel wie bekannte Abzeichen.
create or replace function public.profile_web_badges_ok(v jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- case statt and: jsonb_each wirft bei allem ausser einem Objekt.
  select case when jsonb_typeof(v) = 'object' then
           (select count(*) from jsonb_object_keys(v)) <= cardinality(public.profile_badge_ids())
           and not exists (
             select 1 from jsonb_each(v) e
              where e.key <> all (public.profile_badge_ids())
                 or jsonb_typeof(e.value) <> 'boolean')
         else false end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'profiles_web_badges_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_web_badges_check
      check (public.profile_web_badges_ok(web_badges));
  end if;
end;
$$;

-- 3. Felder, die es ueberhaupt ins Web schaffen koennen -----------------------
-- Jeweils nur bei Stufe "Alle"; bio zusaetzlich nur nach Textpruefung.
create or replace function public.profile_web_fields()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['cover','country','goals','bio','streak','progress','badges','reviews']::text[];
$$;

-- 4. Angaben fuer die Link-Karte ----------------------------------------------
-- Fortschrittsstufe: groesste Schwelle <= total, sonst nichts (auch bei total <= 0).
create or replace function public.profile_web_progress_tier(v numeric)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when v >= 100 then 100 when v >= 75 then 75 when v >= 50 then 50
              when v >= 30 then 30 when v >= 20 then 20 when v >= 10 then 10 end;
$$;

-- Mitgliedschaft als Dauer, abgerundet; das Datum selbst geht nie ins Web.
create or replace function public.profile_web_member_for(p_since timestamptz, p_heute date)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_since is null then null
    when t.d < 31 then jsonb_build_object('unit', 'days', 'n', t.d)
    -- 365 Tage ergaeben mit 365.25 noch "0 Jahre": Jahre erst ab einem vollen Jahr.
    when t.d < 366 then jsonb_build_object('unit', 'months', 'n', floor(t.d / 30.44)::integer)
    else jsonb_build_object('unit', 'years', 'n', floor(t.d / 365.25)::integer)
  end
  from (select greatest(p_heute - (p_since at time zone 'UTC')::date, 0) as d) t;
$$;

-- Zahl der Werte in den Web-Bereichen aus dem Schnappschuss des Geraets
-- (progress.counts, siehe Kopf). Blut und Einnahmen werden nie gelesen. Ist einer
-- der drei Eintraege da, aber keine ganze Zahl 0..1000, gibt es keine Zahl (keine
-- Teilsumme, die zu klein waere).
create or replace function public.profile_web_value_count(s jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when bool_and(t.ok) and sum(t.c) > 0 then sum(t.c)::integer end
    from (select u.c, u.roh is null or (u.c is not null and u.c = trunc(u.c) and u.c between 0 and 1000) as ok
            from (select s #> array['progress', 'counts', a.k] as roh,
                         (public.profile_snap_num(s #> array['progress', 'counts', a.k]) #>> '{}')::numeric as c
                    from unnest(array['koerper', 'training', 'erholung']) as a(k)) u) t;
$$;

-- Zahl aller Eintraege eines Nutzers, ohne Aufschluesselung. Gezaehlt wird, was der
-- Nutzer selbst eintraegt (je Zeile): Tagebuch, Gewicht, Koerpermasse, Workouts,
-- Mahlzeiten, Wasser (Tage mit Menge), Fortschrittsfotos; Blutwerte nur mit
-- p_blut, bestaetigte Einnahmen nur mit p_einnahmen (profile_view setzt beides nur,
-- wenn das Feld markers bzw. adherence auf "Alle" steht).
-- Nicht: health_daily (kommt automatisch aus Apple Health / Health Connect),
-- injection_logs (Zusatz zu einer Einnahme), Erfahrungsberichte, Stack und Plaene.
-- Jede Teilzaehlung laeuft ueber einen Index mit user_id vorne.
-- Nur fuer profile_view; niemand sonst darf sie aufrufen (fremde IDs!).
create or replace function public.profile_entry_count(p_user uuid, p_blut boolean, p_einnahmen boolean)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select nullif((
      (select count(*) from public.daily_logs x where x.user_id = p_user)
    + (select count(*) from public.weight_logs x where x.user_id = p_user)
    + (select count(*) from public.body_measurements x where x.user_id = p_user)
    + (select count(*) from public.bloodwork x where p_blut and x.user_id = p_user)
    + (select count(*) from public.training_sessions x where x.user_id = p_user)
    + (select count(*) from public.food_logs x where x.user_id = p_user)
    + (select count(*) from public.water_logs x where x.user_id = p_user and x.ml > 0)
    + (select count(*) from public.dose_logs x where p_einnahmen and x.user_id = p_user and x.taken is true)
    + (select count(*) from public.progress_photos x where x.user_id = p_user)
  )::integer, 0);
$$;

revoke all on function public.profile_entry_count(uuid, boolean, boolean) from public, anon, authenticated;

-- 5. Bilder anderer: Titelbild jetzt auch ohne Anmeldung ----------------------
-- Wie 2a; neu ist nur die letzte Bedingung beim Titelbild.
create or replace function public.profile_media_visible(p_name text, p_object_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
     where not p.hidden_by_moderation
       and not public.profile_blocked_between(auth.uid(), p.id)
       and (
         -- Profilbild: immer sichtbar, sobald jemand das Profil findet;
         -- ohne Anmeldung nur bei eingeschaltetem Web-Link.
         (p.avatar_path = p_name and p.avatar_status = 'approved' and p.avatar_object_id = p_object_id
           and (auth.uid() is not null or (p.web_link_enabled and not p.profile_private)))
         -- Titelbild: nicht privat, Stufe "Alle" (Freunde ab Teilprojekt 3);
         -- ohne Anmeldung nur bei eingeschaltetem Web-Link (2c).
         or (p.cover_path = p_name and p.cover_status = 'approved' and p.cover_object_id = p_object_id
           and not p.profile_private
           and p.field_visibility ->> 'cover' = 'all'
           and (auth.uid() is not null or p.web_link_enabled))
       ));
$$;

revoke all on function public.profile_media_visible(text, uuid) from public;
grant execute on function public.profile_media_visible(text, uuid) to anon, authenticated;

-- 6. Profilansicht: wie 2b, dazu die Stufe web (siehe Kopf) --------------------
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
    'avatar_status', case when stufe = 'owner' then p.avatar_status end,
    'cover_status', case when stufe = 'owner' then p.cover_status end
  ));
end;
$$;

revoke all on function public.profile_view(text, text) from public;
grant execute on function public.profile_view(text, text) to anon, authenticated;

commit;
