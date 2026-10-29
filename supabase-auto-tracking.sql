-- Dot trägt automatisch ein (Pro): Schalter an Substanz und Bündel.
--
-- Ist der Schalter an, gilt eine geplante Einnahme als genommen, sobald ihre
-- Zeit vorbei ist; der Nutzer meldet Dot nur noch, was anders war. Bestätigt
-- wird auf genau demselben Weg wie mit dem Haken (`confirm_intake_group`,
-- danach Bestand) – nur eben von der App statt vom Finger.
--
-- `auto_log_since` hält fest, SEIT WANN der Schalter an ist (null = aus):
-- nichts davor wird nachgetragen.
--
-- `dose_logs.auto_logged` markiert Einträge, die Dot gesetzt hat, damit das
-- Protokoll (Kalender, Export, Arzt) ehrlich bleibt. Wird ein Eintrag wieder
-- geöffnet (`taken` auf null), verliert er die Markierung – bestätigt ihn
-- danach der Nutzer selbst, ist es seiner.
--
-- Rein additiv und idempotent: drei neue Spalten, zwei Funktionen, ein
-- Trigger. Keine bestehende Zeile wird geändert (Standardwerte null/false).

alter table public.stack_items add column if not exists auto_log_since timestamptz;
alter table public.intake_bundles add column if not exists auto_log_since timestamptz;
alter table public.dose_logs add column if not exists auto_logged boolean not null default false;

create or replace function public.clear_auto_logged_on_reopen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.taken is null and old.taken is not null then
    new.auto_logged := false;
  end if;
  return new;
end;
$$;

create or replace trigger dose_logs_clear_auto_logged
before update of taken on public.dose_logs
for each row execute function public.clear_auto_logged_on_reopen();

-- Dot bestätigt über diese Hülle um `confirm_intake_group`: Bestätigen und
-- Markieren in EINER Transaktion. Markiert wird nur, was vorher offen war —
-- eine Einnahme, die der Nutzer schon selbst entschieden hat, bleibt seine.
-- Die Zyklen werden zuerst gesperrt (wie in `confirm_intake_group`), damit
-- kein gleichzeitiger Haken zwischen Prüfen und Bestätigen rutscht.
-- Rechte des Aufrufers (kein SECURITY DEFINER): markieren darf er nur eigene
-- Zeilen, bestätigen nur über `confirm_intake_group` mit dessen Prüfungen.
create or replace function public.confirm_intake_group_auto(p_entries jsonb)
returns setof public.dose_logs
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
declare
  owner_id uuid := auth.uid();
  schon_entschieden text[];
  saved public.dose_logs;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'At least one intake entry is required';
  end if;

  perform 1
  from public.cycles c
  where c.user_id = owner_id
    and c.id in (
      select nullif(btrim(e ->> 'cycle_id'), '')::uuid
      from jsonb_array_elements(p_entries) e
    )
  order by c.id
  for update;

  select coalesce(array_agg(d.routine_slot_key), '{}')
  into schon_entschieden
  from public.dose_logs d
  where d.user_id = owner_id
    and d.taken is not null
    and d.routine_slot_key in (
      select e ->> 'slot_key' from jsonb_array_elements(p_entries) e
    );

  for saved in select * from public.confirm_intake_group(p_entries) loop
    if saved.taken is true and not (saved.routine_slot_key = any (schon_entschieden)) then
      update public.dose_logs
      set auto_logged = true
      where id = saved.id and user_id = owner_id
      returning * into saved;
    end if;
    return next saved;
  end loop;
end;
$$;

revoke all on function public.confirm_intake_group_auto(jsonb) from public, anon;
grant execute on function public.confirm_intake_group_auto(jsonb) to authenticated;
