-- Vorrat, Batch, Rekonstitutionsdaten für Peptide
alter table peptides
  add column if not exists vials_in_stock    numeric(8,2) default 0,
  add column if not exists vials_initial     numeric(8,2) default 0,
  add column if not exists reconstitution_date date,
  add column if not exists expiry_days       integer default 28,
  add column if not exists batch_number      text,
  add column if not exists batch_source      text,
  add column if not exists batch_file_url    text;

-- Einnahme-Bestätigung für Dosis-Protokolle
alter table dose_logs
  add column if not exists taken boolean default null;

-- Storage-Bucket für Batch-Dateien (PDF/Bilder) — privat; die App zeigt
-- die Dateien über signierte Links (src/lib/batchFiles.ts).
-- Stand wie in supabase-storage-batch-files.sql und
-- supabase-storage-batch-files-private.sql (dort für bestehende Projekte).
insert into storage.buckets (id, name, public)
values ('batch-files', 'batch-files', false)
on conflict do nothing;

-- Nur angemeldet, nur im eigenen Ordner (`<id>/…`; alte Fotos `progress/<id>/…`)
create policy "Batch upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'batch-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Batch read" on storage.objects
  for select to authenticated using (
    bucket_id = 'batch-files' and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or ((storage.foldername(name))[1] = 'progress' and (storage.foldername(name))[2] = (select auth.uid())::text)
    )
  );

create policy "Batch delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'batch-files' and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or ((storage.foldername(name))[1] = 'progress' and (storage.foldername(name))[2] = (select auth.uid())::text)
    )
  );
