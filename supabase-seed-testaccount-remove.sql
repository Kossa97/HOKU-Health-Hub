-- Entfernt den Testaccount aus supabase-seed-testaccount.sql samt aller Daten.
-- Jede Löschung ist auf genau diesen einen Nutzer begrenzt (E-Mail-Adresse).
-- Nur mit ausdrücklicher Zustimmung ausführen (CLAUDE.md, Datenbankänderungen).
do $remove$
declare u uuid;
begin
  select id into u from auth.users where email = 'test1@trackyourdose.test';
  if u is null then
    raise notice 'Kein Testaccount vorhanden – nichts zu tun.';
    return;
  end if;
  -- Ohne ON DELETE CASCADE auf auth.users:
  delete from public.bloodwork where user_id = u;
  delete from public.weight_logs where user_id = u;
  -- Vor den Zyklen, sonst verweigert reject_referenced_plan_version_mutation das Löschen der Planversionen:
  delete from public.injection_logs where user_id = u;
  delete from public.effects where user_id = u;
  delete from public.dose_logs where user_id = u;
  -- Der Rest hängt per ON DELETE CASCADE am Nutzer:
  delete from auth.users where id = u;
  raise notice 'Testaccount % entfernt.', u;
end
$remove$;
