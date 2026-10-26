-- Ernährung: Essen per Foto erfassen (KI-Schätzung über Anthropic)
--
-- Das Foto geht über die Edge Function `food-photo` an Anthropic (Claude) und
-- wird nirgends gespeichert. Dafür braucht es eine eigene, ausdrückliche
-- Einwilligung (Zweckbindung, Art. 9 DSGVO, Apple 5.1.2(i)) — die zum
-- Befund-Import (`ai_import_consent_at`) deckt Essensfotos nicht ab.
--
-- Rein additiv und idempotent: eine neue Spalte, ein Trigger, eine neue
-- Tabelle. Keine bestehende Zeile wird geändert, kein drop.

begin;

alter table public.profiles add column if not exists ai_food_consent_at timestamptz;

-- Wie bei `ai_import_consent_at`: den Zeitpunkt setzt der Server, nicht das
-- Gerät. Aus der App wird jede Einwilligung zu now(), eine bestehende bleibt
-- beim alten Datum, null (Widerruf) geht immer.
create or replace function public.stamp_ai_food_consent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.ai_food_consent_at is null then
      return new;
    end if;
    if tg_op = 'UPDATE' and old.ai_food_consent_at is not null then
      new.ai_food_consent_at := old.ai_food_consent_at;
    else
      new.ai_food_consent_at := now();
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger profiles_stamp_ai_food_consent
before insert or update of ai_food_consent_at on public.profiles
for each row execute function public.stamp_ai_food_consent();

-- Zähler für das Tageslimit. Schreibt nur die Edge Function (Service-Rolle);
-- der Nutzer darf seine Zeilen lesen, aber nicht anlegen oder löschen.
-- Kein Foto, kein Ergebnis — nur der Zeitpunkt.
create table if not exists public.food_photo_scans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamptz not null default now()
);
create index if not exists food_photo_scans_user_created_idx on public.food_photo_scans (user_id, created_at desc);

alter table public.food_photo_scans enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'food_photo_scans' and policyname = 'Read own food photo scans') then
    create policy "Read own food photo scans" on public.food_photo_scans
      for select using (auth.uid() = user_id);
  end if;
end $$;

commit;
