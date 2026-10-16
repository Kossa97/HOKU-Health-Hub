-- Eigene Einnahme-Bündel für den Kalender
--
-- Ein Bündel ist eine selbst zusammengestellte Gruppe von Substanzen
-- („Morgen-Stack", „Vor dem Training"), die im Kalender mit einem Tipp
-- gemeinsam bestätigt wird. Es speichert nur, WAS zusammengehört — keine
-- Einnahmen, keine Dosen. Bestätigt wird weiter über `confirm_intake_group`.
--
-- `stack_item_ids` ist bewusst ein Array statt einer Zwischentabelle: die
-- Reihenfolge gehört dem Nutzer, und eine gelöschte oder archivierte Substanz
-- fällt in der App einfach heraus. Fremde ids schaden nicht — die App
-- schneidet sie mit den eigenen `stack_items` und schreibt nur über die RPC.
--
-- Idempotent: zweimal ausführen ändert nichts.

create table if not exists public.intake_bundles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  stack_item_ids uuid[] not null default '{}'
    check (cardinality(stack_item_ids) <= 50),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intake_bundles_user_idx
  on public.intake_bundles (user_id, sort_order, created_at);

alter table public.intake_bundles enable row level security;

-- Ohne `drop policy`: eine Policy wird nur angelegt, wenn es sie noch nicht
-- gibt. Das macht die Datei wiederholbar, ohne etwas zu entfernen.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'intake_bundles' and policyname = 'own intake bundles select') then
    create policy "own intake bundles select" on public.intake_bundles
      for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'intake_bundles' and policyname = 'own intake bundles insert') then
    create policy "own intake bundles insert" on public.intake_bundles
      for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'intake_bundles' and policyname = 'own intake bundles update') then
    create policy "own intake bundles update" on public.intake_bundles
      for update to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'intake_bundles' and policyname = 'own intake bundles delete') then
    create policy "own intake bundles delete" on public.intake_bundles
      for delete to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$$;

grant select, insert, update, delete on public.intake_bundles to authenticated;
