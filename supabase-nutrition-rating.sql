-- Ernährung: Nährwert-Punkte und Gerichte je Mahlzeit (Nachtrag 20.10.2026)
-- Rein additiv und idempotent: drei neue, leere Spalten; bestehende Zeilen bleiben,
-- wie sie sind. Kein drop, kein truncate, kein update.
-- Ablauf laut CLAUDE.md: Trockenlauf im Container (zweimal), dann gegen das Projekt.
--
-- Die Nährwert-Punkte (0–10, angelehnt an die öffentliche Nutri-Score-Rechnung)
-- brauchen neben Zucker, Salz und Ballaststoffen auch die gesättigten Fettsäuren.
-- Fehlt der Wert (alte Einträge, Quelle ohne Angabe), rechnet die App ohne ihn.

-- Gesättigte Fettsäuren je 100 g bzw. 100 ml.
alter table public.food_items add column if not exists sat_fat_100 numeric(5,1)
  check (sat_fat_100 is null or sat_fat_100 between 0 and 100);

-- Im Protokoll als Schnappschuss, wie die übrigen Nährwerte.
alter table public.food_logs add column if not exists sat_fat_g numeric(6,1)
  check (sat_fat_g is null or sat_fat_g between 0 and 5000);

-- Gerichte: zu welcher Mahlzeit sie passen („Passt zu“) — dort stehen sie beim
-- Hinzufügen oben. Leer = keine Zuordnung.
alter table public.food_items add column if not exists meal text
  check (meal is null or meal in ('breakfast', 'lunch', 'dinner', 'snack'));
