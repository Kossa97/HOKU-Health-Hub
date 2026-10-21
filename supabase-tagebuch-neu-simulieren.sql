-- Tagebuch v2: simulierte Eintraege im Chip-Format neu anlegen.
--
-- Laut Projektinhaber sind alle Tagebuch-Eintraege simuliert (Gespraech vom
-- 2026-10-19, Freigabe zum Loeschen und Neu-Simulieren; erneut 2026-10-21:
-- „Angehen“). Diese Datei ersetzt supabase-tagebuch-reset.sql und erledigt
-- alles in EINER Transaktion:
--
--   1. Zaehlung davor (Eintraege je Konto merken)
--   2. ALLE Zeilen in `effects` loeschen (Chips per on delete cascade)
--   3. je Konto genauso viele neue Eintraege anlegen, verteilt ueber die
--      letzten 12 Wochen, jeder mit 1–3 Chips aus dem Katalog
--      (src/lib/tagebuch/symptomCatalog.data.ts), Intensitaet und Dauer;
--      etwa 70 % mit Bezug zu einer bestaetigten eigenen Einnahme
--      (Substanz und Zeitpunkt passend), sonst eigene Substanz oder keine
--   4. Zaehlung danach
--
-- Faengt `effects` leer an, bleibt es leer (es gibt kein Konto mit Ziel).
-- Ein zweiter Lauf ersetzt die Testdaten durch neue mit denselben Anzahlen.
-- Fasst nur `effects` und `effect_symptoms` an. Ausfuehren im SQL-Editor
-- (Rolle postgres); die Pruef-Trigger fuer Eigentum laufen trotzdem mit.

begin;

-- 1. Ziel je Konto = bisherige Anzahl
create temp table _tagebuch_ziel on commit drop as
select user_id, count(*)::int as ziel from public.effects group by user_id;

select 'vorher' as stand,
       (select count(*) from public.effects) as eintraege,
       (select count(*) from public.effect_symptoms) as chips,
       (select count(*) from _tagebuch_ziel) as konten;

-- 2. alles Alte weg (simuliert, siehe oben)
delete from public.effects;

-- 3. neu simulieren
do $$
declare
  wirkungen text[] := array['more_energy','better_focus','clear_head','better_mood','less_stress','slept_better',
    'fell_asleep_faster','woke_up_rested','more_strength','more_endurance','faster_recovery','better_pump',
    'less_joint_pain','less_hunger','fewer_cravings','full_sooner','less_water_retention','better_skin',
    'faster_healing','higher_libido'];
  nebenwirkungen text[] := array['redness','swelling','itching','lump','bruise','injection_sting','nausea','vomiting',
    'heartburn','burping','bloating','constipation','diarrhea','loss_of_appetite','headache','dizziness','racing_heart',
    'high_blood_pressure','flushing','fatigue','brain_fog','slept_worse','trouble_falling_asleep','vivid_dreams',
    'night_sweats','water_retention','tingling_numbness','joint_pain','muscle_cramps','increased_hunger',
    'breast_tenderness','smaller_testicles','acne','oily_skin','hair_loss','rash','irritability','low_mood',
    'restlessness','lower_libido'];
  titel_wirkung text[] := array['Morgens','Gut geschlafen','Nach dem Training','Guter Tag','Abends','Mehr Energie heute'];
  titel_neben text[] := array['Nach der Injektion','Abends','Morgens','Unruhige Nacht','Nach dem Essen','Mittags'];
  titel_gemischt text[] := array['Nach dem Training','Gemischter Tag','Morgens','Nach der Injektion'];
  notizen text[] := array['Setzte nach etwa einer Stunde ein.','Leicht, ging schnell vorbei.','Beim Sport bemerkt.',
    'Hielt bis zum Abend an.','Ähnlich wie letzte Woche.'];
  dauern int[] := array[30, 60, 120, 180, 240, 480, 720, 1440, 2880, 10080];
  abstaende numeric[] := array[0.5, 1, 2, 3, 5, 8, 12, 20, 30];
  k record;
  v_einnahme_at timestamptz;
  i int;
  j int;
  thema text;
  pool text[];
  anzahl int;
  schluessel text[];
  arten text[];
  staerken int[];
  minuten int[];
  haelt_an boolean[];
  r numeric;
  v_item uuid;
  v_log uuid;
  v_at timestamptz;
  v_titel text;
  v_id uuid;
  v_key text;
begin
  perform setseed(0.4207);
  for k in select user_id, ziel from _tagebuch_ziel order by user_id loop
    for i in 1..k.ziel loop
      -- Zeitpunkt und Bezug: bevorzugt eine bestaetigte eigene Einnahme der letzten 12 Wochen
      v_item := null; v_log := null;
      v_at := now() - random() * interval '84 days';
      if random() < 0.7 then
        select d.id, d.stack_item_id, d.logged_at into v_log, v_item, v_einnahme_at
        from public.dose_logs d
        where d.user_id = k.user_id and d.taken and d.stack_item_id is not null
          and d.logged_at between now() - interval '84 days' and now() - interval '2 hours'
        order by random() limit 1;
      end if;
      if v_log is not null then
        v_at := least(now(), v_einnahme_at + abstaende[1 + floor(random() * array_length(abstaende, 1))::int] * interval '1 hour');
      elsif random() < 0.6 then
        select si.id into v_item from public.stack_items si where si.user_id = k.user_id order by random() limit 1;
      end if;

      -- Chips: Thema des Eintrags, dann 1–3 verschiedene Schluessel
      r := random();
      thema := case when r < 0.45 then 'effect' when r < 0.85 then 'side_effect' else 'gemischt' end;
      pool := case thema when 'effect' then wirkungen when 'side_effect' then nebenwirkungen
                         else wirkungen || nebenwirkungen end;
      anzahl := 1 + floor(random() * 3)::int;
      if thema = 'gemischt' then anzahl := greatest(anzahl, 2); end if;
      schluessel := '{}'; arten := '{}'; staerken := '{}'; minuten := '{}'; haelt_an := '{}';
      j := 0;
      while j < anzahl loop
        v_key := pool[1 + floor(random() * array_length(pool, 1))::int];
        continue when v_key = any(schluessel);
        -- gemischt: erster Chip Wirkung, zweiter Nebenwirkung, damit es wirklich gemischt ist
        if thema = 'gemischt' and j = 0 and not v_key = any(wirkungen) then continue; end if;
        if thema = 'gemischt' and j = 1 and not v_key = any(nebenwirkungen) then continue; end if;
        j := j + 1;
        schluessel := schluessel || v_key;
        arten := arten || case when v_key = any(wirkungen) then 'effect' else 'side_effect' end;
        staerken := staerken || (1 + floor(random() * 5)::int);
        r := random();
        haelt_an := haelt_an || (r >= 0.25 and r < 0.4);
        minuten := minuten || case when r < 0.4 then null else dauern[1 + floor(random() * array_length(dauern, 1))::int] end;
      end loop;

      v_titel := case thema
        when 'effect' then titel_wirkung[1 + floor(random() * array_length(titel_wirkung, 1))::int]
        when 'side_effect' then titel_neben[1 + floor(random() * array_length(titel_neben, 1))::int]
        else titel_gemischt[1 + floor(random() * array_length(titel_gemischt, 1))::int] end;

      insert into public.effects (user_id, description, type, severity, duration, occurred_at,
                                  stack_item_id, dose_log_id, notes, status)
      values (k.user_id, v_titel,
              case when thema = 'gemischt' then null else thema end,
              (select max(x) from unnest(staerken) x),
              null, v_at, v_item, v_log,
              case when random() < 0.25 then notizen[1 + floor(random() * array_length(notizen, 1))::int] end,
              'eingetreten')
      returning id into v_id;

      insert into public.effect_symptoms (effect_id, user_id, kind, symptom_key, custom_label, severity,
                                          duration_minutes, ongoing, position)
      select v_id, k.user_id, arten[n], schluessel[n], null, staerken[n], minuten[n], haelt_an[n], (n - 1)::smallint
      from generate_series(1, anzahl) as n;
    end loop;
  end loop;
end
$$;

-- 4. Zaehlung danach: je Konto dieselbe Anzahl wie vorher, jeder Eintrag mit Chips
select 'nachher' as stand,
       (select count(*) from public.effects) as eintraege,
       (select count(*) from public.effect_symptoms) as chips,
       (select count(distinct user_id) from public.effects) as konten,
       (select count(*) from public.effects e
         where not exists (select 1 from public.effect_symptoms s where s.effect_id = e.id)) as ohne_chips,
       (select count(*) from _tagebuch_ziel z
         where z.ziel <> (select count(*) from public.effects e where e.user_id = z.user_id)) as konten_mit_abweichung,
       (select count(*) from public.effects where dose_log_id is not null) as mit_einnahme;

commit;
