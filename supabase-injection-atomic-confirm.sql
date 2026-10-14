-- Injektionstracker: Einnahme bestaetigen und Injektionsstelle speichern in
-- EINER Transaktion.
--
-- Bisher zwei Aufrufe vom Geraet: erst `confirm_intake_group` (Einnahme ist
-- bestaetigt), dann ein Insert in `injection_logs`. Brach der zweite ab
-- (Netz weg, App geschlossen, Konflikt), war die Dosis gebucht, aber ohne
-- Stelle -- und die Rotationswarnung kannte die Injektion nicht.
--
-- `confirm_intake_with_injection` ruft dieselbe `confirm_intake_group` auf
-- (keine zweite Bestaetigungslogik) und legt die Stelle direkt danach an.
-- Ein Fehler in einem der beiden Schritte rollt beide zurueck.
--
-- Dosis, Einheit, Methode, Zeitpunkt, Substanz und Zyklus der Stelle kommen
-- aus der gerade bestaetigten Einnahme, nicht vom Geraet: sie koennen nicht
-- auseinanderlaufen. Vom Geraet kommen nur Stelle, Notiz und Warnstufe.
--
-- SECURITY INVOKER: der Insert laeuft unter der Policy „Own injection logs“
-- (auth.uid() = user_id). `confirm_intake_group` bleibt SECURITY DEFINER mit
-- ihren eigenen Pruefungen. Bestand (Vials) bucht das Geraet weiter danach,
-- getrennt wiederholbar wie bisher.
--
-- Aendert KEINE Daten und KEIN Tabellenschema. Zweimal laufen ist erlaubt
-- (`create or replace`).

create or replace function public.confirm_intake_with_injection(p_entry jsonb, p_injection jsonb)
returns jsonb
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_dose public.dose_logs;
  v_injection_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_entry) is distinct from 'object' or jsonb_typeof(p_injection) is distinct from 'object' then
    raise exception 'entry and injection must be json objects' using errcode = '22023';
  end if;
  if coalesce(btrim(p_injection->>'site'), '') = '' then
    raise exception 'injection site is required' using errcode = '22023';
  end if;

  -- Genau eine Einnahme. STRICT: keine oder mehrere Zeilen sind ein Fehler.
  -- `taken` wird hier gesetzt, nicht vom Geraet uebernommen: eine Stelle
  -- gehoert nie zu einer uebersprungenen Einnahme.
  select * into strict v_dose
  from public.confirm_intake_group(jsonb_build_array(p_entry || '{"taken": true}'::jsonb));

  if v_dose.user_id is distinct from v_user then
    raise exception 'confirmed intake belongs to another user' using errcode = '42501';
  end if;
  if v_dose.taken is distinct from true then
    raise exception 'intake was not confirmed as taken' using errcode = '22023';
  end if;

  insert into public.injection_logs (
    user_id, dose_log_id, stack_item_id, cycle_id,
    dose, unit, method, logged_at,
    notes, site, substance_label,
    body_region, body_side, model_version,
    position, normal, uv, camera_state, warning_state
  ) values (
    v_user, v_dose.id, v_dose.stack_item_id, v_dose.cycle_id,
    v_dose.dose, v_dose.unit, v_dose.method, v_dose.logged_at,
    nullif(btrim(p_injection->>'notes'), ''),
    p_injection->>'site',
    nullif(btrim(p_injection->>'substance_label'), ''),
    p_injection->>'body_region',
    p_injection->>'body_side',
    p_injection->>'model_version',
    nullif(p_injection->'position', 'null'::jsonb),
    nullif(p_injection->'normal', 'null'::jsonb),
    nullif(p_injection->'uv', 'null'::jsonb),
    nullif(p_injection->'camera_state', 'null'::jsonb),
    p_injection->>'warning_state'
  )
  returning id into v_injection_id;

  return jsonb_build_object('dose_log_id', v_dose.id, 'injection_log_id', v_injection_id);
end;
$$;

revoke execute on function public.confirm_intake_with_injection(jsonb, jsonb) from public, anon;
grant execute on function public.confirm_intake_with_injection(jsonb, jsonb) to authenticated;
