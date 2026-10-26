-- Ernährung: Reihenfolge innerhalb einer Mahlzeit (Nachtrag 22.10.2026)
-- Rein additiv und idempotent: eine neue, leere Spalte; bestehende Zeilen bleiben,
-- wie sie sind. Kein drop, kein truncate, kein update.
-- Ablauf laut CLAUDE.md: Trockenlauf im Container (zweimal), dann gegen das Projekt.
--
-- Halten und Verschieben: Einträge lassen sich innerhalb einer Mahlzeit umsortieren
-- und in eine andere Mahlzeit oder auf einen anderen Tag ziehen. Die App sortiert nach
-- sort_key; leer = Zeitpunkt des Eintrags (created_at in Millisekunden), damit alte und
-- neue Einträge ohne Umrechnung zusammen sortieren. Beim Verschieben bekommt nur der
-- verschobene Eintrag einen Wert (Mitte zwischen seinen neuen Nachbarn).

alter table public.food_logs add column if not exists sort_key double precision;
