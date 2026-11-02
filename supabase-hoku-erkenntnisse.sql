-- Hoku-Erkenntnisse, Teil 1: Einwilligung, Funde und Wochenzettel.
--
-- Eine naechtliche Auswertung (Edge Function, Service-Rolle) sucht in den
-- Daten eines Nutzers nach Auffaelligkeiten und legt sie als "Funde" ab; aus
-- den Funden entsteht je Woche ein Zettel. Die App liest beides und darf
-- genau zwei Dinge aendern: einen Fund ausblenden (`ausgeblendet_am`) und
-- einen Wochenzettel als gelesen markieren (`gelesen_am`).
--
-- Was neu ist:
--   profiles.erkenntnisse_consent_at  Einwilligung mit Zeitpunkt; null heisst
--                                     nicht erteilt oder widerrufen
--   profiles.hoku_zeitzone            Zeitzone, in der "Sonntag" und "heute"
--                                     fuer die Auswertung gelten
--   hoku_funde                        ein Fund je (Nutzer, Schluessel)
--   hoku_wochen                       ein Zettel je (Nutzer, lokaler Sonntag)
--   Trigger profiles_stamp_erkenntnisse_consent
--                                     (BEFORE INSERT OR UPDATE OF
--                                     erkenntnisse_consent_at) setzt den
--                                     Zeitpunkt der Einwilligung auf now(),
--                                     statt dem Geraet zu glauben
--   Trigger hoku_widerruf             Widerruf loescht beide Tabellen dieses
--                                     Nutzers
--   Trigger hoku_nur_mit_einwilligung (je einer auf hoku_funde und hoku_wochen,
--                                     nur BEFORE INSERT) Einfuegen ohne
--                                     Einwilligung scheitert mit
--                                     'hoku_ohne_einwilligung'. Schliesst das
--                                     Fenster, in dem ein Widerruf zwischen
--                                     Pruefung und Einfuegen der Auswertung
--                                     laeuft: der Widerruf-Trigger sieht die
--                                     noch nicht festgeschriebene Zeile nicht
--                                     und loescht sie nie. `for share` auf dem
--                                     Profil kollidiert mit der Zeilensperre
--                                     des Widerrufs, egal wer zuerst kommt.
--
-- Schreiben tut nur die Edge Function mit der Service-Rolle: `authenticated`
-- hat kein insert und darf update nur auf je eine Spalte. Lesen und Loeschen
-- eigener Zeilen ist erlaubt (das Loeschen ist die Nutzerseite von "meine
-- Daten loeschen").
--
-- Rein additiv und idempotent: zwei neue Spalten, zwei neue Tabellen, drei
-- Funktionen, vier Trigger. Keine bestehende Zeile wird geaendert. Zweimal
-- laufen lassen ist erlaubt.
--
-- Voraussetzung: `public.tyd_is_valid_timezone` (supabase-perf-timezone-check.sql).
--
-- Zaehlung vor und nach dem Lauf (muss nach jedem Lauf gleich sein):
--
--   select count(*) from public.profiles;                           -- unveraendert
--   select count(*) from information_schema.columns
--    where table_schema = 'public' and table_name = 'profiles'
--      and column_name in ('erkenntnisse_consent_at', 'hoku_zeitzone');   -- 2 nach dem Lauf
--   select relname, relrowsecurity from pg_class
--    where relnamespace = 'public'::regnamespace
--      and relname in ('hoku_funde', 'hoku_wochen');                  -- 2 Zeilen, beide true
--   select count(*) from public.hoku_funde;                         -- 0 nach dem Lauf
--   select count(*) from public.hoku_wochen;                        -- 0 nach dem Lauf
--   select proname from pg_proc
--    where pronamespace = 'public'::regnamespace
--      and proname in ('hoku_widerruf', 'hoku_nur_mit_einwilligung',
--                      'stamp_erkenntnisse_consent');                 -- 3 Zeilen
--   select tgrelid::regclass, tgname from pg_trigger
--    where not tgisinternal
--      and tgname in ('hoku_widerruf', 'hoku_nur_mit_einwilligung',
--                     'profiles_stamp_erkenntnisse_consent');         -- 4 Zeilen

begin;

-- ── Profil: Einwilligung und Zeitzone ───────────────────────────────────────

alter table public.profiles add column if not exists erkenntnisse_consent_at timestamptz;
alter table public.profiles add column if not exists hoku_zeitzone text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_hoku_zeitzone_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_hoku_zeitzone_check
      check (hoku_zeitzone is null or public.tyd_is_valid_timezone(hoku_zeitzone));
  end if;
end;
$$;

-- ── Zeitpunkt der Einwilligung setzt die Datenbank ──────────────────────────
-- Wie `stamp_coach_consent` (supabase-coach.sql): schickt die App einen Wert,
-- wird er durch now() ersetzt, egal was die Uhr des Geraets sagt. null bleibt
-- null (Widerruf), derselbe Wert bleibt derselbe. Anders als beim Coach wird
-- ein geaenderter Wert neu gestempelt statt beim alten zu bleiben. Nur fuer
-- anon/authenticated; Service-Rolle und Admin-SQL setzen, was sie setzen.
-- Laeuft vor dem AFTER-Trigger `hoku_widerruf` und aendert nichts an dessen
-- Bedingung (null bleibt null, nicht-null bleibt nicht-null).

create or replace function public.stamp_erkenntnisse_consent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.erkenntnisse_consent_at is null then
      return new;
    end if;
    if tg_op = 'UPDATE' and new.erkenntnisse_consent_at is not distinct from old.erkenntnisse_consent_at then
      return new;
    end if;
    new.erkenntnisse_consent_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_stamp_erkenntnisse_consent on public.profiles;
create trigger profiles_stamp_erkenntnisse_consent
before insert or update of erkenntnisse_consent_at on public.profiles
for each row execute function public.stamp_erkenntnisse_consent();

-- ── Funde ───────────────────────────────────────────────────────────────────
-- `schluessel` benennt, was gefunden wurde (z. B. Auffaelligkeit + Bezug), so
-- dass die naechtliche Auswertung denselben Fund aktualisiert statt ihn zu
-- verdoppeln. `gueltig = false` heisst: die Daten tragen den Fund nicht mehr.
-- `gemeldet_*` merkt, wann und mit welcher Datenlage er zuletzt im Zettel stand.

create table if not exists public.hoku_funde (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  schluessel text not null check (char_length(schluessel) <= 200),
  fund jsonb not null check (pg_column_size(fund) <= 16384),
  datenlage text not null check (datenlage in ('hinweis', 'deutlich')),
  gueltig boolean not null default true,
  gefunden_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  gemeldet_am date,
  gemeldet_datenlage text check (gemeldet_datenlage in ('hinweis', 'deutlich')),
  ausgeblendet_am timestamptz,
  unique (user_id, schluessel)
);

create index if not exists hoku_funde_user_gueltig_idx
  on public.hoku_funde (user_id, gueltig);

-- ── Wochenzettel ────────────────────────────────────────────────────────────
-- `woche` ist der lokale Sonntag (Zeitzone aus profiles.hoku_zeitzone).
-- `sichtbar_ab` ist der Zeitpunkt, ab dem die App den Zettel zeigt.

create table if not exists public.hoku_wochen (
  user_id uuid not null references auth.users on delete cascade,
  woche date not null,
  fund_ids uuid[] not null default '{}',
  tage_eingeflossen smallint not null check (tage_eingeflossen between 0 and 7),
  sichtbar_ab timestamptz not null,
  gelesen_am timestamptz,
  erstellt_am timestamptz not null default now(),
  primary key (user_id, woche)
);

-- ── Zugriff ─────────────────────────────────────────────────────────────────
-- Lesen und Loeschen eigener Zeilen. Update nur auf eine Spalte, per
-- Spaltenrecht UND Policy. Kein insert fuer die App.

alter table public.hoku_funde enable row level security;
alter table public.hoku_wochen enable row level security;

drop policy if exists "Own hoku funde select" on public.hoku_funde;
create policy "Own hoku funde select" on public.hoku_funde
  for select using (auth.uid() = user_id);

drop policy if exists "Own hoku funde delete" on public.hoku_funde;
create policy "Own hoku funde delete" on public.hoku_funde
  for delete using (auth.uid() = user_id);

drop policy if exists "Own hoku funde update" on public.hoku_funde;
create policy "Own hoku funde update" on public.hoku_funde
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Own hoku wochen select" on public.hoku_wochen;
create policy "Own hoku wochen select" on public.hoku_wochen
  for select using (auth.uid() = user_id);

drop policy if exists "Own hoku wochen delete" on public.hoku_wochen;
create policy "Own hoku wochen delete" on public.hoku_wochen
  for delete using (auth.uid() = user_id);

drop policy if exists "Own hoku wochen update" on public.hoku_wochen;
create policy "Own hoku wochen update" on public.hoku_wochen
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke insert on public.hoku_funde from authenticated, anon;
revoke insert on public.hoku_wochen from authenticated, anon;

revoke update on public.hoku_funde from authenticated, anon;
grant update (ausgeblendet_am) on public.hoku_funde to authenticated;

revoke update on public.hoku_wochen from authenticated, anon;
grant update (gelesen_am) on public.hoku_wochen to authenticated;

-- ── Widerruf loescht ────────────────────────────────────────────────────────
-- Wird die Einwilligung auf null gesetzt, verschwinden Funde und Zettel dieses
-- Nutzers. `security definer`, damit das auch dann klappt, wenn die Tabellen
-- fuer die aufrufende Rolle (spaeter) enger werden.

create or replace function public.hoku_widerruf()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.erkenntnisse_consent_at is null and old.erkenntnisse_consent_at is not null then
    delete from public.hoku_funde where user_id = new.id;
    delete from public.hoku_wochen where user_id = new.id;
  end if;
  return null;
end;
$$;

revoke all on function public.hoku_widerruf() from public, anon, authenticated;

drop trigger if exists hoku_widerruf on public.profiles;
create trigger hoku_widerruf
after update of erkenntnisse_consent_at on public.profiles
for each row execute function public.hoku_widerruf();

-- ── Einfuegen nur mit Einwilligung ──────────────────────────────────────────
-- Zwischen der Pruefung der Einwilligung in der Edge Function und dem
-- Festschreiben des Inserts vergehen Millisekunden. Widerruft der Nutzer genau
-- dann, loescht `hoku_widerruf` zuerst (die neue Zeile ist noch nicht sichtbar),
-- danach wird der Insert festgeschrieben: Gesundheitsableitungen ohne
-- Einwilligung, die nie jemand aufraeumt. Darum prueft die Datenbank selbst,
-- und zwar mit `for share` auf der Profilzeile: das kollidiert mit der
-- Zeilensperre des Widerrufs-Updates. Kommt der Widerruf zuerst, sieht der
-- Insert nach dessen Ende die Einwilligung als null und scheitert; kommt der
-- Insert zuerst, wartet der Widerruf und loescht danach auch diese Zeile.
-- Nur bei insert, nicht bei update: ein Update darf den Widerruf nicht in einen
-- Deadlock mit seinem delete laufen lassen.

create or replace function public.hoku_nur_mit_einwilligung()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from public.profiles
   where id = new.user_id and erkenntnisse_consent_at is not null
   for share;
  if not found then
    raise exception 'hoku_ohne_einwilligung';
  end if;
  return new;
end;
$$;

revoke all on function public.hoku_nur_mit_einwilligung() from public, anon, authenticated;

drop trigger if exists hoku_nur_mit_einwilligung on public.hoku_funde;
create trigger hoku_nur_mit_einwilligung
before insert on public.hoku_funde
for each row execute function public.hoku_nur_mit_einwilligung();

drop trigger if exists hoku_nur_mit_einwilligung on public.hoku_wochen;
create trigger hoku_nur_mit_einwilligung
before insert on public.hoku_wochen
for each row execute function public.hoku_nur_mit_einwilligung();

commit;
