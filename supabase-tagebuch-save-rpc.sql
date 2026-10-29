-- Tagebuch v2: Eintrag und Chips in EINER Transaktion speichern.
--
-- Bisher speicherte die App in mehreren Aufrufen: erst die Zeile in `effects`,
-- dann die Chips in `effect_symptoms` (loeschen, aendern, anlegen). Brach ein
-- spaeterer Aufruf ab (Netz weg, Pruefung schlaegt fehl), stand der Eintrag
-- mit neuem Titel und alten oder fehlenden Chips da.
--
-- `save_diary_entry` legt den Eintrag an (p_effect_id leer) oder aendert ihn
-- und ersetzt seine Chips vollstaendig. Ein Fehler irgendwo rollt alles zurueck.
-- Art und Intensitaet am Eintrag rechnet die Funktion selbst aus den Chips aus
-- (Art nur, wenn alle Chips sie teilen; Intensitaet = staerkster Chip) — sie
-- koennen nicht auseinanderlaufen.
--
-- SECURITY INVOKER: alles laeuft unter den Zugriffsregeln „Own effects" und
-- „Own effect symptoms" (auth.uid() = user_id) und den Triggern
-- `check_effect_references` (eigene Substanz und Einnahme) und
-- `check_effect_symptom_owner`. Fehlertexte dieser Trigger (z. B.
-- 'effect_dose_log_other_substance') kommen unveraendert bei der App an.
--
-- Aendert KEINE Daten und KEIN Tabellenschema. Zweimal laufen ist erlaubt
-- (`create or replace`). Planung: memory/projects/tagebuch.md

begin;

create or replace function public.save_diary_entry(p_effect_id uuid, p_entry jsonb, p_chips jsonb)
returns uuid
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_title text := btrim(coalesce(p_entry->>'description', ''));
  v_type text;
  v_severity smallint;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_entry) is distinct from 'object' or jsonb_typeof(p_chips) is distinct from 'array' then
    raise exception 'entry must be an object and chips an array' using errcode = '22023';
  end if;
  -- Laenge prueft die App (120); aeltere Freitext-Eintraege koennen laenger sein
  -- und muessen sich trotzdem speichern lassen.
  if v_title = '' then
    raise exception 'diary_title_required' using errcode = '22023';
  end if;
  if jsonb_array_length(p_chips) not between 1 and 100 then
    raise exception 'diary_chips_required' using errcode = '22023';
  end if;

  select case when count(distinct c->>'kind') = 1 then min(c->>'kind') end,
         max((c->>'severity')::smallint)
    into v_type, v_severity
  from jsonb_array_elements(p_chips) c;

  if p_effect_id is null then
    insert into public.effects (
      user_id, description, type, severity, duration, occurred_at,
      stack_item_id, dose_log_id, notes, status
    ) values (
      v_user, v_title, v_type, v_severity, null, (p_entry->>'occurred_at')::timestamptz,
      nullif(p_entry->>'stack_item_id', '')::uuid, nullif(p_entry->>'dose_log_id', '')::uuid,
      nullif(btrim(p_entry->>'notes'), ''), 'eingetreten'
    )
    returning id into v_id;
  else
    update public.effects set
      description = v_title,
      type = v_type,
      severity = v_severity,
      duration = null,
      occurred_at = (p_entry->>'occurred_at')::timestamptz,
      stack_item_id = nullif(p_entry->>'stack_item_id', '')::uuid,
      dose_log_id = nullif(p_entry->>'dose_log_id', '')::uuid,
      notes = nullif(btrim(p_entry->>'notes'), '')
    where id = p_effect_id and user_id = v_user
    returning id into v_id;
    if v_id is null then
      raise exception 'diary_entry_not_found' using errcode = 'P0002';
    end if;
    delete from public.effect_symptoms where effect_id = v_id and user_id = v_user;
  end if;

  insert into public.effect_symptoms (
    effect_id, user_id, kind, symptom_key, custom_label, severity, duration_minutes, ongoing, position
  )
  select v_id, v_user,
         c->>'kind',
         nullif(c->>'symptom_key', ''),
         nullif(btrim(c->>'custom_label'), ''),
         (c->>'severity')::smallint,
         (c->>'duration_minutes')::integer,
         coalesce((c->>'ongoing')::boolean, false),
         (ord - 1)::smallint
  from jsonb_array_elements(p_chips) with ordinality as t(c, ord);

  return v_id;
end;
$$;

revoke execute on function public.save_diary_entry(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_diary_entry(uuid, jsonb, jsonb) to authenticated;

commit;

-- Pruefung: Funktion vorhanden, SECURITY INVOKER, nur fuer angemeldete Personen.
select p.proname as funktion,
       case when p.prosecdef then 'definer' else 'invoker' end as sicherheit,
       has_function_privilege('anon', p.oid, 'execute') as anon_darf,
       has_function_privilege('authenticated', p.oid, 'execute') as angemeldet_darf
from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.proname = 'save_diary_entry';
