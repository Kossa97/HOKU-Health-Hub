-- ============================================================================
-- Demo-Konto: ein Jahr authentische Beispieldaten für alle Features
--
--   Login:    Benutzername  demo   (oder E-Mail test1@trackyourdose.test)
--             Passwort      demo123
--   Profil:   „Max“, männlich, *1991-03-14, 182 cm, Europe/Berlin, Pro bis 2099
--   Zeitraum: 2025-11-04 bis 2026-11-03. Heute (2026-11-04) bleibt offen,
--             damit man beim Vorzeigen selbst bestätigen und eintragen kann.
--
-- Die Geschichte dahinter (damit alles zusammenpasst):
--   TRT ab Tag 1, Tirzepatid zum Abnehmen (94,8 → ~84 kg, Titration 2,5 → 5 →
--   7,5 mg, Reduktion, Pause, Erhaltung), Knieprobleme beim Laufen → zwei
--   BPC-157-Runden, Grippe im März, Urlaub in Kroatien im August/September,
--   Ober-/Unterkörper-Split 4×/Woche plus Läufe am Samstag, Ernährung mit
--   ~2.000 kcal und viel Eiweiß, Apple-Health-Werte (Schritte, Ruhepuls,
--   Schlaf, Blutdruck), fünf Blutbilder, Körpermaße alle zwei Wochen.
--
-- Inhalt: Profil (alle Einwilligungen, Ziele, Maßstellen), 9 Substanzen mit
-- Zutaten und Bestand, 11 Zyklen mit Planversionen (Titration, Dosisänderung,
-- Pause, Wochentage, Alle-X-Tage, Im Wechsel, beendet/laufend, archiviert),
-- Einnahmen inkl. ausgelassener, Injektionsstellen (3D-Modell), Einnahme-
-- Bündel, Tagebuch v2 (Einträge mit Chips), Tageswerte, Gewicht, Blutbilder,
-- Bewertungen, Training (Plan, 4 Workouts, eigene Übung, Einstellungen,
-- Krafteinheiten mit Sätzen, Läufe/Spaziergänge/Wandern/Schwimmen aus
-- Apple Health), Ernährung (Ziele, eigene Lebensmittel mit Mikronährstoffen,
-- Mahlzeiten, Wasser, eigene Aktivitäten), Health-Tageswerte, Körpermaße.
--
-- Nicht enthalten: Fortschrittsfotos (bräuchten Dateien im Storage),
-- Hoku-Funde (rechnet der Server selbst aus den Daten), KI-Chatverlauf.
--
-- Werte sind erfunden, aber plausibel. Zufall ist md5-basiert und hängt nur
-- an Namen und Datum: jeder Lauf erzeugt dieselben Werte und dieselben Anzahlen.
--
-- Idempotent: Gibt es das Konto schon, werden NUR seine Zeilen in den
-- Feature-Tabellen gelöscht (delete … where user_id = <dieses Konto>) und neu
-- angelegt. Push-Abos, Geräte-Token, Fotos und Etiketten-Scans bleiben.
-- Schutz: bricht ab, wenn die E-Mail nicht auf @trackyourdose.test endet.
-- Muss als Eigentümer der Tabellen laufen (SQL-Editor / postgres), nicht als
-- authenticated — Zyklen und Planversionen sind für Clients gesperrt.
-- Vorgänger: supabase-seed-testaccount.sql (Branch claude/testaccount-seed).
-- ============================================================================

begin;

-- ── Hilfsfunktionen (nur für diese Sitzung) ─────────────────────────────────

create or replace function pg_temp.rnd(k text) returns numeric language sql immutable as $$
  select ('x' || lpad(substr(md5(k), 1, 12), 16, '0'))::bit(64)::bigint / 281474976710656.0
$$;

-- Lokale Berliner Uhrzeit -> Zeitpunkt
create or replace function pg_temp.at_berlin(d date, hhmm text, plus_min int default 0) returns timestamptz language sql immutable as $$
  select ((d + hhmm::time) + make_interval(mins => plus_min)) at time zone 'Europe/Berlin'
$$;

-- Gewichtskurve: Tirzepatid ab 2025-11-08, Ende 2026-08-22, kleiner Rebound, Erhaltung ab 2026-09-26
create or replace function pg_temp.kurve(d date) returns numeric language sql immutable as $$
  select case
    when d < date '2025-11-08' then 94.8
    when d <= date '2026-08-22' then 94.8 - 10.9 * (1 - exp(-(d - date '2025-11-08') / 115.0))
    when d < date '2026-09-26' then 94.8 - 10.9 * (1 - exp(-287 / 115.0)) + 1.3 * least((d - date '2026-08-22') / 35.0, 1)
    else 94.8 - 10.9 * (1 - exp(-287 / 115.0)) + 1.3 - 0.6 * least((d - date '2026-09-26') / 37.0, 1) end::numeric
$$;

-- Trainingsfortschritt 0 … ~0,9 über das Jahr
create or replace function pg_temp.prog(d date) returns numeric language sql immutable as $$
  select (1 - exp(-greatest(d - date '2025-11-10', 0) / 160.0))::numeric
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

-- Einnahmen eines Zyklus: jeder fällige Slot bekommt eine Zeile,
-- taken=true (mit realistischer Abweichung zur Planzeit) oder taken=false.
create or replace function pg_temp.log_cycle(p_cycle uuid, p_adherence float8, p_last date) returns int language plpgsql as $$
declare
  c public.cycles%rowtype; v public.cycle_plan_versions%rowtype; d date; due boolean; p float8;
  tage text[] := array['So','Mo','Di','Mi','Do','Fr','Sa']; n int := 0; tl text; nimmt boolean; planned timestamptz; k text;
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
    k := c.name || d::text;
    p := p_adherence - case when extract(dow from d) in (0, 6) then 0.05 else 0 end
         - case when d between date '2026-03-09' and date '2026-03-15' then 0.25 else 0 end;
    nimmt := pg_temp.rnd(k) < p;
    insert into public.dose_logs (user_id, stack_item_id, dose, unit, method, logged_at, created_at, taken, routine_slot_key, cycle_id, plan_version_id)
    values (c.user_id, c.stack_item_id,
      case when tl = 'intake_only' then null else v.dose end,
      case when tl = 'intake_only' then null else v.unit end,
      v.method,
      case when nimmt then pg_temp.at_berlin(d, c.intake_time_custom, floor(pg_temp.rnd('j' || k) * 55)::int - 15) else planned end,
      case when nimmt then pg_temp.at_berlin(d, c.intake_time_custom, floor(pg_temp.rnd('j' || k) * 55)::int - 14) else pg_temp.at_berlin(d + 1, '09:00') end,
      nimmt, c.id::text || '@' || to_char(d, 'YYYY-MM-DD') || 'T' || c.intake_time_custom, c.id, v.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Injektionsstellen für bestätigte Injektionen eines Zyklus, Stellen rotierend.
-- Punkte = INJECTION_SITE_PRESETS (src/lib/injectionSitePresets.ts) plus
-- höchstens ±2 cm Versatz, damit die Pins nicht aufeinander liegen.
create or replace function pg_temp.log_injections(p_cycle uuid, p_spots text[]) returns void language plpgsql as $$
declare r record; v_spot text; v_reg text; v_side text; pos jsonb; nor jsonb; i int := 0; jx float8; jy float8; k text;
begin
  for r in select dl.*, s.display_name, c.name as cname from public.dose_logs dl
           join public.stack_items s on s.id = dl.stack_item_id join public.cycles c on c.id = dl.cycle_id
           where dl.cycle_id = p_cycle and dl.taken order by dl.logged_at loop
    v_spot := p_spots[(i % array_length(p_spots, 1)) + 1]; i := i + 1;
    k := r.cname || r.logged_at::date::text;
    jx := (pg_temp.rnd('x' || k) - 0.5) * 0.04; jy := (pg_temp.rnd('y' || k) - 0.5) * 0.04;
    select x.reg, x.side, jsonb_build_object('x', round((x.px + jx)::numeric, 4), 'y', round((x.py + jy)::numeric, 4), 'z', x.pz),
           jsonb_build_object('x', x.nx, 'y', x.ny, 'z', x.nz)
      into v_reg, v_side, pos, nor
      from (values
        ('abdomen_left',  'abdomen', 'left',  -0.12,  0.68, 0.15575, -0.665,   0.11674,  0.73767),
        ('abdomen_right', 'abdomen', 'right',  0.12,  0.68, 0.15565,  0.67697, 0.08745,  0.7308),
        ('thigh_left',    'thigh',   'left',  -0.2,  -0.1,  0.11854,  0.04394, -0.21788, 0.97498),
        ('thigh_right',   'thigh',   'right',  0.2,  -0.1,  0.11911, -0.06653, -0.18824, 0.97987),
        ('glute_left',    'glute',   'left',  -0.17,  0.42, -0.20765, -0.39407, 0.36543, -0.84331),
        ('glute_right',   'glute',   'right',  0.17,  0.42, -0.20785,  0.35924, 0.38046, -0.85217)
      ) as x(spot, reg, side, px, py, pz, nx, ny, nz) where x.spot = v_spot;
    insert into public.injection_logs (user_id, dose_log_id, site, logged_at, created_at, stack_item_id, cycle_id, dose, unit, method,
      body_region, body_side, model_version, position, normal, substance_label)
    values (r.user_id, r.id, v_reg || '_' || v_side, r.logged_at, r.created_at, r.stack_item_id, r.cycle_id, r.dose, r.unit, r.method,
      v_reg, v_side, 'placeholder-v1', pos, nor, r.display_name);
  end loop;
end $$;

-- Tagebuch v2: ein Eintrag mit Chips. Chip = 'schluessel:stärke:minuten' (minuten leer = offen,
-- 'an' = hält an); eigener Chip mit '~Name:stärke:minuten:art'. Mit Substanz: an die erste
-- bestätigte Einnahme ab dem Tag gehängt, Zeitpunkt p_nach Stunden danach.
create or replace function pg_temp.eintrag(p_user uuid, p_item uuid, p_on date, p_hhmm text, p_titel text, p_chips text[],
  p_notes text default null, p_nach numeric default 3) returns void language plpgsql as $$
declare
  wirkungen text[] := array['more_energy','better_focus','clear_head','better_mood','less_stress','slept_better',
    'fell_asleep_faster','woke_up_rested','more_strength','more_endurance','faster_recovery','better_pump',
    'less_joint_pain','less_hunger','fewer_cravings','full_sooner','less_water_retention','better_skin',
    'faster_healing','higher_libido'];
  dl public.dose_logs%rowtype; v_at timestamptz; v_id uuid; ch text; teile text[]; i int := 0;
  arten text[] := '{}'; staerken int[] := '{}'; v_kind text; v_key text; v_label text;
begin
  if p_item is not null then
    select * into dl from public.dose_logs where stack_item_id = p_item and taken
      and logged_at >= pg_temp.at_berlin(p_on, '00:00') and logged_at < pg_temp.at_berlin(p_on + 4, '00:00')
      order by logged_at limit 1;
  end if;
  v_at := coalesce(dl.logged_at + make_interval(mins => (p_nach * 60)::int), pg_temp.at_berlin(p_on, p_hhmm));
  foreach ch in array p_chips loop
    teile := string_to_array(ch, ':');
    if left(teile[1], 1) = '~' then v_kind := teile[4]; else v_kind := case when teile[1] = any(wirkungen) then 'effect' else 'side_effect' end; end if;
    arten := arten || v_kind; staerken := staerken || teile[2]::int;
  end loop;
  insert into public.effects (user_id, description, type, severity, duration, occurred_at, created_at, stack_item_id, dose_log_id, notes, status, is_public)
  values (p_user, p_titel,
    case when 'effect' = all(arten) then 'effect' when 'side_effect' = all(arten) then 'side_effect' end,
    (select max(x) from unnest(staerken) x), null, v_at, v_at + interval '20 minutes', p_item, dl.id, p_notes, 'eingetreten', false)
  returning id into v_id;
  foreach ch in array p_chips loop
    i := i + 1; teile := string_to_array(ch, ':');
    v_key := case when left(teile[1], 1) = '~' then null else teile[1] end;
    v_label := case when left(teile[1], 1) = '~' then substr(teile[1], 2) end;
    insert into public.effect_symptoms (effect_id, user_id, kind, symptom_key, custom_label, severity, duration_minutes, ongoing, position, created_at)
    values (v_id, p_user, arten[i], v_key, v_label, teile[2]::int,
      case when teile[3] in ('', 'an') then null else teile[3]::int end, teile[3] = 'an', (i - 1)::smallint, v_at + interval '20 minutes');
  end loop;
end $$;

-- Sätze einer Übung. Spec (jsonb): t = w | bw | dur | reps, n Sätze, w Startgewicht,
-- g Zuwachs übers Jahr, lo/hi Wdh.-Bereich (bei dur Sekunden), st Schritt, warm Aufwärmsatz.
create or replace function pg_temp.saetze(p_key text, s jsonb, p_prog numeric, p_mod numeric) returns jsonb language plpgsql as $$
declare
  n int := (s->>'n')::int; t text := coalesce(s->>'t', 'w'); st numeric := coalesce((s->>'st')::numeric, 2.5);
  lo int := (s->>'lo')::int; hi int := (s->>'hi')::int; w numeric; r int; i int; out jsonb := '[]'; rpe numeric;
begin
  if t = 'w' then
    w := greatest(st, round((s->>'w')::numeric * (1 + coalesce((s->>'g')::numeric, 0) * p_prog) * p_mod / st) * st);
    if coalesce((s->>'warm')::boolean, false) then
      out := out || jsonb_build_array(jsonb_build_object('type', 'warmup', 'weightKg', greatest(st, round(w * 0.5 / st) * st), 'reps', 10, 'done', true));
    end if;
  end if;
  for i in 1..n loop
    rpe := case when i = n then 8.5 + round(pg_temp.rnd('rpe' || p_key || i) * 2) / 2 * 0.5 else 7.5 + round(pg_temp.rnd('rpe' || p_key || i)) * 0.5 end;
    if t = 'w' then
      r := greatest(lo, hi - floor(pg_temp.rnd(p_key || i) * (hi - lo + 1))::int - (i - 1) / 2);
      out := out || jsonb_build_array(jsonb_build_object('type', 'normal', 'weightKg', w, 'reps', r, 'rpe', rpe, 'done', true));
    elsif t = 'bw' then
      r := greatest(1, lo + round((hi - lo) * p_prog * p_mod)::int - (i - 1) / 2 - floor(pg_temp.rnd(p_key || i) * 2)::int);
      out := out || jsonb_build_array(jsonb_build_object('type', 'normal', 'weightKg', null, 'reps', r, 'rpe', rpe, 'done', true));
    elsif t = 'reps' then
      out := out || jsonb_build_array(jsonb_build_object('type', 'normal', 'reps', hi, 'done', true));
    else
      r := round((lo + (hi - lo) * p_prog) / 5)::int * 5;
      out := out || jsonb_build_array(jsonb_build_object('type', 'normal', 'durationS', r, 'done', true));
    end if;
  end loop;
  return out;
end $$;

-- Vorlage-Sätze eines Workouts: Startgewicht und Wdh.-Bereich der Doppelprogression
create or replace function pg_temp.vorlage(sp jsonb) returns jsonb language sql immutable as $$
  select jsonb_agg(case coalesce(sp->>'t', 'w')
    when 'w' then jsonb_build_object('type', 'normal', 'weightKg', (sp->>'w')::numeric, 'reps', (sp->>'hi')::int, 'repsMin', (sp->>'lo')::int, 'repsMax', (sp->>'hi')::int, 'rpe', 8)
    when 'bw' then jsonb_build_object('type', 'normal', 'weightKg', null, 'reps', (sp->>'lo')::int, 'repsMin', (sp->>'lo')::int, 'repsMax', (sp->>'hi')::int)
    else jsonb_build_object('type', 'normal', 'durationS', (sp->>'lo')::int) end order by g)
  from generate_series(1, (sp->>'n')::int) g
$$;

-- Mikronährstoffe auf die Menge umrechnen
create or replace function pg_temp.mikro(m jsonb, f numeric) returns jsonb language sql immutable as $$
  select case when m is null then null else (select jsonb_object_agg(key, round(value::numeric * f, 3)) from jsonb_each_text(m)) end
$$;

-- ── Daten ────────────────────────────────────────────────────────────────────

do $seed$
declare
  v_email    constant text := 'test1@trackyourdose.test';
  v_password constant text := 'demo123';
  v_username constant text := 'demo';
  v_last     constant date := date '2026-11-03';
  v_start    constant date := date '2025-11-04';
  u uuid;
  i_testo uuid := gen_random_uuid(); i_tirz uuid := gen_random_uuid(); i_bpc uuid := gen_random_uuid();
  i_d3 uuid := gen_random_uuid(); i_o3 uuid := gen_random_uuid(); i_crea uuid := gen_random_uuid();
  i_mg uuid := gen_random_uuid(); i_zn uuid := gen_random_uuid(); i_ana uuid := gen_random_uuid();
  c_testo uuid; c_tirz1 uuid; c_tirz2 uuid; c_bpc1 uuid; c_bpc2 uuid; c_d3 uuid; c_o3 uuid; c_crea uuid; c_mg uuid; c_zn uuid; c_ana uuid;
  rep uuid; d date; t int; w numeric; pr float8; krank boolean; urlaub boolean; knie boolean; laufpause boolean;
  e int; s int; l int; wb int;
  x_knie uuid := gen_random_uuid(); r record; v_mod numeric; v_ex jsonb; v_dauer int; v_km numeric; v_pace numeric;
  v_steps int; v_akcal int; v_lauf_kcal int; v_kraft boolean; f numeric; v_meal text; plan text[]; idx int; part text[];
  q numeric;
begin
  -- ── Konto ──────────────────────────────────────────────────────────────────
  select id into u from auth.users where email = v_email;
  if u is null then
    u := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, last_sign_in_at)
    values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')), timestamptz '2025-11-01 18:12:00+01',
      '', '', '', '', '', '', '', '',
      '{"provider":"email","providers":["email"]}', jsonb_build_object('username', v_username, 'email_verified', true),
      false, timestamptz '2025-11-01 18:11:00+01', now(), null);
    insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    values (u::text, u, jsonb_build_object('sub', u::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      'email', timestamptz '2025-11-01 18:11:00+01', now());
  else
    update auth.users set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('username', v_username),
      updated_at = now()
    where id = u;
  end if;
  if (select email from auth.users where id = u) not like '%@trackyourdose.test' then
    raise exception 'Schutz: % ist kein Testkonto', v_email;
  end if;
  if exists (select 1 from public.profiles where lower(username) = v_username and id <> u) then
    raise exception 'Benutzername % ist schon vergeben', v_username;
  end if;

  -- ── Alte Daten NUR dieses Kontos entfernen ────────────────────────────────
  delete from public.injection_logs where user_id = u;
  delete from public.effect_symptoms where user_id = u;
  delete from public.effects where user_id = u;
  delete from public.reviews where user_id = u;
  delete from public.stack_item_inventory_movements where user_id = u;
  delete from public.vial_stock_movements where user_id = u;
  delete from public.dose_logs where user_id = u;
  delete from public.cycle_pause_periods where user_id = u;
  delete from public.dose_escalations where user_id = u;
  delete from public.cycle_plan_versions where user_id = u;
  delete from public.cycle_migration_conflicts where user_id = u;
  delete from public.plan_mutation_receipts where user_id = u;
  delete from public.cycles where user_id = u;
  delete from public.stack_item_inventory where user_id = u;
  delete from public.vials where user_id = u;
  delete from public.stack_items where user_id = u;
  delete from public.inventory_items where user_id = u;
  delete from public.intake_bundles where user_id = u;
  delete from public.daily_logs where user_id = u;
  delete from public.weight_logs where user_id = u;
  delete from public.bloodwork where user_id = u;
  delete from public.bloodwork_reports where user_id = u;
  delete from public.food_logs where user_id = u;
  delete from public.food_items where user_id = u;
  delete from public.food_photo_scans where user_id = u;
  delete from public.water_logs where user_id = u;
  delete from public.nutrition_goals where user_id = u;
  delete from public.activity_logs where user_id = u;
  delete from public.health_daily where user_id = u;
  delete from public.body_measurements where user_id = u;
  delete from public.training_sessions where user_id = u;
  delete from public.training_routines where user_id = u;
  delete from public.training_plans where user_id = u;
  delete from public.training_custom_exercises where user_id = u;
  delete from public.training_settings where user_id = u;
  delete from public.coach_usage where user_id = u;
  delete from public.hoku_funde where user_id = u;
  delete from public.hoku_wochen where user_id = u;

  -- ── Profil ─────────────────────────────────────────────────────────────────
  insert into public.profiles (id, username, display_name, age, weight_kg, height_cm, gender, created_at, is_public,
    age_confirmed_at, terms_accepted_at, terms_version, bloodwork_units, birth_date, bio_sex, profile_gender, country,
    goals, measurement_sites, ai_import_consent_at, ai_food_consent_at, coach_consent_at, health_store_consent_at,
    erkenntnisse_consent_at, hoku_zeitzone, pro_until)
  values (u, v_username, 'Max', 35, 84.2, 182, 'männlich', timestamptz '2025-11-01 18:12:00+01', false,
    timestamptz '2025-11-01 18:12:00+01', timestamptz '2025-11-01 18:12:00+01', '2026-10', '{"system":"konventionell"}',
    date '1991-03-14', 'male', 'male', 'DE', array['fettabbau', 'muskelaufbau', 'blutwerte'],
    array['neck', 'chest', 'waist', 'belly', 'upper_arm', 'thigh'],
    timestamptz '2025-11-01 18:15:00+01', timestamptz '2025-11-04 07:40:00+01', timestamptz '2026-10-22 20:10:00+02',
    timestamptz '2025-11-01 18:16:00+01', timestamptz '2026-11-02 19:00:00+01', 'Europe/Berlin', timestamptz '2099-01-01 00:00:00+00')
  on conflict (id) do update set username = excluded.username, display_name = excluded.display_name, age = excluded.age,
    height_cm = excluded.height_cm, gender = excluded.gender, is_public = false, age_confirmed_at = excluded.age_confirmed_at,
    terms_accepted_at = excluded.terms_accepted_at, terms_version = excluded.terms_version, bloodwork_units = excluded.bloodwork_units,
    birth_date = excluded.birth_date, bio_sex = excluded.bio_sex, profile_gender = excluded.profile_gender, country = excluded.country,
    goals = excluded.goals, measurement_sites = excluded.measurement_sites, ai_import_consent_at = excluded.ai_import_consent_at,
    ai_food_consent_at = excluded.ai_food_consent_at, coach_consent_at = excluded.coach_consent_at,
    health_store_consent_at = excluded.health_store_consent_at, erkenntnisse_consent_at = excluded.erkenntnisse_consent_at,
    hoku_zeitzone = excluded.hoku_zeitzone, pro_until = excluded.pro_until;

  -- ── Substanzen ─────────────────────────────────────────────────────────────
  insert into public.stack_items (id, user_id, display_name, category, dosage_form, default_unit, default_dose, default_method,
    tracking_level, brand, color_hex, notes, vial_amount_mg, vial_amount_unit, reconstitution_ml, vials_in_stock, vials_initial,
    reconstitution_date, expiry_days, pk_profile_id, pk_profile_method, created_at, archived, archived_at) values
  (i_testo, u, 'Testosteron Enantat', 'hormone', 'vial', 'mg', 75, 'Subkutan', 'complete', 'Rotexmedica', '#2563EB',
     'TRT nach ärztlicher Rücksprache. Subkutan mit 27G-Insulinspritze.', null, 'mg', null, 0, 0, null, 28,
     '6cd2c08a-9c91-40dd-b180-f1092628ef6e', 'Subkutan', timestamptz '2025-11-01 18:20:00+01', false, null),
  (i_tirz, u, 'Tirzepatid', 'peptide', 'vial', 'mg', 2.5, 'Subkutan', 'complete', null, '#7C3AED',
     'Samstags abends spritzen, dann ist die Übelkeit über das Wochenende durch.', 30, 'mg', 3, 1.6, 2,
     date '2026-09-26', 28, 'f6fd8b77-a438-4da3-a68e-31d521d403c7', 'Subkutan', timestamptz '2025-11-01 18:25:00+01', false, null),
  (i_bpc, u, 'BPC-157', 'peptide', 'vial', 'mcg', 250, 'Subkutan', 'complete', null, '#059669',
     'Für das linke Knie (Patellasehne).', 10, 'mg', 2, 0.8, 2, date '2026-10-05', 28,
     '61cc2763-f4a5-41c0-9f79-54893eaf0700', 'Subkutan', timestamptz '2026-02-21 21:05:00+01', false, null),
  (i_d3, u, 'Vitamin D3', 'vitamin', 'capsule', 'IU', 4000, 'Oral', 'complete', 'Sunday Natural', '#F59E0B',
     'Zum Frühstück mit etwas Fett.', null, 'mg', null, 0, 0, null, 28, null, null, timestamptz '2025-11-01 18:30:00+01', false, null),
  (i_o3, u, 'Omega-3', 'supplement', 'capsule', 'mg', 2000, 'Oral', 'complete', 'Norsan', '#0EA5E9',
     null, null, 'mg', null, 0, 0, null, 28, null, null, timestamptz '2025-11-01 18:31:00+01', false, null),
  (i_crea, u, 'Creatin Monohydrat', 'supplement', 'powder', 'g', 5, 'Oral', 'complete', 'Creapure', '#64748B',
     'Morgens in den Shake.', null, 'mg', null, 0, 0, null, 28, null, null, timestamptz '2026-01-25 10:00:00+01', false, null),
  (i_mg, u, 'Magnesium', 'supplement', 'capsule', 'mg', null, 'Oral', 'intake_only', null, '#EC4899',
     'Nur abhaken, Menge egal.', null, 'mg', null, 0, 0, null, 28, null, null, timestamptz '2026-04-21 22:00:00+02', false, null),
  (i_zn, u, 'Zink', 'supplement', 'capsule', 'mg', 25, 'Oral', 'complete', null, '#A3A3A3',
     '5 Tage nehmen, 2 Tage Pause.', null, 'mg', null, 0, 0, null, 28, null, null, timestamptz '2026-03-22 09:00:00+01', false, null),
  (i_ana, u, 'Anastrozol', 'medication', 'tablet', 'mg', 0.5, 'Oral', 'complete', null, '#DC2626',
     'Kurz gegen hohes Östradiol probiert, wieder abgesetzt.', null, 'mg', null, 0, 0, null, 28,
     '2c150884-aad1-4610-a7b5-e6969ba457d9', 'Oral', timestamptz '2025-12-21 20:00:00+01', true, timestamptz '2026-03-08 19:00:00+01');

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
  (u, i_testo, true, 20, 'ml', 7.4, 'RX-24811', date '2027-06-30', date '2026-09-14', 28, null, 'Apotheke'),
  (u, i_tirz,  true, 2, 'vial', 1.6, 'TZ30-0926', date '2027-03-31', date '2026-09-26', 28, 3, null),
  (u, i_bpc,   true, 2, 'vial', 0.8, 'BPC10-1026', date '2027-08-31', date '2026-10-05', 28, 2, null),
  (u, i_d3,    true, 120, 'capsule', 23, null, date '2027-11-30', null, null, null, null),
  (u, i_o3,    true, 120, 'capsule', 46, null, date '2027-05-31', null, null, null, null),
  (u, i_crea,  true, 500, 'g', 215, null, date '2028-01-31', null, null, null, null),
  (u, i_zn,    true, 90, 'capsule', 31, null, date '2028-04-30', null, null, null, null);

  insert into public.intake_bundles (user_id, name, stack_item_ids, sort_order, created_at, updated_at) values
  (u, 'Morgens', array[i_d3, i_zn, i_crea], 0, timestamptz '2026-03-22 09:05:00+01', timestamptz '2026-03-22 09:05:00+01'),
  (u, 'Abends', array[i_o3, i_mg], 1, timestamptz '2026-04-21 22:05:00+02', timestamptz '2026-04-21 22:05:00+02');

  -- ── Zyklen und Planversionen ───────────────────────────────────────────────
  c_testo := pg_temp.mk_cycle(u, i_testo, 'TRT', 'Subkutan', 'mg', 60, 'Wochentage wählen', date '2025-11-04', null,
    array['Mo','Do'], null, null, null, 'morgens', '08:00');
  perform pg_temp.add_version(c_testo, date '2026-02-09', 'dose', 75);

  c_tirz1 := pg_temp.mk_cycle(u, i_tirz, 'Abnehmphase', 'Subkutan', 'mg', 2.5, 'Wochentage wählen', date '2025-11-08', date '2026-08-22',
    array['Sa'], null, null, null, 'abends', '20:00');
  perform pg_temp.add_version(c_tirz1, date '2025-12-06', 'titration', 5);
  perform pg_temp.add_version(c_tirz1, date '2026-01-31', 'titration', 7.5);
  perform pg_temp.add_version(c_tirz1, date '2026-05-23', 'dose', 5);
  c_tirz2 := pg_temp.mk_cycle(u, i_tirz, 'Erhaltung', 'Subkutan', 'mg', 2.5, 'Wochentage wählen', date '2026-09-26', null,
    array['Sa'], null, null, null, 'abends', '20:00');

  c_bpc1 := pg_temp.mk_cycle(u, i_bpc, 'Knie – Runde 1', 'Subkutan', 'mcg', 250, 'Täglich', date '2026-02-23', date '2026-04-19',
    null, null, null, null, 'morgens', '07:30');
  c_bpc2 := pg_temp.mk_cycle(u, i_bpc, 'Knie – Runde 2', 'Subkutan', 'mcg', 250, 'Täglich', date '2026-10-05', null,
    null, null, null, null, 'morgens', '07:30');

  c_d3 := pg_temp.mk_cycle(u, i_d3, 'Vitamin D', 'Oral', 'IU', 4000, 'Täglich', date '2025-11-04', null,
    null, null, null, null, 'morgens', '08:00');
  perform pg_temp.add_version(c_d3, date '2026-05-25', 'dose', 2000);
  perform pg_temp.add_version(c_d3, date '2026-10-26', 'dose', 4000);

  c_o3 := pg_temp.mk_cycle(u, i_o3, 'Omega-3', 'Oral', 'mg', 2000, 'Täglich', date '2025-11-04', null,
    null, null, null, null, 'abends', '20:00');

  c_crea := pg_temp.mk_cycle(u, i_crea, 'Kreatin', 'Oral', 'g', 5, 'Täglich', date '2026-01-26', null,
    null, null, null, null, 'morgens', '08:00');
  insert into public.cycle_pause_periods (user_id, cycle_id, paused_at, ends_at, created_at)
  values (u, c_crea, pg_temp.at_berlin(date '2026-08-24', '00:00'), pg_temp.at_berlin(date '2026-09-07', '00:00'), pg_temp.at_berlin(date '2026-08-23', '21:14'));

  c_mg := pg_temp.mk_cycle(u, i_mg, 'Magnesium abends', 'Oral', null, null, 'Täglich', date '2026-04-22', null,
    null, null, null, null, 'abends', '21:30');

  c_zn := pg_temp.mk_cycle(u, i_zn, 'Zink 5/2', 'Oral', 'mg', 25, 'Im Wechsel', date '2026-03-23', null,
    null, null, 5, 2, 'morgens', '08:00');

  c_ana := pg_temp.mk_cycle(u, i_ana, 'AI-Versuch', 'Oral', 'mg', 0.5, 'Alle X Tage', date '2025-12-22', date '2026-02-21',
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

  perform pg_temp.log_injections(c_testo, array['thigh_left', 'glute_right', 'thigh_right', 'glute_left']);
  perform pg_temp.log_injections(c_tirz1, array['abdomen_left', 'abdomen_right']);
  perform pg_temp.log_injections(c_tirz2, array['abdomen_left', 'abdomen_right']);
  perform pg_temp.log_injections(c_bpc1, array['abdomen_left', 'abdomen_right', 'thigh_left', 'abdomen_right']);
  perform pg_temp.log_injections(c_bpc2, array['abdomen_left', 'abdomen_right', 'thigh_left', 'abdomen_right']);

  -- ── Tageswerte (Fortschritt) und Gewicht ───────────────────────────────────
  for d in select generate_series(v_start, v_last, interval '1 day')::date loop
    w := round(pg_temp.kurve(d) + (pg_temp.rnd('w' || d) - 0.5) * 0.9 + case when extract(dow from d) = 1 then 0.3 else 0 end, 1);
    if pg_temp.rnd('wl' || d) < 0.72 or d >= v_last - 6 then
      insert into public.weight_logs (user_id, logged_at, weight_kg, created_at, notes)
      values (u, d, w, pg_temp.at_berlin(d, '07:10', (pg_temp.rnd('wt' || d) * 40)::int),
        case when d = date '2026-01-03' then 'Nach den Feiertagen' when d = date '2026-08-21' then 'Zielgewicht fast erreicht' end);
    end if;

    continue when pg_temp.rnd('dl' || d) < 0.14 and d < v_last - 6;
    pr := least(greatest((d - v_start) / 120.0, 0), 1);
    krank := d between date '2026-03-09' and date '2026-03-15';
    e  := round(5.0 + 2.3 * pr + (pg_temp.rnd('e' || d) - 0.5) * 2.4);
    s  := round(6.0 + 0.6 * pr + case when d >= date '2026-04-22' then 0.5 else 0 end + (pg_temp.rnd('s' || d) - 0.5) * 2.4);
    l  := round(4.0 + 3.2 * pr + (pg_temp.rnd('l' || d) - 0.5) * 2.6
          - case when d between date '2026-01-10' and date '2026-02-21' then 1.5 else 0 end);
    wb := round(5.2 + 2.0 * pr + (pg_temp.rnd('b' || d) - 0.5) * 2.2
          - case when extract(dow from d) = 0 and d between date '2025-12-07' and date '2026-03-21' then 1.5 else 0 end);
    if krank then e := 2 + (pg_temp.rnd('k' || d) * 2)::int; wb := 3; l := 2; s := 5; end if;
    insert into public.daily_logs (user_id, log_date, energie, schlaf, libido, wohlbefinden, weight_kg, body_fat_pct, notes, created_at)
    values (u, d, greatest(1, least(10, e)), greatest(1, least(10, s)), greatest(1, least(10, l)), greatest(1, least(10, wb)),
      w, case when extract(dow from d) = 1 then round((24.6 - 6.4 * (1 - exp(-greatest(d - date '2025-11-08', 0) / 140.0)) + (pg_temp.rnd('f' || d) - 0.5) * 0.6)::numeric, 1) end,
      case
        when d = date '2026-03-10' then 'Grippe, Fieber 38,9. Training pausiert.'
        when d = date '2025-11-04' then 'Start TRT + Tracking.'
        when d = date '2025-12-07' then 'Seit der Erhöhung auf 5 mg leicht übel.'
        when d = date '2025-12-24' then 'Weihnachten – trotzdem kaum Hunger.'
        when d = date '2026-02-23' then 'BPC-157 gestartet, Knie nach dem Laufen geschwollen.'
        when d = date '2026-04-10' then 'Knie fühlt sich deutlich stabiler an.'
        when d = date '2026-06-05' then 'Neuer Bestwert im Kreuzheben.'
        when d = date '2026-08-24' then 'Urlaub Kroatien, Kreatin pausiert.'
        when d = date '2026-10-04' then 'Knie nach der Wanderung wieder gereizt, ab morgen zweite Runde BPC.'
        when pg_temp.rnd('n' || d) < 0.04 then (array['Gut geschlafen.', 'Stressiger Arbeitstag.', 'Training war richtig gut.', 'Wenig getrunken.', 'Spät gegessen.'])[1 + floor(pg_temp.rnd('nt' || d) * 5)::int]
      end,
      pg_temp.at_berlin(d, '21:45', (pg_temp.rnd('dt' || d) * 60)::int));
  end loop;
  update public.profiles set weight_kg = (select weight_kg from public.weight_logs where user_id = u order by logged_at desc limit 1) where id = u;

  -- ── Körpermaße alle zwei Wochen ────────────────────────────────────────────
  for d in select generate_series(v_start, v_last, interval '14 days')::date loop
    w := 94.8 - pg_temp.kurve(d); q := pg_temp.prog(d);
    insert into public.body_measurements (user_id, measured_on, site, value_cm, created_at)
    select u, d, m.site, round((m.v + (pg_temp.rnd(m.site || d) - 0.5) * 0.6)::numeric, 1), pg_temp.at_berlin(d, '07:20')
    from (values
      ('waist',     104.0 - 0.95 * w),
      ('belly',     108.0 - 1.00 * w),
      ('chest',     112.0 - 0.35 * w + 1.5 * q),
      ('upper_arm',  38.0 - 0.08 * w + 1.4 * q),
      ('thigh',      62.0 - 0.25 * w + 0.8 * q),
      ('neck',       42.0 - 0.20 * w)
    ) as m(site, v);
  end loop;

  -- ── Blutwerte (5 Befunde) ──────────────────────────────────────────────────
  for d, t in select * from (values (date '2025-10-28', 1), (date '2026-01-26', 2), (date '2026-04-27', 3), (date '2026-07-27', 4), (date '2026-10-26', 5)) x loop
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
  update public.bloodwork set notes = 'Hämatokrit grenzwertig – Blutspende geplant' where user_id = u and marker = 'Hämatokrit' and tested_at = date '2026-07-27';

  -- ── Tagebuch (Einträge mit Chips) ──────────────────────────────────────────
  perform pg_temp.eintrag(u, i_testo, date '2025-11-24', '15:00', 'Mehr Energie am Nachmittag', array['more_energy:3:1440'], null, 6);
  perform pg_temp.eintrag(u, i_testo, date '2025-12-15', '21:00', 'Libido deutlich gesteigert', array['higher_libido:4:10080', 'better_mood:3:10080']);
  perform pg_temp.eintrag(u, i_testo, date '2025-12-18', '08:30', 'Ringe drücken', array['water_retention:2:2880']);
  perform pg_temp.eintrag(u, i_testo, date '2026-03-02', '19:00', 'Nach Dosiserhöhung', array['acne:2:10080', 'oily_skin:2:10080'], 'Rücken und Schultern.');
  perform pg_temp.eintrag(u, i_testo, date '2026-05-11', '20:00', 'Nach dem Training', array['faster_recovery:3:2880', 'more_strength:3:']);
  perform pg_temp.eintrag(u, i_testo, date '2026-07-02', '08:30', 'Nach der Injektion', array['redness:1:720'], 'Stelle am Gesäß leicht gerötet.', 1);
  perform pg_temp.eintrag(u, i_tirz, date '2025-11-08', '22:00', 'Erste Spritze', array['less_hunger:4:2880', 'full_sooner:3:2880'], null, 14);
  perform pg_temp.eintrag(u, i_tirz, date '2025-12-06', '22:00', 'Erste 5-mg-Dosis', array['nausea:3:480', 'burping:2:240'], null, 16);
  perform pg_temp.eintrag(u, i_tirz, date '2025-12-13', '22:00', 'Abends', array['nausea:2:240'], 'Schon besser als letzte Woche.', 18);
  perform pg_temp.eintrag(u, i_tirz, date '2025-12-27', '10:00', 'Nach dem Essen', array['constipation:2:1440', 'bloating:2:480'], null, 38);
  perform pg_temp.eintrag(u, i_tirz, date '2026-01-31', '22:00', 'Erste 7,5-mg-Dosis', array['nausea:3:720', 'heartburn:2:480'], null, 15);
  perform pg_temp.eintrag(u, i_tirz, date '2026-02-07', '10:00', 'Tag danach', array['fatigue:2:1440'], null, 20);
  perform pg_temp.eintrag(u, i_tirz, date '2026-03-21', '21:00', 'Abends', array['fewer_cravings:4:10080', 'less_hunger:3:'], 'Kein Heißhunger mehr am Abend.', 24);
  perform pg_temp.eintrag(u, i_tirz, date '2026-05-23', '12:00', 'Nach Reduktion auf 5 mg', array['less_hunger:2:10080'], 'Appetit wieder etwas normaler.', 40);
  perform pg_temp.eintrag(u, i_tirz, date '2026-09-26', '12:00', 'Erhaltung gestartet', array['less_hunger:2:2880'], null, 36);
  perform pg_temp.eintrag(u, i_tirz, date '2026-10-31', '12:00', 'Wochenende', array['less_hunger:2:2880', 'more_energy:3:'], null, 38);
  perform pg_temp.eintrag(u, i_bpc, date '2026-02-23', '08:00', 'Nach der Injektion', array['injection_sting:1:30', 'redness:1:30'], null, 0.2);
  perform pg_temp.eintrag(u, i_bpc, date '2026-03-08', '19:00', 'Treppensteigen', array['less_joint_pain:3:1440'], 'Knie beim Treppensteigen weniger schmerzhaft.', 11);
  perform pg_temp.eintrag(u, i_bpc, date '2026-03-30', '19:00', 'Wieder 5 km gelaufen', array['less_joint_pain:4:1440', 'more_endurance:3:1440'], null, 11);
  perform pg_temp.eintrag(u, i_bpc, date '2026-10-19', '19:00', 'Schwellung zurückgegangen', array['less_joint_pain:3:2880', 'faster_healing:3:'], null, 11);
  perform pg_temp.eintrag(u, i_bpc, date '2026-11-03', '19:00', 'Knie ruhig', array['less_joint_pain:3:an'], 'Morgen wieder lockerer Lauf geplant.', 11);
  perform pg_temp.eintrag(u, i_crea, date '2026-02-02', '10:00', 'Nach dem Shake', array['bloating:1:120'], null, 1);
  perform pg_temp.eintrag(u, i_crea, date '2026-02-26', '20:00', 'Nach dem Training', array['more_strength:3:10080', 'better_pump:2:120']);
  perform pg_temp.eintrag(u, i_ana, date '2026-01-03', '21:00', 'Gelenke', array['joint_pain:3:10080'], 'Knacken in den Knien.');
  perform pg_temp.eintrag(u, i_ana, date '2026-01-30', '21:00', 'Abends', array['lower_libido:3:10080', 'low_mood:2:4320'], 'Vermutlich E2 zu tief.');
  perform pg_temp.eintrag(u, i_mg, date '2026-05-01', '07:00', 'Gut geschlafen', array['fell_asleep_faster:2:480', 'slept_better:2:480'], null, 9);
  perform pg_temp.eintrag(u, i_d3, date '2026-02-06', '09:00', 'Morgens', array['better_mood:2:10080'], 'Weniger Wintermüdigkeit.');
  perform pg_temp.eintrag(u, null, date '2026-03-10', '09:00', 'Grippe', array['fatigue:5:7200', '~Fieber:4:2880:side_effect'], 'Training pausiert.');
  perform pg_temp.eintrag(u, null, date '2026-06-13', '13:30', 'Hitze beim Laufen', array['dizziness:2:30'], 'Zu wenig getrunken.');
  perform pg_temp.eintrag(u, null, date '2026-10-28', '09:00', 'Morgens', array['clear_head:3:480', 'better_focus:3:480']);
  perform pg_temp.eintrag(u, null, date '2026-11-02', '18:30', 'Nach dem Training', array['more_energy:3:240', 'better_mood:3:']);

  -- ── Bewertungen (privat) ───────────────────────────────────────────────────
  insert into public.reviews (user_id, stack_item_id, cycle_id, rating, title, body, pros, cons, would_recommend, experience,
    wirkung, vertraeglichkeit, wieder_nehmen, is_public, created_at, updated_at) values
  (u, i_tirz, c_tirz1, 5, 'Hat mein Essverhalten komplett verändert',
     '11 kg in gut 9 Monaten. Die ersten Wochen nach jeder Erhöhung waren unangenehm, danach kaum Probleme.',
     'Kein Heißhunger, stetiger Gewichtsverlust, Blutzucker besser', 'Übelkeit nach Dosiserhöhung, Verstopfung',
     true, 'gut', 5, 3, 'ja', false, pg_temp.at_berlin(date '2026-08-23', '18:00'), pg_temp.at_berlin(date '2026-08-23', '18:00')),
  (u, i_bpc, c_bpc1, 4, 'Knie spürbar besser',
     'Nach etwa zwei Wochen weniger Schmerzen, nach fünf Wochen wieder laufen. Schwer zu sagen, was Physio und was BPC war.',
     'Einfach zu dosieren, gut verträglich', 'Tägliche Spritze, Wirkung schwer abzugrenzen',
     true, 'gut', 4, 5, 'ja', false, pg_temp.at_berlin(date '2026-04-22', '20:00'), pg_temp.at_berlin(date '2026-04-22', '20:00')),
  (u, i_ana, c_ana, 2, 'Für mich nicht nötig',
     'Östradiol war nur leicht erhöht. Mit AI Gelenkprobleme und weniger Libido, ohne ging es mir besser.',
     null, 'Gelenkschmerzen, Libido runter', false, 'schlecht', 2, 2, 'nein', false,
     pg_temp.at_berlin(date '2026-03-08', '19:05'), pg_temp.at_berlin(date '2026-03-08', '19:05')),
  (u, i_crea, null, 4, 'Solide Basis',
     'Mehr Kraft und etwas mehr Volumen. Kreatinin im Blut leicht gestiegen, laut Ärztin normal bei Kreatin.',
     'Günstig, gut erforscht', 'Kreatinin-Wert verfälscht', true, 'gut', 4, 5, 'ja', false,
     pg_temp.at_berlin(date '2026-06-22', '21:00'), pg_temp.at_berlin(date '2026-06-22', '21:00'));

  -- ── Training: Einstellungen, Plan, Workouts ────────────────────────────────
  insert into public.training_settings (user_id, settings, updated_at) values (u, jsonb_build_object(
    'unit', 'kg', 'defaultRestS', 120, 'weeklyGoal', 4, 'barKg', 20, 'platesKg', jsonb_build_array(25, 20, 15, 10, 5, 2.5, 1.25),
    'healthImport', true, 'glp1Mode', null, 'dismissedExternalIds', '[]'::jsonb, 'restSound', true, 'restNotify', true,
    'favoriteExercises', jsonb_build_array('bench_press_barbell', 'squat_barbell', 'deadlift_barbell', 'pull_up')),
    timestamptz '2025-11-09 19:00:00+01');
  insert into public.training_custom_exercises (id, user_id, name, category, equipment, tracking, primary_muscles, secondary_muscles, created_at)
  values (x_knie, u, 'Terminal Knee Extension (Band)', 'mobility', 'band', 'reps', array['quads'], '{}', timestamptz '2026-02-24 18:00:00+01');
  insert into public.training_plans (user_id, name, schedule, sort_order, created_at, updated_at)
  values (u, 'Oberkörper / Unterkörper', '{"mode": "weekdays"}', 0, timestamptz '2025-11-09 19:00:00+01', timestamptz '2025-11-09 19:00:00+01');

  create temp table _workouts (name text, wtag int, specs jsonb, id uuid default gen_random_uuid(), sort int) on commit drop;
  insert into _workouts (name, wtag, sort, specs) values
  ('Oberkörper A', 1, 0, '[
    {"id":"bench_press_barbell","n":4,"w":70,"g":0.32,"lo":6,"hi":8,"warm":true,"rest":150},
    {"id":"bent_over_row_barbell","n":4,"w":60,"g":0.33,"lo":8,"hi":10,"rest":120},
    {"id":"overhead_press_dumbbell","n":3,"w":20,"g":0.4,"lo":8,"hi":10,"st":2,"rest":90},
    {"id":"lat_pulldown_cable","n":3,"w":55,"g":0.36,"lo":10,"hi":12,"rest":90},
    {"id":"lateral_raise_dumbbell","n":3,"w":8,"g":0.5,"lo":12,"hi":15,"st":1,"rest":60},
    {"id":"triceps_rope_pushdown","n":3,"w":20,"g":0.5,"lo":10,"hi":12,"rest":60}]'),
  ('Unterkörper A', 2, 1, '[
    {"id":"squat_barbell","n":4,"w":90,"g":0.36,"lo":5,"hi":6,"warm":true,"rest":180,"knie":0.6},
    {"id":"romanian_deadlift_barbell","n":3,"w":80,"g":0.4,"lo":8,"hi":10,"rest":120},
    {"id":"leg_press_machine","n":3,"w":140,"g":0.4,"lo":10,"hi":12,"st":5,"rest":120,"knie":0.8},
    {"id":"lying_leg_curl_machine","n":3,"w":35,"g":0.4,"lo":10,"hi":12,"rest":75},
    {"id":"standing_calf_raise_machine","n":4,"w":60,"g":0.4,"lo":12,"hi":15,"st":5,"rest":60},
    {"id":"plank","t":"dur","n":3,"lo":45,"hi":90,"rest":60}]'),
  ('Oberkörper B', 4, 2, '[
    {"id":"incline_bench_press_dumbbell","n":4,"w":26,"g":0.3,"lo":8,"hi":10,"st":2,"rest":120},
    {"id":"pull_up","t":"bw","n":4,"lo":5,"hi":10,"rest":120},
    {"id":"seated_cable_row","n":3,"w":60,"g":0.33,"lo":10,"hi":12,"rest":90},
    {"id":"arnold_press_dumbbell","n":3,"w":16,"g":0.37,"lo":8,"hi":10,"st":2,"rest":90},
    {"id":"face_pull","n":3,"w":20,"g":0.5,"lo":12,"hi":15,"rest":60},
    {"id":"bicep_curl_dumbbell","n":3,"w":12,"g":0.33,"lo":10,"hi":12,"st":2,"rest":60}]'),
  ('Unterkörper B', 5, 3, '[
    {"id":"deadlift_barbell","n":4,"w":120,"g":0.4,"lo":4,"hi":5,"warm":true,"rest":180},
    {"id":"bulgarian_split_squat","n":3,"w":14,"g":0.57,"lo":8,"hi":10,"st":2,"rest":90,"knie":0},
    {"id":"hip_thrust_barbell","n":3,"w":80,"g":0.5,"lo":8,"hi":10,"rest":90},
    {"id":"leg_extension_machine","n":3,"w":45,"g":0.4,"lo":12,"hi":15,"rest":60,"knie":0.6},
    {"id":"hanging_leg_raise","t":"bw","n":3,"lo":8,"hi":15,"rest":60}]');

  -- Vorlage: Sätze mit Wdh.-Bereich und Startgewicht
  insert into public.training_routines (id, user_id, name, kind, exercises, weekdays, sort_order, folder, created_at, updated_at)
  select wo.id, u, wo.name, 'strength',
    (select jsonb_agg(jsonb_build_object('exerciseId', sp->>'id', 'supersetGroup', null, 'restS', (sp->>'rest')::int, 'notes', null,
       'sets', pg_temp.vorlage(sp))
       order by o) from jsonb_array_elements(wo.specs) with ordinality as a(sp, o)),
    array[wo.wtag]::smallint[], wo.sort, 'Oberkörper / Unterkörper', timestamptz '2025-11-09 19:10:00+01', timestamptz '2026-02-24 18:05:00+01'
  from _workouts wo;

  -- ── Training: Einheiten, Health-Tageswerte, Aktivitäten ────────────────────
  for d in select generate_series(v_start, v_last, interval '1 day')::date loop
    q := pg_temp.prog(d);
    krank := d between date '2026-03-09' and date '2026-03-17';
    urlaub := d between date '2026-08-24' and date '2026-09-06';
    knie := d between date '2026-02-10' and date '2026-03-29' or d between date '2026-10-04' and date '2026-10-25';
    laufpause := d between date '2026-02-10' and date '2026-03-29' or d between date '2026-10-04' and date '2026-10-23';
    v_kraft := false; v_lauf_kcal := 0; v_km := 0;
    w := pg_temp.kurve(d);

    -- Kraft: Mo/Di/Do/Fr nach Plan
    select * into r from _workouts where wtag = extract(isodow from d)::int;
    if found and d >= date '2025-11-10' and not krank and not urlaub
       and d not in (date '2025-12-24', date '2025-12-25', date '2025-12-26', date '2025-12-31', date '2026-01-01')
       and pg_temp.rnd('kr' || d) < (case when extract(month from d) = 12 then 0.78 else 0.9 end) then
      v_mod := case when d between date '2026-03-18' and date '2026-03-31' then 0.9 else 1 end
             * case when ((d - date '2025-11-10') / 7) % 8 = 7 then 0.9 else 1 end;
      select jsonb_agg(jsonb_build_object('exerciseId', sp->>'id', 'supersetGroup', null, 'restS', (sp->>'rest')::int, 'notes', null,
               'sets', pg_temp.saetze(r.name || (sp->>'id') || d, sp, q,
                 v_mod * case when knie and sp ? 'knie' then (sp->>'knie')::numeric else 1 end)) order by o)
        into v_ex
        from jsonb_array_elements(r.specs) with ordinality as a(sp, o)
        where not (knie and coalesce(sp->>'knie', '') = '0');
      if knie and r.wtag in (2, 5) then
        v_ex := v_ex || jsonb_build_array(jsonb_build_object('exerciseId', 'custom:' || x_knie, 'supersetGroup', null, 'restS', 45,
          'notes', 'Reha nach Physio', 'sets', pg_temp.saetze('tke' || d, '{"t":"reps","n":3,"lo":15,"hi":15}', q, 1)));
      end if;
      v_dauer := 3300 + floor(pg_temp.rnd('kd' || d) * 1200)::int;
      insert into public.training_sessions (user_id, kind, title, started_at, ended_at, duration_s, kcal, avg_hr, rpe, notes,
        routine_id, exercises, source, created_at, updated_at)
      values (u, 'strength', r.name, pg_temp.at_berlin(d, '18:15', floor(pg_temp.rnd('ks' || d) * 40)::int),
        pg_temp.at_berlin(d, '18:15', floor(pg_temp.rnd('ks' || d) * 40)::int) + make_interval(secs => v_dauer), v_dauer,
        300 + floor(pg_temp.rnd('kk' || d) * 120)::int, 112 + floor(pg_temp.rnd('kh' || d) * 14)::int,
        7.5 + round(pg_temp.rnd('kp' || d) * 2) / 2,
        case when d = date '2026-06-05' then 'Neuer Bestwert im Kreuzheben!'
             when knie and r.wtag in (2, 5) then 'Knie geschont, leichter.'
             when ((d - date '2025-11-10') / 7) % 8 = 7 then 'Deload-Woche' end,
        r.id, v_ex, 'live',
        pg_temp.at_berlin(d, '19:40'), pg_temp.at_berlin(d, '19:40'));
      v_kraft := true;
    end if;

    -- Lauf am Samstag (ab Mai auch mittwochs locker), Apple Health
    if not krank and not urlaub and not laufpause and d >= date '2025-11-15' and (
         (extract(isodow from d) = 6 and pg_temp.rnd('lf' || d) < 0.8)
      or (extract(isodow from d) = 3 and d >= date '2026-05-01' and pg_temp.rnd('lf' || d) < 0.55)) then
      v_km := case when extract(isodow from d) = 3 then 5 + pg_temp.rnd('km' || d) * 2
                   when d between date '2026-03-30' and date '2026-04-20' or d between date '2026-10-24' and date '2026-11-03' then 4.5 + pg_temp.rnd('km' || d)
                   else 4 + 6 * q + (pg_temp.rnd('km' || d) - 0.5) * 2 end;
      v_km := round(v_km, 2);
      v_pace := 405 - 85 * q + pg_temp.rnd('pc' || d) * 15 + case when extract(isodow from d) = 3 then 20 else 0 end;
      v_dauer := round(v_km * v_pace)::int;
      v_lauf_kcal := round(v_km * w * 1.0)::int;
      insert into public.training_sessions (user_id, kind, title, started_at, ended_at, duration_s, distance_m, kcal, avg_hr, rpe,
        notes, exercises, source, external_id, created_at, updated_at)
      values (u, 'run', case when extract(isodow from d) = 3 then 'Lockerer Lauf' else 'Lauf' end,
        pg_temp.at_berlin(d, case when extract(isodow from d) = 3 then '07:00' else '09:30' end, floor(pg_temp.rnd('ls' || d) * 30)::int),
        pg_temp.at_berlin(d, case when extract(isodow from d) = 3 then '07:00' else '09:30' end, floor(pg_temp.rnd('ls' || d) * 30)::int) + make_interval(secs => v_dauer),
        v_dauer, round(v_km * 1000), v_lauf_kcal, round(156 - 10 * q + pg_temp.rnd('lh' || d) * 6)::int, null,
        case when d = date '2026-03-30' then 'Erster Lauf nach der Knie-Pause.' when d = date '2026-10-24' then 'Vorsichtig wieder angefangen.' end,
        '[]', 'healthkit', 'demo-hk-run-' || d, pg_temp.at_berlin(d, '12:00'), pg_temp.at_berlin(d, '12:00'));
    end if;

    -- Sonntags Spaziergang, im Urlaub Schwimmen/Wandern, eine lange Wanderung im Oktober
    if (extract(isodow from d) = 7 and not krank and not urlaub and pg_temp.rnd('sp' || d) < 0.4)
       or (urlaub and pg_temp.rnd('ur' || d) < 0.75) or d = date '2026-10-03' then
      insert into public.training_sessions (user_id, kind, title, started_at, ended_at, duration_s, distance_m, kcal, avg_hr,
        notes, exercises, source, external_id, created_at, updated_at)
      select u, x.kind, x.titel, pg_temp.at_berlin(d, x.uhr), pg_temp.at_berlin(d, x.uhr) + make_interval(secs => x.sek), x.sek, x.m,
        x.kcal, x.hr, x.notiz, '[]', 'healthkit', 'demo-hk-' || x.kind || '-' || d, pg_temp.at_berlin(d, '19:00'), pg_temp.at_berlin(d, '19:00')
      from (select
          case when d = date '2026-10-03' then 'hike' when urlaub and pg_temp.rnd('uk' || d) < 0.45 then 'swim' when urlaub then 'hike' else 'walk' end as kind,
          case when d = date '2026-10-03' then 'Wanderung Tegelberg' when urlaub and pg_temp.rnd('uk' || d) < 0.45 then 'Schwimmen im Meer'
               when urlaub then 'Wanderung Biokovo' else 'Spaziergang' end as titel,
          case when urlaub and pg_temp.rnd('uk' || d) < 0.45 then '17:00' else '10:30' end as uhr,
          case when d = date '2026-10-03' then 18900 when urlaub and pg_temp.rnd('uk' || d) < 0.45 then 1800 + floor(pg_temp.rnd('us' || d) * 900)::int
               when urlaub then 9000 + floor(pg_temp.rnd('us' || d) * 5400)::int else 2700 + floor(pg_temp.rnd('ss' || d) * 2100)::int end as sek,
          case when d = date '2026-10-03' then 16400 when urlaub and pg_temp.rnd('uk' || d) < 0.45 then 1100 + round(pg_temp.rnd('us' || d) * 500)
               when urlaub then 9000 + round(pg_temp.rnd('us' || d) * 5000) else 3500 + round(pg_temp.rnd('ss' || d) * 2500) end as m,
          case when d = date '2026-10-03' then 1450 when urlaub and pg_temp.rnd('uk' || d) < 0.45 then 380 when urlaub then 820 else 210 + floor(pg_temp.rnd('ss' || d) * 120)::int end as kcal,
          case when d = date '2026-10-03' then 128 when urlaub and pg_temp.rnd('uk' || d) < 0.45 then 132 when urlaub then 118 else 98 end as hr,
          case when d = date '2026-10-03' then 'Abstieg war hart fürs Knie.' end as notiz) x;
      v_km := v_km + case when d = date '2026-10-03' then 16.4 when urlaub then 8 else 4.5 end;
    end if;

    -- Health-Tageswerte (Apple Health)
    v_steps := 6500 + floor(pg_temp.rnd('st' || d) * 4000)::int + round(v_km * 1350)::int
               + case when extract(isodow from d) in (6, 7) then 1500 else 0 end
               - case when krank then 4500 else 0 end + case when urlaub then 4000 else 0 end;
    v_akcal := 380 + floor(pg_temp.rnd('ak' || d) * 220)::int + v_lauf_kcal + case when v_kraft then 330 else 0 end
               - case when krank then 250 else 0 end + case when urlaub then 350 else 0 end;
    insert into public.health_daily (user_id, day, steps, resting_hr, sleep_min, active_kcal, spo2_pct, resp_rate, bp_sys, bp_dia, source, updated_at)
    values (u, d, greatest(v_steps, 1200),
      round((67 - 9 * q + pg_temp.rnd('rh' || d) * 3 + case when krank then 7 else 0 end
             + case when extract(isodow from d) = 7 and d between date '2025-11-08' and date '2026-02-28' then 2 else 0 end)::numeric, 1),
      395 + floor(pg_temp.rnd('sl' || d) * 75)::int + case when d >= date '2026-04-22' then 15 else 0 end - case when krank then 40 else 0 end,
      greatest(v_akcal, 120),
      round((96 + pg_temp.rnd('o2' || d) * 3 - case when krank then 2 else 0 end)::numeric, 1),
      round((13.6 + pg_temp.rnd('rr' || d) * 1.8 + case when krank then 3 else 0 end)::numeric, 1),
      case when extract(isodow from d) = 1 then round(138 - 14 * q + pg_temp.rnd('bs' || d) * 6)::int end,
      case when extract(isodow from d) = 1 then round(88 - 9 * q + pg_temp.rnd('bd' || d) * 4)::int end,
      'healthkit', pg_temp.at_berlin(d + 1, '06:30'));

    -- Eigene Aktivitäten (Ernährung → Aktivität)
    if extract(isodow from d) = 3 and d >= date '2026-04-01' and not urlaub and not knie and pg_temp.rnd('fb' || d) < 0.45 then
      insert into public.activity_logs (user_id, log_date, label, minutes, kcal, created_at)
      values (u, d, 'Fußball mit Kollegen', 90, 640 + floor(pg_temp.rnd('fk' || d) * 120)::int, pg_temp.at_berlin(d, '21:30'));
    elsif extract(isodow from d) = 6 and extract(month from d) between 4 and 6 and pg_temp.rnd('ga' || d) < 0.35 then
      insert into public.activity_logs (user_id, log_date, label, minutes, kcal, created_at)
      values (u, d, 'Gartenarbeit', 120, 380, pg_temp.at_berlin(d, '17:00'));
    end if;
  end loop;
  insert into public.activity_logs (user_id, log_date, label, minutes, kcal, created_at)
  values (u, date '2026-01-17', 'Umzugshilfe', 300, 1100, pg_temp.at_berlin(date '2026-01-17', '20:00')),
         (u, date '2026-07-11', 'Radtour Ammersee', 180, 1350, pg_temp.at_berlin(date '2026-07-11', '19:30'));

  -- ── Ernährung: Ziele und eigene Lebensmittel ───────────────────────────────
  insert into public.nutrition_goals (user_id, kcal, protein_g, carbs_g, fat_g, water_ml, hide_kcal, activity_mode, activity_share, activity_sources, nutrient_goals, updated_at)
  values (u, 2200, 180, 200, 70, 3000, false, 'deficit', 'half', array['health', 'training', 'manual'], '{}', timestamptz '2025-11-04 07:35:00+01');

  create temp table _foods (k text primary key, id uuid default gen_random_uuid(), name text, brand text, unit text,
    n_kcal numeric, n_p numeric, n_c numeric, n_f numeric, n_fib numeric, n_sug numeric, n_salt numeric, n_sat numeric,
    n_serv numeric, n_label text, n_meal text, n_fav boolean, n_micros jsonb) on commit drop;
  insert into _foods (k, name, brand, unit, n_kcal, n_p, n_c, n_f, n_fib, n_sug, n_salt, n_sat, n_serv, n_label, n_meal, n_fav, n_micros) values
  ('hafer',     'Haferflocken kernig', 'Kölln', 'g', 372, 13.5, 58.7, 7.0, 10, 0.7, 0.02, 1.3, 60, null, 'breakfast', true, '{"mg":130,"fe":4.2,"zn":4.3,"b1":0.59,"p":430}'),
  ('skyr',      'Skyr natur', 'Arla', 'g', 63, 11, 4, 0.2, 0, 4, 0.1, 0.1, 150, null, 'breakfast', true, '{"ca":150,"b12":0.6}'),
  ('beeren',    'Heidelbeeren (TK)', null, 'g', 42, 0.6, 7.4, 0.6, 4.9, 7.4, 0, 0, 100, null, 'breakfast', false, '{"vitC":22,"vitK":19}'),
  ('whey',      'Whey Protein Vanille', 'ESN', 'g', 384, 76, 7, 6, 0, 5, 0.6, 3, 30, '1 Messlöffel', 'snack', true, '{"ca":450}'),
  ('eier',      'Eier (Größe M)', null, 'g', 137, 11.9, 1.5, 9.3, 0, 0.7, 0.35, 2.7, 60, '1 Ei', 'breakfast', false, '{"vitD":2.9,"b12":1.5,"chol":396,"se":23,"vitA":160}'),
  ('brot',      'Vollkornbrot', null, 'g', 216, 7, 38, 1.5, 8, 3, 1.1, 0.3, 50, '1 Scheibe', 'breakfast', false, '{"mg":60,"fe":2.0,"b1":0.2}'),
  ('tomate',    'Tomaten', null, 'g', 18, 1, 2.6, 0.2, 1.2, 2.6, 0.01, 0, 100, null, null, false, '{"vitC":19,"k":240}'),
  ('quark',     'Magerquark', null, 'g', 67, 12, 4, 0.3, 0, 4, 0.1, 0.1, 250, '1 Becher', 'breakfast', false, '{"ca":85}'),
  ('banane',    'Banane', null, 'g', 93, 1.2, 20, 0.2, 2, 17, 0, 0.1, 120, '1 Banane', 'snack', false, '{"k":367,"mg":30,"b6":0.36,"vitC":11}'),
  ('mandeln',   'Mandeln', null, 'g', 609, 24, 5.7, 53, 11, 4.4, 0, 4.3, 25, '1 Handvoll', 'snack', false, '{"vitE":25,"mg":270,"ca":250}'),
  ('haehnchen', 'Hähnchenbrustfilet', null, 'g', 105, 23.5, 0, 1.2, 0, 0, 0.15, 0.4, 150, null, 'lunch', true, '{"b3":10.5,"b6":0.5,"se":12}'),
  ('reis',      'Basmatireis (gekocht)', null, 'g', 130, 2.7, 28, 0.3, 0.4, 0, 0, 0.1, 200, null, 'lunch', false, null),
  ('brokkoli',  'Brokkoli', null, 'g', 34, 3.8, 2.7, 0.2, 3, 1.7, 0.02, 0, 200, null, 'lunch', false, '{"vitC":95,"vitK":155,"b9":111,"k":316}'),
  ('rind',      'Rinderhüftsteak', null, 'g', 112, 21, 0, 3, 0, 0, 0.15, 1.2, 180, null, 'lunch', false, '{"zn":4.4,"fe":2.3,"b12":2.0}'),
  ('kartoffel', 'Kartoffeln (gekocht)', null, 'g', 72, 2, 15, 0.1, 1.8, 0.8, 0, 0, 250, null, null, false, '{"k":410,"vitC":13,"b6":0.3}'),
  ('paprika',   'Paprika rot', null, 'g', 37, 1.3, 6.4, 0.5, 3.6, 6, 0, 0.1, 150, '1 Paprika', null, false, '{"vitC":140,"vitA":180}'),
  ('lachs',     'Lachsfilet', null, 'g', 202, 20, 0, 13.6, 0, 0, 0.1, 2.6, 125, '1 Filet', 'dinner', true, '{"omega3":2.5,"vitD":16,"b12":3.2,"se":30}'),
  ('spinat',    'Blattspinat (TK)', null, 'g', 20, 2.5, 0.6, 0.3, 2.6, 0.4, 0.15, 0, 150, null, 'dinner', false, '{"fe":3.0,"mg":60,"vitK":400,"b9":145,"vitA":470}'),
  ('nudeln',    'Vollkornnudeln (gekocht)', null, 'g', 150, 6, 27, 1.2, 4.5, 1, 0, 0.2, 250, null, 'dinner', false, '{"mg":45}'),
  ('tomsauce',  'Tomatensoße Basilikum', 'Barilla', 'g', 50, 1.5, 7.5, 1.3, 1.5, 6, 1.0, 0.2, 200, null, 'dinner', false, null),
  ('hack',      'Rinderhackfleisch 5 %', null, 'g', 125, 21, 0, 4.5, 0, 0, 0.15, 2, 150, null, 'dinner', false, '{"zn":5,"fe":2.5,"b12":2.5}'),
  ('wrap',      'Weizen-Wrap', 'Mission', 'g', 310, 8.5, 52, 7, 3, 3, 1.2, 3, 62, '1 Wrap', 'lunch', false, null),
  ('gouda',     'Gouda jung', null, 'g', 356, 24, 0, 28, 0, 0, 1.8, 18, 30, '1 Scheibe', null, false, '{"ca":700,"b12":1.5}'),
  ('apfel',     'Apfel', null, 'g', 54, 0.3, 11.4, 0.2, 2.4, 10.3, 0, 0, 180, '1 Apfel', 'snack', false, '{"vitC":12,"k":120}'),
  ('riegel',    'Proteinriegel Cookie Dough', 'ESN', 'g', 360, 33, 30, 12, 8, 2, 0.5, 6, 45, '1 Riegel', 'snack', true, null),
  ('cappu',     'Cappuccino mit Hafermilch', null, 'ml', 45, 1, 6, 1.5, 0.5, 3.5, 0.1, 0.2, 250, '1 Tasse', 'snack', true, '{"ca":30}'),
  ('colazero',  'Coca-Cola Zero', 'Coca-Cola', 'ml', 0.3, 0, 0, 0, 0, 0, 0.02, 0, 330, '1 Dose', 'snack', false, null),
  ('avocado',   'Avocado', null, 'g', 160, 2, 1.9, 14.7, 6.7, 0.7, 0, 2.1, 80, '½ Avocado', null, false, '{"k":485,"vitE":2.1,"b9":81}'),
  ('feta',      'Feta', null, 'g', 264, 17, 0.5, 21, 0, 0.5, 2.6, 14, 50, null, null, false, '{"ca":493}'),
  ('gurke',     'Salatgurke', null, 'g', 12, 0.6, 1.8, 0.2, 0.5, 1.7, 0, 0, 100, null, null, false, null),
  ('oel',       'Olivenöl', null, 'ml', 824, 0, 0, 91.6, 0, 0, 0, 13, 10, '1 EL', null, false, '{"vitE":13}'),
  ('erdnuss',   'Erdnussmus', null, 'g', 620, 26, 10, 50, 8, 5, 0, 9, 20, '1 EL', 'snack', false, '{"mg":170,"b3":13,"vitE":9}');
  insert into public.food_items (id, user_id, source, name, brand, unit, kcal_100, protein_100, carbs_100, fat_100, fiber_100, sugar_100,
    salt_100, sat_fat_100, serving_amount, serving_label, favorite, meal, micros, created_at, updated_at)
  select id, u, 'custom', name, brand, unit, n_kcal, n_p, n_c, n_f, n_fib, n_sug, n_salt, n_sat, n_serv, n_label, n_fav, n_meal, n_micros,
    timestamptz '2025-11-04 07:30:00+01' + make_interval(mins => row_number() over (order by k)::int),
    timestamptz '2025-11-04 07:30:00+01' + make_interval(mins => row_number() over (order by k)::int)
  from _foods;

  -- ── Ernährung: Mahlzeiten und Wasser ───────────────────────────────────────
  for d in select generate_series(v_start, v_last, interval '1 day')::date loop
    urlaub := d between date '2026-08-24' and date '2026-09-06';
    krank := d between date '2026-03-09' and date '2026-03-15';
    continue when pg_temp.rnd('fd' || d) < case when urlaub then 0.6 when krank then 0.7 else 0.12 end and d < v_last - 6;
    -- weniger Hunger in den Wochen nach jeder Erhöhung
    f := case when d between date '2025-12-06' and date '2025-12-27' or d between date '2026-01-31' and date '2026-02-21' then 0.85
              when d < date '2026-08-23' then 0.95 else 1.0 end;
    t := extract(isodow from d)::int;
    idx := 0;
    plan := array[
      -- Frühstück
      case floor(pg_temp.rnd('fr' || d) * 3)::int
        when 0 then 'breakfast|07:20|hafer=60;skyr=200;beeren=100;whey=30'
        when 1 then 'breakfast|07:40|eier=180;brot=100;tomate=120;gouda=30'
        else 'breakfast|07:20|quark=250;banane=120;mandeln=20;hafer=30' end,
      -- Mittag (unter der Woche manchmal Kantine)
      case when t <= 5 and pg_temp.rnd('ka' || d) < 0.25 then 'lunch|12:45|!Kantine: Hähnchen-Curry mit Reis=720/38/85/22'
        else case floor(pg_temp.rnd('mi' || d) * 3)::int
          when 0 then 'lunch|12:45|haehnchen=180;reis=220;brokkoli=200'
          when 1 then 'lunch|12:50|rind=160;kartoffel=300;paprika=150;oel=10'
          else 'lunch|13:00|wrap=124;haehnchen=150;paprika=80;gouda=30;gurke=60' end end,
      -- Abend (Freitag/Samstag manchmal auswärts)
      case when t in (5, 6) and pg_temp.rnd('aw' || d) < 0.35 then
          (array['dinner|19:30|!Pizza Margherita=870/34/108/30', 'dinner|20:00|!Döner Kebab=720/38/68/31', 'dinner|19:30|!Sushi (12 Stück)=560/24/88/12'])[1 + floor(pg_temp.rnd('ak' || d) * 3)::int]
        else case floor(pg_temp.rnd('ab' || d) * 4)::int
          when 0 then 'dinner|19:15|lachs=150;kartoffel=250;spinat=200'
          when 1 then 'dinner|19:20|nudeln=300;hack=150;tomsauce=150'
          when 2 then 'dinner|19:10|eier=120;spinat=100;feta=40;brot=50'
          else 'dinner|19:15|haehnchen=150;avocado=80;gurke=100;tomate=100;feta=40;oel=10' end end,
      -- Snacks
      case floor(pg_temp.rnd('sn' || d) * 4)::int
        when 0 then 'snack|10:30|cappu=250;apfel=180'
        when 1 then 'snack|15:30|riegel=45;cappu=250'
        when 2 then 'snack|16:00|banane=120;erdnuss=20'
        else 'snack|10:15|mandeln=25;colazero=330' end,
      case when t in (1, 2, 4, 5) and pg_temp.rnd('pw' || d) < 0.8 then 'snack|19:45|whey=30' end
    ];
    foreach v_meal in array plan loop
      continue when v_meal is null;
      part := string_to_array(v_meal, '|');
      if left(part[3], 1) = '!' then
        -- Schnelleintrag ohne Lebensmittel: Name=kcal/P/C/F
        idx := idx + 1;
        insert into public.food_logs (user_id, log_date, meal, source, name, unit, amount, kcal, protein_g, carbs_g, fat_g, created_at)
        values (u, d, part[1], 'quick', split_part(substr(part[3], 2), '=', 1), 'g', null,
          split_part(split_part(part[3], '=', 2), '/', 1)::numeric, split_part(split_part(part[3], '=', 2), '/', 2)::numeric,
          split_part(split_part(part[3], '=', 2), '/', 3)::numeric, split_part(split_part(part[3], '=', 2), '/', 4)::numeric,
          pg_temp.at_berlin(d, part[2], idx));
      else
        insert into public.food_logs (user_id, log_date, meal, food_item_id, source, name, brand, unit, amount, kcal, protein_g, carbs_g, fat_g,
          fiber_g, sugar_g, salt_g, sat_fat_g, micros, created_at)
        select u, d, part[1], fo.id, 'custom', fo.name, fo.brand, fo.unit, x.menge,
          round(fo.n_kcal * x.menge / 100, 1), round(fo.n_p * x.menge / 100, 1), round(fo.n_c * x.menge / 100, 1), round(fo.n_f * x.menge / 100, 1),
          round(fo.n_fib * x.menge / 100, 1), round(fo.n_sug * x.menge / 100, 1), round(fo.n_salt * x.menge / 100, 2), round(fo.n_sat * x.menge / 100, 1),
          pg_temp.mikro(fo.n_micros, x.menge / 100), pg_temp.at_berlin(d, part[2], idx + x.o::int)
        from (select split_part(it, '=', 1) as k,
                     -- Portionen: Getränke/Stückware fest, sonst mit Hunger-Faktor und kleiner Streuung
                     case when split_part(it, '=', 1) in ('cappu', 'colazero', 'whey', 'riegel', 'eier', 'oel', 'wrap') then split_part(it, '=', 2)::numeric
                          else round(split_part(it, '=', 2)::numeric * f * (0.9 + pg_temp.rnd(it || d) * 0.2) / 5) * 5 end as menge, o
              from unnest(string_to_array(part[3], ';')) with ordinality as z(it, o)) x
        join _foods fo on fo.k = x.k;
        idx := idx + 10;
      end if;
    end loop;
    insert into public.water_logs (user_id, log_date, ml, updated_at)
    values (u, d, (round((1900 + pg_temp.rnd('wa' || d) * 1300 + case when urlaub then 600 else 0 end) / 250) * 250)::int, pg_temp.at_berlin(d, '21:00'));
  end loop;

  raise notice 'Demo-Konto % (user_id %) befüllt.', v_username, u;
end
$seed$;

-- ── Nachzählen ───────────────────────────────────────────────────────────────
with u as (select id from auth.users where email = 'test1@trackyourdose.test')
select 'profil' as was, (select username from public.profiles where id in (select id from u)) as wert
union all select 'stack_items', count(*)::text from public.stack_items where user_id in (select id from u)
union all select 'cycles', count(*)::text from public.cycles where user_id in (select id from u)
union all select 'cycle_plan_versions', count(*)::text from public.cycle_plan_versions where user_id in (select id from u)
union all select 'dose_logs (davon genommen)', count(*) || ' (' || count(*) filter (where taken) || ')' from public.dose_logs where user_id in (select id from u)
union all select 'injection_logs', count(*)::text from public.injection_logs where user_id in (select id from u)
union all select 'effects / chips', (select count(*) from public.effects where user_id in (select id from u)) || ' / ' || (select count(*) from public.effect_symptoms where user_id in (select id from u))
union all select 'daily_logs', count(*)::text from public.daily_logs where user_id in (select id from u)
union all select 'weight_logs', count(*)::text from public.weight_logs where user_id in (select id from u)
union all select 'bloodwork (Befunde)', (select count(*) from public.bloodwork where user_id in (select id from u)) || ' (' || (select count(*) from public.bloodwork_reports where user_id in (select id from u)) || ')'
union all select 'reviews', count(*)::text from public.reviews where user_id in (select id from u)
union all select 'training_sessions', count(*)::text from public.training_sessions where user_id in (select id from u)
union all select 'training_routines', count(*)::text from public.training_routines where user_id in (select id from u)
union all select 'food_items', count(*)::text from public.food_items where user_id in (select id from u)
union all select 'food_logs', count(*)::text from public.food_logs where user_id in (select id from u)
union all select 'water_logs', count(*)::text from public.water_logs where user_id in (select id from u)
union all select 'activity_logs', count(*)::text from public.activity_logs where user_id in (select id from u)
union all select 'health_daily', count(*)::text from public.health_daily where user_id in (select id from u)
union all select 'body_measurements', count(*)::text from public.body_measurements where user_id in (select id from u)
union all select 'intake_bundles', count(*)::text from public.intake_bundles where user_id in (select id from u)
union all select 'stack_item_inventory', count(*)::text from public.stack_item_inventory where user_id in (select id from u);

commit;
