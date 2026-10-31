-- My Stack: gemerkte Etiketten je Nutzer, gemeinsam erst bei Übereinstimmung.
-- Rein additiv und idempotent. Kein drop, kein truncate.
-- Ablauf laut CLAUDE.md: Trockenlauf im Container (zweimal), dann gegen das Projekt.
--
-- Löst `scan_produkte` ab (erster Eintrag galt für alle, ohne Korrektur):
-- - Jeder merkt sich sein eigenes Etikett je Barcode; neu fotografieren
--   überschreibt es. Der eigene Eintrag geht immer vor.
-- - Fremde Einträge gibt es nur gebündelt: vorgeschlagen wird ein Etikett
--   erst, wenn mindestens zwei Nutzer dasselbe (Name und Wirkstoffe)
--   hinterlegt haben. Ein falscher Einzeleintrag erreicht so niemanden.
-- - Fremde Zeilen liest niemand direkt; nur `scan_produkt_laden` gibt das
--   Ergebnis heraus — ohne zu sagen, von wem.

-- Was „dasselbe Etikett" heißt: Name und Wirkstoffe ohne Groß/klein,
-- Leerraum und Reihenfolge; Mengen ohne nachgestellte Nullen.
create or replace function public.scan_etikett_fingerprint(e jsonb)
returns text
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select md5(
    lower(btrim(regexp_replace(coalesce(e ->> 'name', ''), '\s+', ' ', 'g'))) || '|' || coalesce((
      select string_agg(teil, ';' order by teil)
      from (
        select concat_ws(':',
          lower(btrim(regexp_replace(coalesce(i ->> 'name', ''), '\s+', ' ', 'g'))),
          trim_scale((i ->> 'amount')::numeric)::text,
          i ->> 'unit',
          coalesce(trim_scale((i ->> 'per_amount')::numeric)::text, ''),
          lower(btrim(coalesce(i ->> 'per_unit', '')))
        ) as teil
        from jsonb_array_elements(
          case when jsonb_typeof(e -> 'ingredients') = 'array' then e -> 'ingredients' else '[]'::jsonb end
        ) as i
      ) as teile
    ), '')
  )
$$;

create table if not exists public.scan_etiketten (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  ean text not null check (ean ~ '^[0-9]{8,14}$'),
  -- Das Etikett, wie `label-extract` es liefert (und die App es prüft).
  etikett jsonb not null check (
    jsonb_typeof(etikett) = 'object'
    and jsonb_typeof(etikett -> 'name') = 'string'
    and jsonb_typeof(etikett -> 'ingredients') = 'array'
    and pg_column_size(etikett) <= 8000
  ),
  fingerprint text generated always as (public.scan_etikett_fingerprint(etikett)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, ean)
);

create index if not exists scan_etiketten_ean_idx on public.scan_etiketten (ean, fingerprint);

alter table public.scan_etiketten enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'scan_etiketten' and policyname = 'scan_etiketten eigene lesen') then
    create policy "scan_etiketten eigene lesen" on public.scan_etiketten for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'scan_etiketten' and policyname = 'scan_etiketten eigene anlegen') then
    create policy "scan_etiketten eigene anlegen" on public.scan_etiketten for insert to authenticated with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'scan_etiketten' and policyname = 'scan_etiketten eigene ändern') then
    create policy "scan_etiketten eigene ändern" on public.scan_etiketten for update to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- Supabase vergibt neuen Tabellen alle Rechte; hier nur lesen, anlegen, ändern (je eigene Zeile).
revoke all on public.scan_etiketten from anon;
revoke delete, truncate, references, trigger on public.scan_etiketten from authenticated;
grant select, insert, update on public.scan_etiketten to authenticated;

-- Das Etikett zu einem Barcode: das eigene, sonst das, welches mindestens
-- zwei Nutzer gleich hinterlegt haben (bei Gleichstand das ältere).
create or replace function public.scan_produkt_laden(p_ean text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when auth.uid() is null then null else coalesce(
    (select etikett from public.scan_etiketten where user_id = auth.uid() and ean = p_ean),
    (select (array_agg(etikett order by created_at))[1]
       from public.scan_etiketten
       where ean = p_ean
       group by fingerprint
       having count(*) >= 2
       order by count(*) desc, min(created_at)
       limit 1)
  ) end
$$;

revoke all on function public.scan_produkt_laden(text) from public, anon;
grant execute on function public.scan_produkt_laden(text) to authenticated;

-- Die Vorgängertabelle nimmt nichts mehr an (sie war leer; löschen erst mit Zustimmung).
revoke insert on public.scan_produkte from authenticated;
