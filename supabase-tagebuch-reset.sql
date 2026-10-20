-- Tagebuch v2: alte Tagebuch-Eintraege entfernen.
--
-- Laut Projektinhaber sind alle bisherigen Tagebuch-Eintraege simuliert; sie
-- werden nicht umgezogen, sondern geloescht und im neuen Format neu simuliert
-- (Zustimmung im Gespraech vom 2026-10-19, siehe memory/projects/tagebuch.md).
-- Stand der Zaehlung davor: 58 Zeilen bei 4 von 14 Konten.
--
-- Loescht ALLE Zeilen in `effects` (die Chips haengen per on delete cascade
-- daran). Nichts anderes wird angefasst. Ein zweiter Lauf findet nichts mehr.
-- Erst ausfuehren, wenn neue Testdaten im neuen Format bereitstehen.

-- Zaehlung davor
select (select count(*) from public.effects) as effects_vorher,
       (select count(*) from public.effect_symptoms) as chips_vorher;

begin;
delete from public.effects;
commit;

-- Zaehlung danach. Erwartet: 0 | 0
select (select count(*) from public.effects) as effects_nachher,
       (select count(*) from public.effect_symptoms) as chips_nachher;
