-- Speicher `batch-files` privat (Analyse-Dokumente, alte Fortschrittsfotos).
--
-- Voraussetzung: die App zeigt diese Dateien ueber signierte Links
-- (`src/lib/batchFiles.ts`, `BatchDateiLink`, `useFortschrittData`) und diese
-- Version ist ausgeliefert. Erst dann ausfuehren — sonst zeigen alte
-- App-Versionen keine Dokumente mehr.
--
-- Danach liefert `/object/public/batch-files/…` nichts mehr; gespeicherte alte
-- URLs bleiben in der Datenbank und werden in der App zu signierten Links.
-- Lesen nur noch ueber die Regel „Batch read" (eigener Ordner).
--
-- Ist-Zustand vorher (2026-10-06): public = true, 8 Dateien.
-- Idempotent; zuruecknehmen: dasselbe mit `public = true`.

update storage.buckets set public = false where id = 'batch-files';
