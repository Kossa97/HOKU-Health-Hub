-- Biologisches Geschlecht aus der alten Angabe von /health übernehmen.
--
-- Wofür: /health, PDF und Blutwerte lesen seit dieser Änderung nur noch
-- `bio_sex` (mit Rückfall auf `gender`, solange `bio_sex` fehlt). Damit die
-- Blutwerte die Angabe auch nutzen, wird sie einmalig übernommen.
--
-- Nur Zeilen ohne `bio_sex` und mit eindeutiger alter Angabe ('männlich' /
-- 'weiblich'). „divers“ und alles andere bleibt leer. `age`, `gender` und
-- `birth_date` werden nicht angefasst (ein Alter ergibt kein Geburtsdatum).
--
-- Idempotent: ein zweiter Lauf findet keine passenden Zeilen mehr.

begin;

update public.profiles
set bio_sex = case lower(trim(gender))
                when 'männlich' then 'male'
                when 'weiblich' then 'female'
              end
where bio_sex is null
  and lower(trim(gender)) in ('männlich', 'weiblich');

commit;
