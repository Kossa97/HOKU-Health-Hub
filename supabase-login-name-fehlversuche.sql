-- Anmelden mit Benutzername, Nachbesserung aus dem Review (27.10.2026).
-- Baut auf supabase-login-name.sql auf.
--
-- 1. Nur Fehlversuche zählen. Bisher zählte `login_name_versuch` jeden
--    Aufruf, auch gelungene Anmeldungen: wer sich zehnmal in 15 Minuten
--    anmeldete, sperrte sich selbst aus. Jetzt:
--    - `login_name_versuch(name)`   prüft nur: true = noch erlaubt
--      (weniger als 10 Fehlversuche in 15 Minuten)
--    - `login_name_fehlversuch(name)` zählt einen Fehlschlag
--    - `login_name_erfolg(name)`    setzt den Zähler des Namens zurück
--    Alle drei nur für die Edge Function (service_role).
--
-- 2. Ein Name, ein Konto — auch ohne Groß/klein. Bisher war `username` nur
--    mit Groß/klein eindeutig; `alice` neben `Alice` machte die Anmeldung per
--    Name mehrdeutig. Eindeutiger Index auf lower(username). Vor dem Lauf
--    geprüft: in der Produktion gibt es keine solchen Doppel (sonst schlägt
--    das Anlegen des Index fehl und die ganze Migration wird zurückgerollt).
--
-- Idempotent, kein drop. Einträge, die login_name_versuch bisher auch für
-- Erfolge geschrieben hat, fallen nach 15 Minuten aus der Zählung und werden
-- nach einem Tag gelöscht.

begin;

create or replace function public.login_name_versuch(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) < 10
  from public.login_name_versuche
  where lower(name) = lower(p_name) and zeit > now() - interval '15 minutes';
$$;

revoke all on function public.login_name_versuch(text) from public, anon, authenticated;
grant execute on function public.login_name_versuch(text) to service_role;

create or replace function public.login_name_fehlversuch(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.login_name_versuche where zeit < now() - interval '1 day';
  insert into public.login_name_versuche (name) values (p_name);
end;
$$;

revoke all on function public.login_name_fehlversuch(text) from public, anon, authenticated;
grant execute on function public.login_name_fehlversuch(text) to service_role;

create or replace function public.login_name_erfolg(p_name text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.login_name_versuche where lower(name) = lower(p_name);
$$;

revoke all on function public.login_name_erfolg(text) from public, anon, authenticated;
grant execute on function public.login_name_erfolg(text) to service_role;

create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));

commit;
