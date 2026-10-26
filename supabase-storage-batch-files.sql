-- Speicher `batch-files`: nur noch eigene Ordner (Store-Konformitaet, Datenschutz).
--
-- Vorher:
--   „Batch read"   jeder — auch nicht angemeldet — konnte alle Dateien auflisten
--   „Batch upload" jeder Angemeldete konnte in fremde Ordner hochladen
--   „Batch delete" nur `<id>/…` — die alten Fortschrittsfotos unter
--                  `progress/<id>/…` blieben beim Konto-Loeschen liegen
--
-- Nachher (nur angemeldet):
--   lesen, loeschen: `<eigene id>/…` und `progress/<eigene id>/…`
--   hochladen:       `<eigene id>/…` (neue Fotos liegen in `progress-photos`)
--
-- Oeffentliche Links (`/object/public/batch-files/…`) laufen nicht ueber diese
-- Regeln und funktionieren weiter. Den Bucket privat zu machen braucht
-- signierte Links in der App — eigener Schritt.
--
-- Nur `alter policy`, kein drop. Idempotent.
-- Ist-Zustand vorher (2026-10-06): 8 Dateien, alle im eigenen Ordner
-- (davon 1 unter progress/<id>), 0 ohne Besitzer.

alter policy "Batch read" on storage.objects
  to authenticated
  using (
    bucket_id = 'batch-files'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or ((storage.foldername(name))[1] = 'progress' and (storage.foldername(name))[2] = (select auth.uid())::text)
    )
  );

alter policy "Batch upload" on storage.objects
  to authenticated
  with check (
    bucket_id = 'batch-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

alter policy "Batch delete" on storage.objects
  to authenticated
  using (
    bucket_id = 'batch-files'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or ((storage.foldername(name))[1] = 'progress' and (storage.foldername(name))[2] = (select auth.uid())::text)
    )
  );
