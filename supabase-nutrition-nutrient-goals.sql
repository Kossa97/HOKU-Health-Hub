-- Ernährung: eigene Ziele je Nährstoff (z. B. Vitamin D 50 µg statt Richtwert 20 µg).
--
-- nutrition_goals.nutrient_goals  JSON-Objekt {nährstoff: wert}; nur, was der Nutzer selbst
-- gesetzt hat. Fehlt ein Schlüssel, gilt der Richtwert (DGE) aus
-- src/features/ernaehrung/lib/nutrientTargets.ts. Rein additiv und idempotent.

alter table public.nutrition_goals add column if not exists nutrient_goals jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'nutrition_goals_nutrient_goals_object') then
    alter table public.nutrition_goals add constraint nutrition_goals_nutrient_goals_object
      check (jsonb_typeof(nutrient_goals) = 'object' and pg_column_size(nutrient_goals) <= 2048);
  end if;
end $$;
