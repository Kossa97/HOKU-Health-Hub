-- Tagebuch v2: neue Einträge wiederholbar anlegen (Speichern ohne Netz).
--
-- Die App merkt sich ohne Netz gespeicherte neue Einträge im Gerät und sendet
-- sie, sobald die Verbindung zurück ist. Dabei kann eine Anfrage ankommen und
-- nur die Antwort verloren gehen — ein zweiter Versuch darf dann keinen
-- zweiten Eintrag anlegen.
--
-- `save_diary_entry` nimmt deshalb beim Anlegen (p_effect_id leer) optional
-- eine id in `p_entry->>'id'` an:
--   - unbekannt → Eintrag mit dieser id anlegen (wie bisher, nur mit fester id)
--   - schon vorhanden und eigener Eintrag → nichts ändern, id zurückgeben
--   - vorhanden, aber fremd → Fehler 'diary_entry_id_taken'
-- Ohne id verhält sich die Funktion genau wie vorher (gen_random_uuid()).
-- Gleiche Signatur: ältere App-Versionen rufen sie unverändert auf.
--
-- Ändert KEINE Daten und KEIN Tabellenschema. Zweimal laufen ist erlaubt
-- (`create or replace`). Ersetzt die Funktion aus supabase-tagebuch-save-rpc.sql.

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
  v_client_id uuid;
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
    -- Eine id vom Gerät (offline gemerkter Eintrag) macht das Anlegen
    -- wiederholbar: kam der erste Versuch an und nur die Antwort ging
    -- verloren, legt der zweite nichts doppelt an und ändert nichts.
    v_client_id := nullif(p_entry->>'id', '')::uuid;
    insert into public.effects (
      id, user_id, description, type, severity, duration, occurred_at,
      stack_item_id, dose_log_id, notes, status
    ) values (
      coalesce(v_client_id, gen_random_uuid()),
      v_user, v_title, v_type, v_severity, null, (p_entry->>'occurred_at')::timestamptz,
      nullif(p_entry->>'stack_item_id', '')::uuid, nullif(p_entry->>'dose_log_id', '')::uuid,
      nullif(btrim(p_entry->>'notes'), ''), 'eingetreten'
    )
    on conflict (id) do nothing
    returning id into v_id;
    if v_id is null then
      -- Schon da: der eigene Eintrag von vorhin → unverändert zurückgeben.
      select id into v_id from public.effects where id = v_client_id and user_id = v_user;
      if v_id is null then
        raise exception 'diary_entry_id_taken' using errcode = '23505';
      end if;
      return v_id;
    end if;
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

-- Prüfung: Funktion vorhanden, SECURITY INVOKER, nur für Angemeldete, kennt die Geräte-id.
select p.proname as funktion,
       case when p.prosecdef then 'definer' else 'invoker' end as sicherheit,
       has_function_privilege('anon', p.oid, 'execute') as anon_darf,
       has_function_privilege('authenticated', p.oid, 'execute') as angemeldet_darf,
       position('v_client_id' in p.prosrc) > 0 as kennt_geraete_id
from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.proname = 'save_diary_entry';
