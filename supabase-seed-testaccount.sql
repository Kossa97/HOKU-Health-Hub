-- ============================================================================
-- Testaccount mit einem Jahr Beispieldaten (Demo / manuelle Tests)
--
--   Login:    test1@trackyourdose.test / test12
--   Profil:   männlich, *1991-03-14, 182 cm, Europe/Berlin
--   Zeitraum: 2025-10-13 bis 2026-10-12 (heute = 2026-10-13 bleibt offen,
--             damit man das Bestätigen von Einnahmen selbst testen kann)
--
-- Inhalt: Profil (Einwilligungen gesetzt), 9 Substanzen mit Zutaten und Bestand,
-- 11 Zyklen mit Planversionen (Titration, Dosisänderung, Pause, Wochentage,
-- Alle-X-Tage, Im Wechsel, beendete und laufende Zyklen, eine archivierte
-- Substanz), Einnahmen inkl. ausgelassener, Injektionsstellen, Tagebuch,
-- Gewicht, Blutbilder (5 Befunde), Wirkungen/Nebenwirkungen, Bewertungen.
-- Keine Fortschrittsfotos (die bräuchten Dateien im Storage).
--
-- Werte sind erfunden, aber plausibel. Zufall ist md5-basiert: Gewicht,
-- Tagebuch und Blutwerte hängen nur am Datum und sind bei jedem Lauf gleich;
-- welche Einnahmen ausgelassen werden, hängt an den neu erzeugten Zyklus-IDs
-- und variiert leicht (Quote bleibt gleich).
--
-- Idempotent: Existiert die E-Mail schon, tut das Skript nichts.
-- Entfernen: supabase-seed-testaccount-remove.sql
-- Muss als Eigentümer der Tabellen laufen (SQL-Editor / postgres), nicht als
-- authenticated — Zyklen und Planversionen sind für Clients gesperrt.
-- ============================================================================

create or replace function pg_temp.rnd(k text) returns numeric language sql immutable as $$
  select ('x' || lpad(substr(md5(k), 1, 12), 16, '0'))::bit(64)::bigint / 281474976710656.0
$$;

-- Lokale Berliner Uhrzeit -> Zeitpunkt
create or replace function pg_temp.at_berlin(d date, hhmm text, plus_min int default 0) returns timestamptz language sql immutable as $$
  select ((d + hhmm::time) + make_interval(mins => plus_min)) at time zone 'Europe/Berlin'
$$;

-- Zyklus + Startversion so anlegen, wie save_stack_item_with_plan es tut
create or replace function pg_temp.mk_cycle(
  p_user uuid, p_item uuid, p_name text, p_method text, p_unit text, p_dose numeric,
  p_frequency text, p_start date, p_end date, p_days text[], p_x int, p_on int, p_off int,
  p_time text, p_clock text
) returns uuid language plpgsql as $$
declare c uuid := gen_random_uuid();
begin
  insert into public.cycles (id, user_id, stack_item_id, name, dose, unit, method, frequency, start_date, end_date, active,
    created_at, x_days_interval, interval_unit, schedule_days, intake_time, intake_time_custom, reminder,
    cycle_on_days, cycle_off_days, started_at, ended_at, start_local_date, end_local_date, lifecycle_timezone)
  values (c, p_user, p_item, p_name, p_dose, p_unit, p_method, p_frequency, p_start, p_end, p_end is null,
    pg_temp.at_berlin(p_start, '07:30', -1440), p_x, case when p_x is not null then 'day' end, coalesce(p_days, '{}'),
    p_time, p_clock, 'none', p_on, p_off,
    p_start::timestamp at time zone 'Europe/Berlin',
    case when p_end is not null then pg_temp.at_berlin(p_end, '21:30') end,
    p_start, null, 'Europe/Berlin');
  insert into public.cycle_plan_versions (user_id, cycle_id, effective_kind, effective_local_date, change_kind, frequency,
    x_days_interval, interval_unit, cycle_on_days, cycle_off_days, schedule_days, intake_time, intake_time_custom, dose, unit, method, created_at)
  values (p_user, c, 'local_date', p_start, 'initial', p_frequency, p_x, case when p_x is not null then 'day' end,
    p_on, p_off, coalesce(p_days, '{}'), p_time, p_clock, p_dose, p_unit, p_method, pg_temp.at_berlin(p_start, '07:30', -1440));
  return c;
end $$;

-- Spätere Dosisänderung (Titration/Dosis): neue Version, flache Zyklusfelder nachziehen
create or replace function pg_temp.add_version(p_cycle uuid, p_from date, p_kind text, p_dose numeric) returns void language plpgsql as $$
begin
  insert into public.cycle_plan_versions (user_id, cycle_id, effective_kind, effective_local_date, change_kind, frequency,
    x_days_interval, interval_unit, cycle_on_days, cycle_off_days, schedule_days, intake_time, intake_time_custom, dose, unit, method, created_at)
  select user_id, cycle_id, 'local_date', p_from, p_kind, frequency, x_days_interval, interval_unit, cycle_on_days, cycle_off_days,
    schedule_days, intake_time, intake_time_custom, p_dose, unit, method, pg_temp.at_berlin(p_from, '07:00', -2880)
  from public.cycle_plan_versions where cycle_id = p_cycle and change_kind = 'initial';
  update public.cycles set dose = p_dose where id = p_cycle;
end $$;

-- Einnahmen eines Zyklus erzeugen: jeder fällige Slot bekommt eine Zeile,
-- taken=true (mit realistischer Abweichung zur Planzeit) oder taken=false.
create or replace function pg_temp.log_cycle(p_cycle uuid, p_adherence float8, p_last date) returns int language plpgsql as $$
declare
  c public.cycles%rowtype; v public.cycle_plan_versions%rowtype; d date; due boolean; p float8;
  tage text[] := array['So','Mo','Di','Mi','Do','Fr','Sa']; n int := 0; tl text; nimmt boolean; planned timestamptz;
begin
  select * into c from public.cycles where id = p_cycle;
  select tracking_level into tl from public.stack_items where id = c.stack_item_id;
  for d in select generate_series(c.start_date, least(coalesce(c.end_date, p_last), p_last), interval '1 day')::date loop
    due := case c.frequency
      when 'Täglich' then true
      when 'Wochentage wählen' then tage[extract(dow from d)::int + 1] = any(c.schedule_days)
      when 'Alle X Tage' then (d - c.start_date) % c.x_days_interval = 0
      when 'Im Wechsel' then (d - c.start_date) % (c.cycle_on_days + c.cycle_off_days) < c.cycle_on_days
      else false end;
    continue when not due;
    planned := pg_temp.at_berlin(d, c.intake_time_custom);
    continue when exists (select 1 from public.cycle_pause_periods pp where pp.cycle_id = c.id
      and planned >= pp.paused_at and (pp.ends_at is null or planned < pp.ends_at));
    select * into v from public.cycle_plan_versions where cycle_id = c.id and effective_local_date <= d
      order by effective_local_date desc limit 1;
    p := p_adherence - case when extract(dow from d) in (0, 6) then 0.05 else 0 end;
    nimmt := pg_temp.rnd(c.id::text || d::text) < p;
    insert into public.dose_logs (user_id, stack_item_id, dose, unit, method, logged_at, created_at, taken, routine_slot_key, cycle_id, plan_version_id)
    values (c.user_id, c.stack_item_id,
      case when tl = 'intake_only' then null else v.dose end,
      case when tl = 'intake_only' then null else v.unit end,
      v.method,
      case when nimmt then pg_temp.at_berlin(d, c.intake_time_custom, floor(pg_temp.rnd('j' || c.id::text || d::text) * 55)::int - 15) else planned end,
      case when nimmt then pg_temp.at_berlin(d, c.intake_time_custom, floor(pg_temp.rnd('j' || c.id::text || d::text) * 55)::int - 14) else pg_temp.at_berlin(d + 1, '09:00') end,
      nimmt, c.id::text || '@' || to_char(d, 'YYYY-MM-DD') || 'T' || c.intake_time_custom, c.id, v.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Injektionsstellen für bestätigte Injektionen eines Zyklus, Stellen rotierend
create or replace function pg_temp.log_injections(p_cycle uuid, p_spots text[]) returns void language plpgsql as $$
declare r record; v_spot text; v_reg text; v_side text; pos jsonb; nor jsonb; i int := 0; jx float8; jy float8;
begin
  for r in select dl.*, s.display_name from public.dose_logs dl join public.stack_items s on s.id = dl.stack_item_id
           where dl.cycle_id = p_cycle and dl.taken order by dl.logged_at loop
    v_spot := p_spots[(i % array_length(p_spots, 1)) + 1]; i := i + 1;
    jx := (pg_temp.rnd('x' || r.id::text) - 0.5) * 0.04; jy := (pg_temp.rnd('y' || r.id::text) - 0.5) * 0.04;
    -- Oberflächenpunkte aus public/models/torso_hybrid_v1.glb (Fit-Transform der App)
    select x.reg, x.side, jsonb_build_object('x', round((x.px + jx)::numeric, 4), 'y', round((x.py + jy)::numeric, 4), 'z', x.pz),
           jsonb_build_object('x', x.nx, 'y', x.ny, 'z', x.nz)
      into v_reg, v_side, pos, nor
      from (values
        ('abdomen_left',      'abdomen', 'left',  -0.176,  0.029, 0.143,  0.357, -0.195, 0.914),
        ('abdomen_right',     'abdomen', 'right',  0.180,  0.030, 0.144, -0.286, -0.193, 0.939),
        ('abdomen_low_left',  'abdomen', 'left',  -0.147, -0.111, 0.104,  0.357, -0.195, 0.914),
        ('abdomen_low_right', 'abdomen', 'right',  0.150, -0.101, 0.108, -0.286, -0.193, 0.939),
        ('thigh_left',        'thigh',   'left',  -0.206, -0.425, 0.039,  0.1,   -0.32,  0.94),
        ('thigh_right',       'thigh',   'right',  0.211, -0.421, 0.043, -0.1,   -0.32,  0.94)
      ) as x(spot, reg, side, px, py, pz, nx, ny, nz) where x.spot = v_spot;
    insert into public.injection_logs (user_id, dose_log_id, site, logged_at, created_at, stack_item_id, cycle_id, dose, unit, method,
      body_region, body_side, model_version, position, normal, substance_label)
    values (r.user_id, r.id, v_reg || '_' || v_side, r.logged_at, r.created_at, r.stack_item_id, r.cycle_id, r.dose, r.unit, r.method,
      v_reg, v_side, 'placeholder-v1', pos, nor, r.display_name);
  end loop;
end $$;

-- Wirkung/Nebenwirkung, verknüpft mit der ersten bestätigten Einnahme ab dem Tag
create or replace function pg_temp.effect(p_user uuid, p_item uuid, p_on date, p_type text, p_text text, p_sev int, p_dur text, p_notes text default null)
returns void language plpgsql as $$
declare dl public.dose_logs%rowtype;
begin
  select * into dl from public.dose_logs where stack_item_id = p_item and taken and logged_at >= pg_temp.at_berlin(p_on, '00:00')
    order by logged_at limit 1;
  insert into public.effects (user_id, stack_item_id, dose_log_id, type, description, severity, notes, occurred_at, created_at, status, duration, is_public)
  values (p_user, p_item, dl.id, p_type, p_text, p_sev, p_notes,
    coalesce(dl.logged_at, pg_temp.at_berlin(p_on, '12:00')) + interval '3 hours',
    coalesce(dl.logged_at, pg_temp.at_berlin(p_on, '12:00')) + interval '5 hours', 'eingetreten', p_dur, false);
end $$;

do $seed$
declare
  v_email    constant text := 'test1@trackyourdose.test';
  v_password constant text := 'test12';
  v_username constant text := 'test1_demo';
  v_last     constant date := date '2026-10-12';
  u uuid := gen_random_uuid();
  i_testo uuid := gen_random_uuid(); i_tirz uuid := gen_random_uuid(); i_bpc uuid := gen_random_uuid();
  i_d3 uuid := gen_random_uuid(); i_o3 uuid := gen_random_uuid(); i_crea uuid := gen_random_uuid();
  i_mg uuid := gen_random_uuid(); i_zn uuid := gen_random_uuid(); i_ana uuid := gen_random_uuid();
  c_testo uuid; c_tirz1 uuid; c_tirz2 uuid; c_bpc1 uuid; c_bpc2 uuid; c_d3 uuid; c_o3 uuid; c_crea uuid; c_mg uuid; c_zn uuid; c_ana uuid;
  rep uuid; d date; t int; w numeric; prog float8; krank boolean;
  e int; s int; l int; wb int;
begin
  if exists (select 1 from auth.users where email = v_email) then
    raise notice 'Testaccount % existiert bereits – nichts zu tun.', v_email;
    return;
  end if;
  if exists (select 1 from public.profiles where username = v_username) then
    raise exception 'Benutzername % ist schon vergeben', v_username;
  end if;

  -- ── Auth-Nutzer (bestätigt, Passwort bcrypt) ───────────────────────────────
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, last_sign_in_at)
  values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', v_email,
    extensions.crypt(v_password, extensions.gen_salt('bf')), timestamptz '2025-10-10 18:12:00+02',
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}', jsonb_build_object('username', v_username, 'email_verified', true),
    false, timestamptz '2025-10-10 18:11:00+02', now(), null);
  insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  values (u::text, u, jsonb_build_object('sub', u::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', timestamptz '2025-10-10 18:11:00+02', now());

  -- ── Profil ─────────────────────────────────────────────────────────────────
  insert into public.profiles (id, username, display_name, age, weight_kg, height_cm, gender, created_at, is_public,
    age_confirmed_at, terms_accepted_at, terms_version, bloodwork_units, birth_date, bio_sex)
  values (u, v_username, 'Test Eins', 35, 84.2, 182, 'männlich', timestamptz '2025-10-10 18:12:00+02', false,
    now(), now(), '2026-10', '{"system":"konventionell"}', date '1991-03-14', 'male');

  -- ── Substanzen ─────────────────────────────────────────────────────────────
  insert into public.stack_items (id, user_id, display_name, category, dosage_form, default_unit, default_dose, default_method,
    tracking_level, brand, color_hex, notes, vial_amount_mg, vial_amount_unit, reconstitution_ml, vials_in_stock, vials_initial,
    reconstitution_date, expiry_days, pk_profile_id, pk_profile_method, created_at, archived, archived_at) values
  (i_testo, u, 'Testosteron Enantat', 'hormone', 'vial', 'mg', 75, 'Subkutan', 'complete', 'Rotexmedica', '#2563EB',
     'TRT nach ärztlicher Rücksprache. Subkutan mit 27G-Insulinspritze.', null, 'mg', null, 0, 0, null, 28,
     '6cd2c08a-9c91-40dd-b180-f1092628ef6e', 'Subkutan', timestamptz '2025-10-10 18:20:00+02', false, null),
  (i_tirz, u, 'Tirzepatid', 'peptide', 'vial', 'mg', 2.5, 'Subkutan', 'complete', null, '#7C3AED',
     'Samstags abends spritzen, dann ist die Übelkeit über das Wochenende durch.', 30, 'mg', 3, 1.6, 2,
     date '2026-09-05', 28, 'f6fd8b77-a438-4da3-a68e-31d521d403c7', 'Subkutan', timestamptz '2025-10-10 18:25:00+02', false, null),
  (i_bpc, u, 'BPC-157', 'peptide', 'vial', 'mcg', 250, 'Subkutan', 'complete', null, '#059669',
     'Für das linke Knie (Patellasehne).', 10, 'mg', 2, 0.8, 2, date '2026-09-14', 28,
     '61cc2763-f4a5-41c0-9f79-54893eaf0700', 'Subkutan', timestamptz '2026-01-30 21:05:00+01', false, null),
  (i_d3, u, 'Vitamin D3', 'vitamin', 'capsule', 'IU', 4000, 'Oral', 'complete', 'Sunday Natural', '#F59E0B',
     'Zum Frühstück mit etwas Fett.', null, 'mg', null, 0, 0, null, 28, null, null, timestamptz '2025-10-10 18:30:00+02', false, null),
  (i_o3, u, 'Omega-3', 'supplement', 'capsule', 'mg', 2000, 'Oral', 'complete', 'Norsan', '#0EA5E9',
     null, null, 'mg', null, 0, 0, null, 28, null, null, timestamptz '2025-10-10 18:31:00+02', false, null),
  (i_crea, u, 'Creatin Monohydrat', 'supplement', 'powder', 'g', 5, 'Oral', 'complete', 'Creapure', '#64748B',
     'Im Shake nach dem Training bzw. morgens.', null, 'mg', null, 0, 0, null, 28, null, null, timestamptz '2026-01-04 10:00:00+01', false, null),
  (i_mg, u, 'Magnesium', 'supplement', 'capsule', 'mg', null, 'Oral', 'intake_only', null, '#EC4899',
     'Nur abhaken, Menge egal.', null, 'mg', null, 0, 0, null, 28, null, null, timestamptz '2026-03-31 22:00:00+02', false, null),
  (i_zn, u, 'Zink', 'supplement', 'capsule', 'mg', 25, 'Oral', 'complete', null, '#A3A3A3',
     '5 Tage nehmen, 2 Tage Pause.', null, 'mg', null, 0, 0, null, 28, null, null, timestamptz '2026-03-01 09:00:00+01', false, null),
  (i_ana, u, 'Anastrozol', 'medication', 'tablet', 'mg', 0.5, 'Oral', 'complete', null, '#DC2626',
     'Kurz gegen hohes Östradiol probiert, wieder abgesetzt.', null, 'mg', null, 0, 0, null, 28,
     '2c150884-aad1-4610-a7b5-e6969ba457d9', 'Oral', timestamptz '2025-11-30 20:00:00+01', true, timestamptz '2026-02-15 19:00:00+01');

  insert into public.stack_item_ingredients (stack_item_id, catalog_substance_id, amount_value, amount_unit, basis_value, basis_unit, position) values
  (i_testo, '3b9052e8-8265-4f5f-85dc-96f99bf78de6', 250, 'mg', 1, 'ml', 0),
  (i_tirz,  'a44c8232-7a95-43b3-ace8-c41bb56efbf9', 30, 'mg', 1, 'vial', 0),
  (i_bpc,   '29cb36ae-05de-4217-ae42-41e3ce625c81', 10, 'mg', 1, 'vial', 0),
  (i_d3,    '549e62b0-c804-451f-9edd-63e7b9305189', 4000, 'IU', 1, 'capsule', 0),
  (i_o3,    '9eec5426-771c-4330-98e7-dd7af322f6fb', 1000, 'mg', 1, 'capsule', 0),
  (i_crea,  '8a2d8c46-60f6-4569-bd04-11a7df34f6dc', 1, 'g', 1, 'g', 0),
  (i_zn,    'ffaab501-7f68-4329-9766-574d04dea13f', 25, 'mg', 1, 'capsule', 0),
  (i_ana,   '3ecfa828-13ab-4c80-bd2d-bed5a7ce9c78', 1, 'mg', 1, 'tablet', 0);
  insert into public.stack_item_ingredients (stack_item_id, catalog_substance_id, position) values
  (i_mg, '87e5ec17-230f-45d6-819a-5e92457b932f', 0);

  -- ── Bestand ────────────────────────────────────────────────────────────────
  insert into public.stack_item_inventory (user_id, stack_item_id, enabled, package_quantity, package_unit, remaining_quantity,
    batch_number, expires_at, opened_at, use_within_days, reconstitution_ml, batch_source) values
  (u, i_testo, true, 20, 'ml', 7.4, 'RX-24811', date '2027-06-30', date '2026-08-24', 28, null, 'Apotheke'),
  (u, i_tirz,  true, 2, 'vial', 1.6, 'TZ30-0926', date '2027-03-31', date '2026-09-05', 28, 3, null),
  (u, i_bpc,   true, 2, 'vial', 0.8, 'BPC10-0826', date '2027-08-31', date '2026-09-14', 28, 2, null),
  (u, i_d3,    true, 120, 'capsule', 23, null, date '2027-11-30', null, null, null, null),
  (u, i_o3,    true, 120, 'capsule', 46, null, date '2027-05-31', null, null, null, null),
  (u, i_crea,  true, 500, 'g', 215, null, date '2028-01-31', null, null, null, null),
  (u, i_zn,    true, 90, 'capsule', 31, null, date '2028-04-30', null, null, null, null);

  -- ── Zyklen und Planversionen ───────────────────────────────────────────────
  c_testo := pg_temp.mk_cycle(u, i_testo, 'TRT', 'Subkutan', 'mg', 60, 'Wochentage wählen', date '2025-10-13', null,
    array['Mo','Do'], null, null, null, 'morgens', '08:00');
  perform pg_temp.add_version(c_testo, date '2026-01-19', 'dose', 75);

  c_tirz1 := pg_temp.mk_cycle(u, i_tirz, 'Abnehmphase', 'Subkutan', 'mg', 2.5, 'Wochentage wählen', date '2025-10-18', date '2026-07-31',
    array['Sa'], null, null, null, 'abends', '20:00');
  perform pg_temp.add_version(c_tirz1, date '2025-11-15', 'titration', 5);
  perform pg_temp.add_version(c_tirz1, date '2026-01-10', 'titration', 7.5);
  perform pg_temp.add_version(c_tirz1, date '2026-05-02', 'dose', 5);
  c_tirz2 := pg_temp.mk_cycle(u, i_tirz, 'Erhaltung', 'Subkutan', 'mg', 2.5, 'Wochentage wählen', date '2026-09-05', null,
    array['Sa'], null, null, null, 'abends', '20:00');

  c_bpc1 := pg_temp.mk_cycle(u, i_bpc, 'Knie – Runde 1', 'Subkutan', 'mcg', 250, 'Täglich', date '2026-02-02', date '2026-03-29',
    null, null, null, null, 'morgens', '07:30');
  c_bpc2 := pg_temp.mk_cycle(u, i_bpc, 'Knie – Runde 2', 'Subkutan', 'mcg', 250, 'Täglich', date '2026-09-14', null,
    null, null, null, null, 'morgens', '07:30');

  c_d3 := pg_temp.mk_cycle(u, i_d3, 'Vitamin D', 'Oral', 'IU', 4000, 'Täglich', date '2025-10-13', null,
    null, null, null, null, 'morgens', '08:00');
  perform pg_temp.add_version(c_d3, date '2026-05-04', 'dose', 2000);
  perform pg_temp.add_version(c_d3, date '2026-10-05', 'dose', 4000);

  c_o3 := pg_temp.mk_cycle(u, i_o3, 'Omega-3', 'Oral', 'mg', 2000, 'Täglich', date '2025-10-13', null,
    null, null, null, null, 'abends', '20:00');

  c_crea := pg_temp.mk_cycle(u, i_crea, 'Kreatin', 'Oral', 'g', 5, 'Täglich', date '2026-01-05', null,
    null, null, null, null, 'morgens', '08:00');
  insert into public.cycle_pause_periods (user_id, cycle_id, paused_at, ends_at, created_at)
  values (u, c_crea, pg_temp.at_berlin(date '2026-08-03', '00:00'), pg_temp.at_berlin(date '2026-08-17', '00:00'), pg_temp.at_berlin(date '2026-08-02', '21:14'));

  c_mg := pg_temp.mk_cycle(u, i_mg, 'Magnesium abends', 'Oral', null, null, 'Täglich', date '2026-04-01', null,
    null, null, null, null, 'abends', '21:30');

  c_zn := pg_temp.mk_cycle(u, i_zn, 'Zink 5/2', 'Oral', 'mg', 25, 'Im Wechsel', date '2026-03-02', null,
    null, null, 5, 2, 'morgens', '08:00');

  c_ana := pg_temp.mk_cycle(u, i_ana, 'AI-Versuch', 'Oral', 'mg', 0.5, 'Alle X Tage', date '2025-12-01', date '2026-01-31',
    null, 3, null, null, 'abends', '20:00');

  -- ── Einnahmen ──────────────────────────────────────────────────────────────
  perform pg_temp.log_cycle(c_testo, 0.98, v_last);
  perform pg_temp.log_cycle(c_tirz1, 0.97, v_last);
  perform pg_temp.log_cycle(c_tirz2, 1.00, v_last);
  perform pg_temp.log_cycle(c_bpc1, 0.93, v_last);
  perform pg_temp.log_cycle(c_bpc2, 0.95, v_last);
  perform pg_temp.log_cycle(c_d3, 0.91, v_last);
  perform pg_temp.log_cycle(c_o3, 0.84, v_last);
  perform pg_temp.log_cycle(c_crea, 0.88, v_last);
  perform pg_temp.log_cycle(c_mg, 0.80, v_last);
  perform pg_temp.log_cycle(c_zn, 0.87, v_last);
  perform pg_temp.log_cycle(c_ana, 0.90, v_last);

  perform pg_temp.log_injections(c_testo, array['thigh_left', 'abdomen_low_right', 'thigh_right', 'abdomen_low_left']);
  perform pg_temp.log_injections(c_tirz1, array['abdomen_left', 'abdomen_right']);
  perform pg_temp.log_injections(c_tirz2, array['abdomen_left', 'abdomen_right']);
  perform pg_temp.log_injections(c_bpc1, array['abdomen_left', 'abdomen_right', 'abdomen_low_left', 'abdomen_low_right']);
  perform pg_temp.log_injections(c_bpc2, array['abdomen_left', 'abdomen_right', 'abdomen_low_left', 'abdomen_low_right']);

  -- ── Tagebuch und Gewicht ───────────────────────────────────────────────────
  for d in select generate_series(date '2025-10-13', v_last, interval '1 day')::date loop
    t := d - date '2025-10-18';
    -- Gewicht: Tirzepatid-Kurve, kleiner Rebound nach Ende, Erhaltung ab September
    w := case
      when t < 0 then 94.8
      when d <= date '2026-07-31' then 94.8 - 10.9 * (1 - exp(-t / 115.0))
      when d < date '2026-09-05' then 94.8 - 10.9 * (1 - exp(-286 / 115.0)) + 1.3 * least((d - date '2026-07-31') / 35.0, 1)
      else 94.8 - 10.9 * (1 - exp(-286 / 115.0)) + 1.3 - 0.6 * least((d - date '2026-09-05') / 37.0, 1) end;
    w := round(w + (pg_temp.rnd('w' || d) - 0.5) * 0.9 + case when extract(dow from d) = 1 then 0.3 else 0 end, 1);
    if pg_temp.rnd('wl' || d) < 0.72 then
      insert into public.weight_logs (user_id, logged_at, weight_kg, created_at, notes)
      values (u, d, w, pg_temp.at_berlin(d, '07:10', (pg_temp.rnd('wt' || d) * 40)::int),
        case when d = date '2026-01-03' then 'Nach den Feiertagen' when d = date '2026-07-30' then 'Zielgewicht fast erreicht' end);
    end if;

    continue when pg_temp.rnd('dl' || d) < 0.14;
    prog := least(greatest((d - date '2025-10-13') / 120.0, 0), 1);
    krank := d between date '2026-02-16' and date '2026-02-22';
    e  := round(5.0 + 2.3 * prog + (pg_temp.rnd('e' || d) - 0.5) * 2.4);
    s  := round(6.0 + 0.6 * prog + case when d >= date '2026-04-01' then 0.5 else 0 end + (pg_temp.rnd('s' || d) - 0.5) * 2.4);
    l  := round(4.0 + 3.2 * prog + (pg_temp.rnd('l' || d) - 0.5) * 2.6);
    wb := round(5.2 + 2.0 * prog + (pg_temp.rnd('b' || d) - 0.5) * 2.2
          - case when extract(dow from d) = 0 and d between date '2025-11-15' and date '2026-02-28' then 1.5 else 0 end);
    if krank then e := 2 + (pg_temp.rnd('k' || d) * 2)::int; wb := 3; l := 2; s := 5; end if;
    insert into public.daily_logs (user_id, log_date, energie, schlaf, libido, wohlbefinden, weight_kg, body_fat_pct, notes, created_at)
    values (u, d, greatest(1, least(10, e)), greatest(1, least(10, s)), greatest(1, least(10, l)), greatest(1, least(10, wb)),
      w, case when extract(dow from d) = 1 then round((24.6 - 6.4 * (1 - exp(-greatest(t, 0) / 140.0)) + (pg_temp.rnd('f' || d) - 0.5) * 0.6)::numeric, 1) end,
      case
        when krank and d = date '2026-02-16' then 'Grippe, Fieber 38,9. Training pausiert.'
        when d = date '2025-10-13' then 'Start TRT + Tracking.'
        when d = date '2025-11-16' then 'Seit der Erhöhung auf 5 mg Sonntag leicht übel.'
        when d = date '2025-12-24' then 'Weihnachten – trotzdem kaum Hunger.'
        when d = date '2026-02-02' then 'BPC-157 gestartet, Knie nach Laufen geschwollen.'
        when d = date '2026-03-20' then 'Knie fühlt sich deutlich stabiler an.'
        when d = date '2026-05-14' then 'Neuer PR Kreuzheben 180 kg.'
        when d = date '2026-08-05' then 'Urlaub Kroatien, Kreatin pausiert.'
        when d = date '2026-09-14' then 'Knie wieder gereizt nach Wanderung, zweite Runde BPC.'
        when pg_temp.rnd('n' || d) < 0.04 then (array['Gut geschlafen.', 'Stressiger Arbeitstag.', 'Training: Beine.', 'Wenig getrunken.', 'Spät gegessen.'])[1 + floor(pg_temp.rnd('nt' || d) * 5)::int]
      end,
      pg_temp.at_berlin(d, '21:45', (pg_temp.rnd('dt' || d) * 60)::int));
  end loop;
  update public.profiles set weight_kg = (select weight_kg from public.weight_logs where user_id = u order by logged_at desc limit 1) where id = u;

  -- ── Blutwerte (5 Befunde) ──────────────────────────────────────────────────
  for d, t in select * from (values (date '2025-10-06', 1), (date '2026-01-12', 2), (date '2026-04-13', 3), (date '2026-07-13', 4), (date '2026-10-05', 5)) x loop
    insert into public.bloodwork_reports (user_id, tested_at, lab_name, source, created_at)
    values (u, d, case when t = 1 then 'Hausarzt Dr. Beispiel' else 'Laborpraxis Mitte' end, 'manual', pg_temp.at_berlin(d + 3, '19:30'))
    returning id into rep;
    insert into public.bloodwork (user_id, tested_at, marker, value, unit, report_id, created_at)
    select u, d, m.marker, (m.v)[t], m.unit, rep, pg_temp.at_berlin(d + 3, '19:31')
    from (values
      ('Testosteron',            'ng/dL',  array[312, 684, 792, 815, 776]::numeric[]),
      ('Freies Testosteron',     'pg/mL',  array[58, 141, 166, 171, 158]::numeric[]),
      ('Östradiol',              'pg/mL',  array[22, 38, 44, 39, 41]::numeric[]),
      ('SHBG',                   'nmol/L', array[34, 26, 23, 22, 23]::numeric[]),
      ('LH',                     'mIU/mL', array[3.1, 0.3, 0.2, 0.2, 0.2]::numeric[]),
      ('FSH',                    'mIU/mL', array[4.2, 0.5, 0.3, 0.3, 0.4]::numeric[]),
      ('Hämoglobin',             'g/dL',   array[15.1, 16.2, 16.8, 17.3, 16.9]::numeric[]),
      ('Hämatokrit',             '%',      array[44.2, 47.1, 49.0, 50.8, 49.3]::numeric[]),
      ('Erythrozyten',           'Mio/µL', array[5.0, 5.3, 5.5, 5.7, 5.6]::numeric[]),
      ('Leukozyten',             '/nL',    array[6.8, 6.1, 5.9, 6.4, 6.2]::numeric[]),
      ('Thrombozyten',           '/nL',    array[245, 238, 251, 229, 240]::numeric[]),
      ('GOT (AST)',              'U/L',    array[34, 29, 31, 26, 27]::numeric[]),
      ('GPT (ALT)',              'U/L',    array[48, 36, 29, 25, 27]::numeric[]),
      ('Gamma-GT',               'U/L',    array[41, 33, 27, 24, 25]::numeric[]),
      ('Kreatinin',              'mg/dL',  array[1.04, 1.08, 1.19, 1.17, 1.15]::numeric[]),
      ('eGFR',                   'mL/min/1.73m²', array[93, 89, 80, 81, 83]::numeric[]),
      ('Cholesterin gesamt',     'mg/dL',  array[226, 214, 201, 193, 197]::numeric[]),
      ('LDL-Cholesterin',        'mg/dL',  array[148, 139, 129, 121, 124]::numeric[]),
      ('HDL-Cholesterin',        'mg/dL',  array[42, 39, 41, 44, 43]::numeric[]),
      ('Triglyceride',           'mg/dL',  array[187, 152, 118, 104, 109]::numeric[]),
      ('Glukose',                'mg/dL',  array[104, 95, 91, 88, 90]::numeric[]),
      ('HbA1c',                  '%',      array[5.9, 5.6, 5.4, 5.3, 5.3]::numeric[]),
      ('Insulin',                'µIU/mL', array[14.2, 9.1, 7.0, 6.3, 6.9]::numeric[]),
      ('TSH',                    'mIU/L',  array[2.1, 1.8, 2.3, 1.9, 2.0]::numeric[]),
      ('CRP',                    'mg/L',   array[3.4, 2.2, 1.3, 0.9, 1.1]::numeric[]),
      ('Vitamin D',              'ng/mL',  array[18, 41, 56, 63, 49]::numeric[]),
      ('Ferritin',               'ng/mL',  array[212, 151, 118, 96, 104]::numeric[]),
      ('Zink',                   'µg/dL',  array[72, 74, 86, 91, 89]::numeric[]),
      ('Magnesium',              'mg/dL',  array[1.9, 1.9, 2.0, 2.2, 2.1]::numeric[])
    ) as m(marker, unit, v)
    -- Erster Befund (Hausarzt) ohne Blutbild-Details und ohne Zink/Magnesium
    where not (t = 1 and m.marker in ('Erythrozyten', 'Leukozyten', 'Thrombozyten', 'Zink', 'Magnesium', 'Freies Testosteron'));
  end loop;
  update public.bloodwork set notes = 'Hämatokrit grenzwertig – Blutspende geplant' where user_id = u and marker = 'Hämatokrit' and tested_at = date '2026-07-13';

  -- ── Wirkungen / Nebenwirkungen ─────────────────────────────────────────────
  perform pg_temp.effect(u, i_testo, date '2025-11-03', 'effect', 'Mehr Energie am Nachmittag', 3, 'tag_1');
  perform pg_temp.effect(u, i_testo, date '2025-11-24', 'effect', 'Libido deutlich gesteigert', 4, 'woche_1');
  perform pg_temp.effect(u, i_testo, date '2025-11-27', 'side_effect', 'Wassereinlagerungen, Ringe drücken', 2, 'tage_2');
  perform pg_temp.effect(u, i_testo, date '2026-02-09', 'side_effect', 'Leichte Akne am Rücken', 2, 'woche_1', 'Nach Dosiserhöhung');
  perform pg_temp.effect(u, i_testo, date '2026-04-20', 'effect', 'Bessere Regeneration nach dem Training', 3, 'woche_1');
  perform pg_temp.effect(u, i_testo, date '2026-06-11', 'side_effect', 'Stelle am Oberschenkel leicht gerötet', 1, 'std_12');
  perform pg_temp.effect(u, i_tirz, date '2025-10-18', 'effect', 'Appetit deutlich reduziert', 4, 'tage_2');
  perform pg_temp.effect(u, i_tirz, date '2025-11-15', 'side_effect', 'Übelkeit', 3, 'std_8', 'Erste 5-mg-Dosis');
  perform pg_temp.effect(u, i_tirz, date '2025-11-22', 'side_effect', 'Übelkeit', 2, 'std_4');
  perform pg_temp.effect(u, i_tirz, date '2025-12-06', 'side_effect', 'Verstopfung', 2, 'tag_1');
  perform pg_temp.effect(u, i_tirz, date '2026-01-10', 'side_effect', 'Übelkeit und Aufstoßen', 3, 'std_12', 'Erste 7,5-mg-Dosis');
  perform pg_temp.effect(u, i_tirz, date '2026-01-17', 'side_effect', 'Müdigkeit am Tag nach der Spritze', 2, 'tag_1');
  perform pg_temp.effect(u, i_tirz, date '2026-02-28', 'effect', 'Kein Heißhunger mehr am Abend', 4, 'woche_1');
  perform pg_temp.effect(u, i_tirz, date '2026-05-02', 'effect', 'Appetit wieder etwas normaler', 2, 'woche_1', 'Nach Reduktion auf 5 mg');
  perform pg_temp.effect(u, i_tirz, date '2026-09-05', 'effect', 'Leicht weniger Hunger', 2, 'tage_2');
  perform pg_temp.effect(u, i_bpc, date '2026-02-03', 'side_effect', 'Rötung an der Einstichstelle', 1, 'min_30');
  perform pg_temp.effect(u, i_bpc, date '2026-02-16', 'effect', 'Knie beim Treppensteigen weniger schmerzhaft', 3, 'tag_1');
  perform pg_temp.effect(u, i_bpc, date '2026-03-09', 'effect', 'Wieder 5 km schmerzfrei gelaufen', 4, 'tag_1');
  perform pg_temp.effect(u, i_bpc, date '2026-09-28', 'effect', 'Schwellung im Knie zurückgegangen', 3, 'tage_2');
  perform pg_temp.effect(u, i_crea, date '2026-02-02', 'effect', 'Mehr Wiederholungen beim Bankdrücken', 3, 'woche_1');
  perform pg_temp.effect(u, i_crea, date '2026-01-12', 'side_effect', 'Leichtes Völlegefühl', 1, 'std_2');
  perform pg_temp.effect(u, i_ana, date '2025-12-13', 'side_effect', 'Gelenke trocken, Knacken in den Knien', 3, 'woche_1');
  perform pg_temp.effect(u, i_ana, date '2026-01-08', 'side_effect', 'Libido gesunken', 3, 'woche_1', 'Vermutlich E2 zu tief');
  perform pg_temp.effect(u, i_mg, date '2026-04-10', 'effect', 'Schneller eingeschlafen', 2, 'std_8');
  perform pg_temp.effect(u, i_d3, date '2026-01-15', 'effect', 'Weniger Wintermüdigkeit', 2, 'woche_1');

  -- ── Bewertungen (privat) ───────────────────────────────────────────────────
  insert into public.reviews (user_id, stack_item_id, cycle_id, rating, title, body, pros, cons, would_recommend, experience,
    wirkung, vertraeglichkeit, wieder_nehmen, is_public, created_at, updated_at) values
  (u, i_tirz, c_tirz1, 5, 'Hat mein Essverhalten komplett verändert',
     '11 kg in gut 9 Monaten. Die ersten Wochen nach jeder Erhöhung waren unangenehm, danach kaum Probleme.',
     'Kein Heißhunger, stetiger Gewichtsverlust, Blutzucker besser', 'Übelkeit nach Dosiserhöhung, Verstopfung',
     true, 'gut', 5, 3, 'ja', false, pg_temp.at_berlin(date '2026-08-02', '18:00'), pg_temp.at_berlin(date '2026-08-02', '18:00')),
  (u, i_bpc, c_bpc1, 4, 'Knie spürbar besser',
     'Nach etwa zwei Wochen weniger Schmerzen, nach acht Wochen wieder laufen. Schwer zu sagen, was Physio und was BPC war.',
     'Einfach zu dosieren, gut verträglich', 'Tägliche Spritze, Wirkung schwer abzugrenzen',
     true, 'gut', 4, 5, 'ja', false, pg_temp.at_berlin(date '2026-04-01', '20:00'), pg_temp.at_berlin(date '2026-04-01', '20:00')),
  (u, i_ana, c_ana, 2, 'Für mich nicht nötig',
     'Östradiol war nur leicht erhöht. Mit AI Gelenkprobleme und weniger Libido, ohne ging es mir besser.',
     null, 'Gelenkschmerzen, Libido runter', false, 'schlecht', 2, 2, 'nein', false,
     pg_temp.at_berlin(date '2026-02-15', '19:05'), pg_temp.at_berlin(date '2026-02-15', '19:05')),
  (u, i_crea, null, 4, 'Solide Basis',
     'Mehr Kraft und etwas mehr Volumen. Kreatinin im Blut leicht gestiegen, laut Ärztin normal bei Kreatin.',
     'Günstig, gut erforscht', 'Kreatinin-Wert verfälscht', true, 'gut', 4, 5, 'ja', false,
     pg_temp.at_berlin(date '2026-06-01', '21:00'), pg_temp.at_berlin(date '2026-06-01', '21:00'));

  raise notice 'Testaccount % angelegt (user_id %).', v_email, u;
end
$seed$;
