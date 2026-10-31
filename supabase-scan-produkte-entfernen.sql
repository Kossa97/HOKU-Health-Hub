-- Die Vorgängertabelle des Scan-Katalogs entfernen (Zustimmung des Nutzers
-- im Gespräch vom 2026-10-31). Abgelöst durch `scan_etiketten`
-- (supabase-scan-etiketten.sql); sie war leer, nahm seitdem nichts mehr an,
-- und kein Code liest sie mehr. Nur ihre eigenen Prüfregeln hängen daran.
-- Idempotent: ein zweiter Lauf findet nichts mehr.
drop table if exists public.scan_produkte;
