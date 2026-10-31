-- Profil, Teilprojekt 2a: Sichtbarkeit pro Feld, Schnappschuss der Profilwerte,
-- Bild-Check-Status, Muskelmasse, Trainingsauswahl, gefilterte Profilansicht.
-- Spec: docs/superpowers/specs/2026-10-31-profil-p2a-sichtbarkeit-design.md
--
-- Additiv und idempotent: neue Spalten (add column if not exists), eine neue
-- Tabelle, Pruefungen nur wenn noch nicht da, Funktionen per create or replace,
-- Policies per drop policy if exists + create policy. Kein drop von Tabellen
-- oder Spalten, kein delete. is_public und share_* bleiben stehen.
--
-- Bestand (ein update mit where): Profile mit is_public = true und noch leerer
-- Sichtbarkeit bekommen Bio und Erfahrungsberichte auf "Alle" und den Web-Link an.
-- Bilder aus Teilprojekt 1 ohne Status gelten als "wird geprueft".
--
-- Freigabe bindet an die Datei, nicht nur an den Namen: Der Bild-Check merkt sich
-- die storage.objects.id der geprueften Datei (avatar_object_id, cover_object_id);
-- andere sehen nur genau dieses Objekt. Ueberschreiben an Ort und Stelle ist
-- verboten (Policy "Own profile media update" faellt weg); Loeschen und neu
-- Anlegen ergibt eine neue id und ist damit unsichtbar, bis erneut geprueft.
--
-- Anzeigename: Andere bekommen display_name nur, wenn er oeffentlicher_text_fehler
-- besteht (aeltere Namen wurden nur bei is_public geprueft); sonst zeigt die App
-- den Nutzernamen. Den Nutzernamen selbst kann profile_view nicht verbergen.
--
-- VOR dem Produktivlauf (nur zaehlen, Inhalte nicht ausgeben):
--   select count(*) from public.profiles
--    where public.oeffentlicher_text_fehler(username) is not null;                         -- 0
-- Jeder Treffer ist ein Nutzername, den nach dem Lauf jeder angemeldete Nutzer
-- sieht, obwohl er den Filter nicht besteht: vor dem Start von Hand klaeren.
--
-- Freitext im Schnappschuss (Routinename, Lieblingsuebung, Namen der Bestleistungen)
-- gibt profile_view an andere nur heraus, wenn er oeffentlicher_text_fehler besteht.
-- Den ganzen Schnappschuss baut profile_view fuer andere vorher auf seine bekannte
-- Form neu (profile_snapshot_clean): nur bekannte Schluessel, Zahlen als Zahlen.
--
-- Ausfuehren: Supabase -> SQL Editor -> diese Datei einfuegen -> Run.
-- Danach pruefen (Erwartung in Klammern):
--   select count(*) from information_schema.columns
--    where table_schema = 'public' and table_name = 'profiles'
--      and column_name in ('field_visibility','profile_private','web_link_enabled','avatar_status',
--                          'cover_status','favorite_exercise','profile_routine_id',
--                          'avatar_object_id','cover_object_id');                         -- 9
--   select count(*) from information_schema.columns
--    where table_schema = 'public' and table_name = 'daily_logs' and column_name = 'muscle_mass_kg'; -- 1
--   select count(*) from pg_class where relname = 'profile_snapshots' and relrowsecurity;    -- 1
--   select count(*) from pg_class where relname = 'profile_image_checks' and relrowsecurity; -- 1
--   select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname in ('profile_view','profile_media_visible',
--          'profile_visibility_ok','protect_profile_media_status',
--          'profile_media_object_id','profile_media_approve');                               -- 6
--   select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
--      and policyname = 'Visible profile media select';                                     -- 1
--   select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
--      and policyname = 'Own profile media update';                                         -- 0
--   select count(*) from public.profiles
--    where (avatar_status = 'approved' and avatar_object_id is null)
--       or (cover_status = 'approved' and cover_object_id is null);                          -- 0
--   select count(*) from public.profiles;                         -- unveraendert gegenueber vorher
--   select count(*) from public.profiles where field_visibility <> '{}'::jsonb;  -- = Zahl mit is_public
--
-- Feldliste (Sichtbarkeit): muss mit PROFILE_FIELDS in
-- src/features/profil/lib/profileVisibility.ts uebereinstimmen (ein Test prueft das).

begin;

-- 1. Spalten ------------------------------------------------------------------
alter table public.profiles
  add column if not exists field_visibility jsonb not null default '{}'::jsonb,
  add column if not exists profile_private boolean not null default false,
  add column if not exists web_link_enabled boolean not null default false,
  add column if not exists avatar_status text,
  add column if not exists cover_status text,
  add column if not exists favorite_exercise text,
  add column if not exists profile_routine_id uuid,
  -- storage.objects.id der Datei, die der Bild-Check freigegeben hat
  add column if not exists avatar_object_id uuid,
  add column if not exists cover_object_id uuid;

alter table public.daily_logs
  add column if not exists muscle_mass_kg numeric(4,1);

-- Sichtbarkeit: Objekt aus bekannten Feldern; fehlender Schluessel = Nur ich.
create or replace function public.profile_visibility_ok(v jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(v) = 'object'
     and not exists (
       select 1 from jsonb_each(v) e
        where e.key <> all (array[
                'cover','gender','country',
                'bio','goals','streak','member_since',
                'age','height','weight',
                'body_fat','muscle_mass','measurements',
                'adherence','substances',
                'markers','in_range',
                'steps','resting_hr','sleep','active_kcal','spo2','blood_pressure','hrv','vo2max',
                'workouts','routine','favorite_exercise','e1rm',
                'reviews'])
           or jsonb_typeof(e.value) <> 'string'
           or e.value #>> '{}' not in ('friends', 'all'));
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_field_visibility_check') then
    alter table public.profiles add constraint profiles_field_visibility_check
      check (public.profile_visibility_ok(field_visibility));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_avatar_status_check') then
    alter table public.profiles add constraint profiles_avatar_status_check
      check (avatar_status is null or avatar_status in ('pending', 'approved', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_cover_status_check') then
    alter table public.profiles add constraint profiles_cover_status_check
      check (cover_status is null or cover_status in ('pending', 'approved', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_favorite_exercise_check') then
    alter table public.profiles add constraint profiles_favorite_exercise_check
      check (favorite_exercise is null or char_length(favorite_exercise) between 1 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_profile_routine_id_fkey') then
    alter table public.profiles add constraint profiles_profile_routine_id_fkey
      foreign key (profile_routine_id) references public.training_routines(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'daily_logs_muscle_mass_kg_check') then
    alter table public.daily_logs add constraint daily_logs_muscle_mass_kg_check
      check (muscle_mass_kg is null or muscle_mass_kg between 10 and 150);
  end if;
end;
$$;

-- 2. Schnappschuss der Profilwerte --------------------------------------------
-- Das Geraet des Nutzers rechnet seine Werte mit der App-Logik und legt sie hier
-- ab. Andere lesen nie direkt, nur gefiltert ueber profile_view.
create table if not exists public.profile_snapshots (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profile_snapshots_data_check') then
    alter table public.profile_snapshots add constraint profile_snapshots_data_check
      check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 16384);
  end if;
end;
$$;

alter table public.profile_snapshots enable row level security;
drop policy if exists "Own profile snapshot" on public.profile_snapshots;
create policy "Own profile snapshot" on public.profile_snapshots
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Bildstatus: nur der Bild-Check (Dienstrolle) setzt "approved"/"rejected" --
-- und die Objekt-ID der freigegebenen Datei; der Eigentuemer aendert keins davon.
create or replace function public.protect_profile_media_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.avatar_status := case when new.avatar_path is null then null else 'pending' end;
      new.cover_status := case when new.cover_path is null then null else 'pending' end;
      new.avatar_object_id := null;
      new.cover_object_id := null;
    else
      -- Ohne Pfad darf der Eigentuemer den Status nur leeren (Hinweis
      -- „abgelehnt“ quittieren); alles andere bleibt, wie der Bild-Check es setzte.
      if new.avatar_path is distinct from old.avatar_path then
        new.avatar_status := case when new.avatar_path is null then null else 'pending' end;
        new.avatar_object_id := null;
      else
        if not (new.avatar_path is null and new.avatar_status is null) then
          new.avatar_status := old.avatar_status;
        end if;
        new.avatar_object_id := old.avatar_object_id;
      end if;
      if new.cover_path is distinct from old.cover_path then
        new.cover_status := case when new.cover_path is null then null else 'pending' end;
        new.cover_object_id := null;
      else
        if not (new.cover_path is null and new.cover_status is null) then
          new.cover_status := old.cover_status;
        end if;
        new.cover_object_id := old.cover_object_id;
      end if;
    end if;
  elsif tg_op = 'UPDATE' then
    -- Auch fuer die Dienstrolle: ein anderer Pfad gehoert nie zur alten Freigabe.
    if new.avatar_path is distinct from old.avatar_path
       and new.avatar_object_id is not distinct from old.avatar_object_id then
      new.avatar_object_id := null;
    end if;
    if new.cover_path is distinct from old.cover_path
       and new.cover_object_id is not distinct from old.cover_object_id then
      new.cover_object_id := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_media_status on public.profiles;
create trigger profiles_protect_media_status
before insert or update on public.profiles
for each row execute function public.protect_profile_media_status();

-- Zaehler fuer das Tageslimit des Bild-Checks (20 je Nutzer und 24 Stunden).
-- Schreibt nur die Funktion profile-image-check (Dienstrolle); der Nutzer darf
-- seine Zeilen lesen. Kein Bild, kein Ergebnis — nur der Zeitpunkt.
create table if not exists public.profile_image_checks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamptz not null default now()
);
create index if not exists profile_image_checks_user_created_idx
  on public.profile_image_checks (user_id, created_at desc);
alter table public.profile_image_checks enable row level security;
drop policy if exists "Read own profile image checks" on public.profile_image_checks;
create policy "Read own profile image checks" on public.profile_image_checks
  for select to authenticated using (auth.uid() = user_id);

-- 4. Bestand ------------------------------------------------------------------
-- Vor dem neuen Textfilter (Abschnitt 5): die bisher oeffentliche Bio wurde
-- unter dem alten Filter schon geprueft.
update public.profiles
   set field_visibility = '{"bio": "all", "reviews": "all"}'::jsonb,
       web_link_enabled = true
 where is_public = true
   and field_visibility = '{}'::jsonb;

update public.profiles set avatar_status = 'pending' where avatar_path is not null and avatar_status is null;
update public.profiles set cover_status = 'pending' where cover_path is not null and cover_status is null;
-- Freigaben ohne Objekt-ID (vor der Bindung an die Datei) werden neu geprueft.
update public.profiles set avatar_status = 'pending'
 where avatar_path is not null and avatar_status = 'approved' and avatar_object_id is null;
update public.profiles set cover_status = 'pending'
 where cover_path is not null and cover_status = 'approved' and cover_object_id is null;

-- 5. Textfilter: Name und Nickname sieht jeder, der das Profil findet; die Bio,
--    sobald sie nicht auf "Nur ich" steht.
create or replace function public.check_public_profile_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  teile text[] := '{}';
  fehler text;
  bio_sichtbar boolean := coalesce(new.field_visibility ? 'bio', false);
begin
  if tg_op = 'INSERT'
     or new.username is distinct from old.username
     or new.display_name is distinct from old.display_name then
    teile := teile || array[new.username, new.display_name];
  end if;
  if bio_sichtbar and (tg_op = 'INSERT'
       or new.public_bio is distinct from old.public_bio
       or not coalesce(old.field_visibility ? 'bio', false)) then
    teile := teile || array[new.public_bio];
  end if;
  if cardinality(teile) = 0 then
    return new;
  end if;
  fehler := public.oeffentlicher_text_fehler(array_to_string(teile, ' '));
  if fehler is not null then
    raise exception '%', replace(fehler, 'oeffentlicher_text_', 'oeffentliches_profil_') using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- 6. Wer ist fuer wen blockiert (beide Richtungen) ------------------------------
create or replace function public.profile_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_a is not null and p_b is not null and exists (
    select 1 from public.user_blocks b
     where (b.blocker_id = p_a and b.blocked_id = p_b)
        or (b.blocker_id = p_b and b.blocked_id = p_a));
$$;

revoke all on function public.profile_blocked_between(uuid, uuid) from public, anon, authenticated;

-- 7. Bilder anderer: nur freigegebene, nur fuer erlaubte Betrachter -------------
-- Freigegeben ist genau die Datei mit der gemerkten Objekt-ID; eine neue Datei
-- unter demselben Namen (Loeschen + neu Anlegen) hat eine andere id.
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
         -- Titelbild: nur angemeldet, nicht privat, Stufe "Alle" (Freunde ab Teilprojekt 3).
         or (p.cover_path = p_name and p.cover_status = 'approved' and p.cover_object_id = p_object_id
           and auth.uid() is not null and not p.profile_private
           and p.field_visibility ->> 'cover' = 'all')
       ));
$$;

revoke all on function public.profile_media_visible(text, uuid) from public;
grant execute on function public.profile_media_visible(text, uuid) to anon, authenticated;

drop policy if exists "Visible profile media select" on storage.objects;
create policy "Visible profile media select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'profile-media' and public.profile_media_visible(name, id));

-- Kein Ueberschreiben an Ort und Stelle (upsert, update, move): sonst bekaeme
-- neuer Inhalt die id der geprueften Datei. Die App laedt jedes Bild unter
-- neuem Namen hoch (upsert: false) und loescht das alte. Teilprojekt 1 hatte
-- diese Policy angelegt.
drop policy if exists "Own profile media update" on storage.objects;

-- 7a. Fuer den Bild-Check (nur Dienstrolle) --------------------------------------
-- Objekt-ID einer Datei im Bucket; die Funktion liest sie vor dem Herunterladen.
create or replace function public.profile_media_object_id(p_name text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select o.id from storage.objects o where o.bucket_id = 'profile-media' and o.name = p_name;
$$;

-- Freigeben, nur wenn noch dasselbe Bild hinterlegt ist, es noch auf die
-- Pruefung wartet und unter dem Namen noch genau die gepruefte Datei liegt.
-- Die Sperre haelt die Datei bis zum Ende der Transaktion fest. false = nichts
-- geaendert (Status bleibt pending, die App fragt spaeter wieder).
create or replace function public.profile_media_approve(p_user uuid, p_kind text, p_name text, p_object_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  perform 1 from storage.objects o
   where o.id = p_object_id and o.bucket_id = 'profile-media' and o.name = p_name
   for share;
  if not found then
    return false;
  end if;
  if p_kind = 'avatar' then
    update public.profiles
       set avatar_status = 'approved', avatar_object_id = p_object_id
     where id = p_user and avatar_path = p_name and avatar_status = 'pending';
  elsif p_kind = 'cover' then
    update public.profiles
       set cover_status = 'approved', cover_object_id = p_object_id
     where id = p_user and cover_path = p_name and cover_status = 'pending';
  else
    return false;
  end if;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.profile_media_object_id(text) from public, anon, authenticated;
grant execute on function public.profile_media_object_id(text) to service_role;
revoke all on function public.profile_media_approve(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.profile_media_approve(uuid, text, text, uuid) to service_role;

-- 7b. Schnappschuss fuer andere auf seine bekannte Form bringen ---------------
-- Den Schnappschuss schreibt das Geraet des Eigentuemers; fuer andere ist er
-- nicht vertrauenswuerdig. Jedes Feld wird hier neu gebaut: nur bekannte
-- Schluessel, Zahlen nur als Zahlen (Betrag unter 1e9), feste Einheiten,
-- Umfangsorte nur aus der Stellenliste, Texte und Listen in der Laenge begrenzt.
-- Alles andere faellt weg. Form: src/features/profil/lib/profileSnapshot.ts.
create or replace function public.profile_snap_num(v jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(v) = 'number' and abs((v #>> '{}')::numeric) < 1000000000 then v end;
$$;

create or replace function public.profile_snap_text(v jsonb, max_len integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(v) = 'string' then nullif(left(btrim(v #>> '{}'), max_len), '') end;
$$;

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

  return aus;
end;
$$;

-- 8. Profilansicht: gibt nur freigegebene Felder heraus ------------------------
-- Stufe des Betrachters: Eigentuemer alles (oder p_as: friends/all/web zum
-- "Ansehen als"), angemeldet "all", ohne Anmeldung "web". "friends" gilt fuer
-- andere erst mit Teilprojekt 3.
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
    erlaubt := array(select unnest(array[
      'cover','gender','country','bio','goals','streak','member_since','age','height','weight',
      'body_fat','muscle_mass','measurements','adherence','substances','markers','in_range',
      'steps','resting_hr','sleep','active_kcal','spo2','blood_pressure','hrv','vo2max',
      'workouts','routine','favorite_exercise','e1rm','reviews']));
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

-- 9. Erfahrungsberichte: nur angemeldet, nur bei Feld "reviews" = "Alle" -------
create or replace function public.public_profile_reviews(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  profil record;
  eigen boolean;
begin
  if auth.uid() is null then
    return null;
  end if;
  select p.id, p.username, p.display_name, p.public_bio, p.profile_private, p.field_visibility
    into profil
    from public.profiles p
   where lower(p.username) = lower(trim(p_username))
     and p.hidden_by_moderation = false
   order by (p.username = trim(p_username)) desc
   limit 1;
  if profil.id is null then
    return null;
  end if;
  eigen := profil.id = auth.uid();
  if not eigen and public.profile_blocked_between(auth.uid(), profil.id) then
    return jsonb_build_object('username', profil.username, 'blocked', true, 'own', false);
  end if;
  if not eigen and (profil.profile_private or coalesce(profil.field_visibility ->> 'reviews', '') <> 'all') then
    return null;
  end if;

  return jsonb_build_object(
    'username', profil.username,
    'display_name', case when eigen or public.oeffentlicher_text_fehler(profil.display_name) is null
                         then profil.display_name end,
    'public_bio', case when eigen or profil.field_visibility ->> 'bio' = 'all' then profil.public_bio end,
    'blocked', false,
    'own', eigen,
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', r.id,
          'substanz', s.display_name,
          'rating', r.rating,
          'title', nullif(r.title, ''),
          'body', r.body,
          'pros', r.pros,
          'cons', r.cons,
          'wirkung', r.wirkung,
          'vertraeglichkeit', r.vertraeglichkeit,
          'wieder_nehmen', r.wieder_nehmen,
          'monat', to_char(r.created_at at time zone 'UTC', 'YYYY-MM')
        ) order by r.created_at desc)
        from public.reviews r
        join public.stack_items s on s.id = r.stack_item_id
       where r.user_id = profil.id
         and r.is_public = true
         and r.hidden_by_moderation = false
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.public_profile_reviews(text) from public, anon;
grant execute on function public.public_profile_reviews(text) to authenticated;

-- 10. Blockieren und Melden: jedes auffindbare Profil, nicht nur is_public ------
create or replace function public.set_profile_block(p_username text, p_blocked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ziel uuid;
begin
  if auth.uid() is null then
    raise exception 'anmeldung_noetig' using errcode = '42501';
  end if;
  if p_blocked then
    select id into ziel from public.profiles
     where lower(username) = lower(trim(p_username)) and not hidden_by_moderation
     order by (username = trim(p_username)) desc
     limit 1;
  else
    select b.blocked_id into ziel from public.user_blocks b
      join public.profiles p on p.id = b.blocked_id
     where b.blocker_id = auth.uid() and lower(p.username) = lower(trim(p_username))
     order by (p.username = trim(p_username)) desc
     limit 1;
  end if;
  if ziel is null or ziel = auth.uid() then
    return;
  end if;
  if p_blocked then
    insert into public.user_blocks (blocker_id, blocked_id) values (auth.uid(), ziel) on conflict do nothing;
  else
    delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = ziel;
  end if;
end;
$$;

create or replace function public.report_public_profile(p_username text, p_reason text, p_details text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
begin
  perform public.melde_grenze_pruefen();
  select pr.id, pr.username, pr.display_name,
         case when pr.field_visibility ? 'bio' then pr.public_bio end as public_bio
    into p
    from public.profiles pr
   where lower(pr.username) = lower(trim(p_username)) and not pr.hidden_by_moderation
   order by (pr.username = trim(p_username)) desc
   limit 1;
  if p.id is null or p.id = auth.uid() then
    raise exception 'meldung_nicht_moeglich' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.content_reports c
              where c.review_id is null and c.reported_user_id = p.id and c.reporter_id = auth.uid() and c.status = 'offen'
                and c.snapshot ->> 'art' = 'profil') then
    return;
  end if;
  insert into public.content_reports (review_id, reported_user_id, reporter_id, reason, details, snapshot)
  values (null, p.id, auth.uid(), p_reason, nullif(left(trim(coalesce(p_details, '')), 1000), ''),
          jsonb_build_object('art', 'profil', 'username', p.username, 'display_name', p.display_name, 'public_bio', p.public_bio));
end;
$$;

revoke all on function public.report_public_profile(text, text, text) from public, anon;
grant execute on function public.report_public_profile(text, text, text) to authenticated;

-- Eine Erfahrung melden: jede, die angemeldete andere sehen (Feld "reviews" auf
-- "Alle", Profil nicht privat), nicht mehr nur bei is_public.
create or replace function public.report_public_review(p_review_id uuid, p_reason text, p_details text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  perform public.melde_grenze_pruefen();
  select rv.user_id, rv.title, rv.body, rv.pros, rv.cons, s.display_name as substanz, p.username
    into r
    from public.reviews rv
    join public.profiles p on p.id = rv.user_id
    left join public.stack_items s on s.id = rv.stack_item_id
   where rv.id = p_review_id and rv.is_public and not rv.hidden_by_moderation
     and not p.hidden_by_moderation and not p.profile_private
     and p.field_visibility ->> 'reviews' = 'all';
  if r.user_id is null or r.user_id = auth.uid() then
    raise exception 'meldung_nicht_moeglich' using errcode = 'P0001';
  end if;
  insert into public.content_reports (review_id, reported_user_id, reporter_id, reason, details, snapshot)
  values (p_review_id, r.user_id, auth.uid(), p_reason, nullif(left(trim(coalesce(p_details, '')), 1000), ''),
          jsonb_build_object('art', 'erfahrung', 'username', r.username, 'substanz', r.substanz,
                             'title', r.title, 'body', r.body, 'pros', r.pros, 'cons', r.cons))
  on conflict do nothing;
end;
$$;

revoke all on function public.report_public_review(uuid, text, text) from public, anon;
grant execute on function public.report_public_review(uuid, text, text) to authenticated;

commit;
