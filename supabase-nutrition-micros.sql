-- Ernährung: Vitamine, Mineralstoffe und Co. je Lebensmittel und Eintrag.
--
-- food_items.micros  je 100 g (eigene Lebensmittel, gemerkte BLS-/OFF-Produkte)
-- food_logs.micros   für die Menge des Eintrags (Schnappschuss wie die Makros)
--
-- JSON-Objekt mit nur bekannten Werten; Schlüssel und Einheiten in
-- src/features/ernaehrung/lib/micros.ts. Fehlt ein Schlüssel, ist der Wert unbekannt.
-- Rein additiv und idempotent; bestehende Zeilen bleiben unverändert (micros = null).

alter table public.food_items add column if not exists micros jsonb;
alter table public.food_logs add column if not exists micros jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'food_items_micros_object') then
    alter table public.food_items add constraint food_items_micros_object
      check (micros is null or (jsonb_typeof(micros) = 'object' and pg_column_size(micros) <= 4096));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'food_logs_micros_object') then
    alter table public.food_logs add constraint food_logs_micros_object
      check (micros is null or (jsonb_typeof(micros) = 'object' and pg_column_size(micros) <= 4096));
  end if;
end $$;
