-- My Stack: gemerkte Produkte für den Substanz-Scan.
-- Rein additiv und idempotent: legt eine Tabelle, ihre Policies und Rechte an,
-- ändert und löscht nichts Bestehendes. Kein drop, kein truncate.
-- Ablauf laut CLAUDE.md: Trockenlauf im Container (zweimal), dann gegen das Projekt.
--
-- Viele Nahrungsergänzungen kennt keine offene Datenbank. Wer einen solchen
-- Barcode scannt und danach das Etikett fotografiert, hinterlegt hier, was das
-- Etikett sagt (Name, Marke, Form, Wirkstoffe je Portion). Der nächste Scan
-- desselben Barcodes — von wem auch immer — ist dann sofort fertig.
--
-- Nur Produktdaten: keine Nutzer-Spalte, nichts darüber, wer was nimmt.
-- Der erste Eintrag bleibt (insert ... on conflict do nothing); ändern und
-- löschen kann ihn niemand über die App.
create table if not exists public.scan_produkte (
  ean text primary key check (ean ~ '^[0-9]{8,14}$'),
  -- Das Etikett, wie `label-extract` es liefert (und die App es prüft).
  etikett jsonb not null check (
    jsonb_typeof(etikett) = 'object'
    and jsonb_typeof(etikett -> 'name') = 'string'
    and jsonb_typeof(etikett -> 'ingredients') = 'array'
    and pg_column_size(etikett) <= 8000
  ),
  created_at timestamptz not null default now()
);

alter table public.scan_produkte enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'scan_produkte' and policyname = 'scan_produkte lesen') then
    create policy "scan_produkte lesen" on public.scan_produkte for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'scan_produkte' and policyname = 'scan_produkte anlegen') then
    create policy "scan_produkte anlegen" on public.scan_produkte for insert to authenticated with check (true);
  end if;
end $$;

-- Supabase vergibt neuen Tabellen alle Rechte; hier nur lesen und anlegen.
-- Gelesen werden nur EAN und Etikett: `created_at` verriete bei wenigen
-- Nutzern, wann jemand ein Produkt angelegt hat.
revoke all on public.scan_produkte from anon;
revoke select, update, delete, truncate, references, trigger on public.scan_produkte from authenticated;
grant select (ean, etikett) on public.scan_produkte to authenticated;
grant insert on public.scan_produkte to authenticated;
