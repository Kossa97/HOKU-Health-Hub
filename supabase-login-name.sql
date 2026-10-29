-- Anmelden mit Benutzername (docs/login/UEBERGABE.md 3.3).
--
-- Supabase meldet nur per E-Mail an. Die Edge Function `login-name` schlägt
-- die E-Mail zum Benutzernamen serverseitig nach und meldet damit an. Die
-- Zuordnung Name → E-Mail ist nie von außen abfragbar (nur service_role);
-- sonst ließen sich E-Mail-Adressen zu öffentlichen Benutzernamen ablesen.
--
-- Weil alle Versuche über den Server laufen, greift das Limit von Supabase
-- je IP-Adresse nicht: höchstens 10 Versuche je Name in 15 Minuten.
--
-- Für die Registrierung: Ist ein Name noch frei? (Groß/klein egal.) Namen
-- sind ohnehin öffentlich (/u/<name>), die Abfrage verrät nichts Neues.
--
-- Rein additiv und idempotent: drei Funktionen, eine Tabelle, ein Index.
-- Keine bestehende Zeile wird geändert.

begin;

-- E-Mail zum Benutzernamen, Groß/klein egal. Nur für die Edge Function.
create or replace function public.email_fuer_benutzername(p_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(p_name)
  order by p.created_at nulls last
  limit 1;
$$;

revoke all on function public.email_fuer_benutzername(text) from public, anon, authenticated;
grant execute on function public.email_fuer_benutzername(text) to service_role;

-- Ist der Name frei? Für die Registrierung, auch ohne Anmeldung.
create or replace function public.benutzername_frei(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(p_name));
$$;

revoke all on function public.benutzername_frei(text) from public;
grant execute on function public.benutzername_frei(text) to anon, authenticated, service_role;

-- Versuche je Name. Ohne Richtlinien: nur die Funktion darunter schreibt.
create table if not exists public.login_name_versuche (
  id bigserial primary key,
  name text not null,
  zeit timestamptz not null default now()
);

alter table public.login_name_versuche enable row level security;
revoke all on public.login_name_versuche from anon, authenticated;

create index if not exists login_name_versuche_name_zeit on public.login_name_versuche (lower(name), zeit);

-- Einen Versuch zählen. Gibt false zurück, wenn der Name gerade gesperrt ist
-- (10 Versuche in 15 Minuten). Alte Einträge (älter als ein Tag) räumt sie mit auf.
create or replace function public.login_name_versuch(p_name text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  anzahl integer;
begin
  delete from public.login_name_versuche where zeit < now() - interval '1 day';
  select count(*) into anzahl
  from public.login_name_versuche
  where lower(name) = lower(p_name) and zeit > now() - interval '15 minutes';
  if anzahl >= 10 then
    return false;
  end if;
  insert into public.login_name_versuche (name) values (p_name);
  return true;
end;
$$;

revoke all on function public.login_name_versuch(text) from public, anon, authenticated;
grant execute on function public.login_name_versuch(text) to service_role;

commit;
