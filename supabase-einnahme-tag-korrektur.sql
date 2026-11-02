-- Einnahmen mit falschem Tag korrigieren (Fehler bis #104).
--
-- Beim Bestätigen wurde der geöffnete Kalendertag mit der Uhrzeit aus dem
-- Feld verbunden. Wer die Einnahme vom Abend nach Mitternacht eintrug, bekam
-- den Morgen des geplanten Tages — vor der Planzeit, obwohl erst danach
-- eingetragen wurde. Solche Einträge bekommen den Moment des Eintragens
-- (`created_at`), auf Wunsch des Nutzers.
--
-- Erkennung: bestätigt, Platz im Plan bekannt, gespeichert am Tag des Platzes
-- mehr als 6 h vor der Planzeit, aber erst nach der Planzeit angelegt; nur
-- Zeilen von vor dem Fix (#104, 2026-10-30). Idempotent: korrigiert liegt
-- `logged_at` nach der Planzeit und fällt aus der Bedingung.
update public.dose_logs d
set logged_at = d.created_at
from (
  select d2.id,
    coalesce(c.lifecycle_timezone, 'Europe/Berlin') as tz,
    to_timestamp(split_part(d2.routine_slot_key, '@', 2), 'YYYY-MM-DD"T"HH24:MI')::timestamp as plan_local
  from public.dose_logs d2
  left join public.cycles c on c.id = d2.cycle_id
  where d2.taken = true
    and d2.routine_slot_key ~ '@\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'
    and d2.created_at < timestamptz '2026-10-30 06:00:00+00'
) k
where d.id = k.id
  and (d.logged_at at time zone k.tz)::date = k.plan_local::date
  and k.plan_local - (d.logged_at at time zone k.tz) > interval '6 hours'
  and (d.created_at at time zone k.tz) > k.plan_local;
