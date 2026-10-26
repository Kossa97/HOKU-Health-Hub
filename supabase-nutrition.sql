-- Ernährung / Kalorientracker (Etappe 1, Nachtrag Gerichte)
-- Rein additiv und idempotent: legt nur neue Tabellen, Spalten, Indizes und Policies an,
-- ändert und löscht nichts Bestehendes. Kein drop, kein truncate.
-- Ablauf laut CLAUDE.md: Trockenlauf im Container (zweimal), dann gegen das Projekt.
--
-- Grundsatz: Nährwerte stehen in jedem Protokolleintrag als Schnappschuss.
-- Ändert oder löscht jemand später ein Lebensmittel, bleibt die Historie wahr.

-- ─── Meine Lebensmittel ───────────────────────────────────────────────────
-- Selbst angelegte Lebensmittel UND gemerkte/korrigierte fremde Einträge
-- (Open Food Facts, BLS). Werte je 100 g bzw. 100 ml.
create table if not exists public.food_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  source text not null default 'custom' check (source in ('custom', 'off', 'bls')),
  source_ref text check (source_ref is null or char_length(source_ref) <= 40),
  barcode text check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  brand text check (brand is null or char_length(brand) <= 120),
  unit text not null default 'g' check (unit in ('g', 'ml')),
  kcal_100 numeric(6,1) not null check (kcal_100 between 0 and 900),
  protein_100 numeric(5,1) not null default 0 check (protein_100 between 0 and 100),
  carbs_100 numeric(5,1) not null default 0 check (carbs_100 between 0 and 100),
  fat_100 numeric(5,1) not null default 0 check (fat_100 between 0 and 100),
  fiber_100 numeric(5,1) check (fiber_100 is null or fiber_100 between 0 and 100),
  sugar_100 numeric(5,1) check (sugar_100 is null or sugar_100 between 0 and 100),
  salt_100 numeric(6,2) check (salt_100 is null or salt_100 between 0 and 100),
  serving_amount numeric(6,1) check (serving_amount is null or (serving_amount > 0 and serving_amount <= 5000)),
  serving_label text check (serving_label is null or char_length(serving_label) <= 40),
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ein Barcode zeigt je Nutzer auf genau ein eigenes Lebensmittel: Wer ein
-- Produkt korrigiert, bekommt beim nächsten Scan seine Fassung.
create unique index if not exists food_items_user_barcode_uidx
  on public.food_items (user_id, barcode) where barcode is not null;
create unique index if not exists food_items_user_source_uidx
  on public.food_items (user_id, source, source_ref) where source_ref is not null;
create index if not exists food_items_user_name_idx on public.food_items (user_id, name);

-- ─── Protokoll ────────────────────────────────────────────────────────────
create table if not exists public.food_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  -- Lokales Kalenderdatum des Nutzers (wie daily_logs.log_date).
  log_date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_item_id uuid references public.food_items on delete set null,
  source text not null check (source in ('custom', 'off', 'bls', 'quick')),
  source_ref text check (source_ref is null or char_length(source_ref) <= 40),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  brand text check (brand is null or char_length(brand) <= 120),
  unit text not null default 'g' check (unit in ('g', 'ml')),
  -- Schnelleintrag (source = 'quick') hat keine Menge.
  amount numeric(6,1) check (amount is null or (amount > 0 and amount <= 5000)),
  -- Grenzen passend zur App: bis 5000 g/ml × höchstens 900 kcal bzw. 100 g je 100 g.
  kcal numeric(7,1) not null check (kcal between 0 and 50000),
  protein_g numeric(6,1) not null default 0 check (protein_g between 0 and 5000),
  carbs_g numeric(6,1) not null default 0 check (carbs_g between 0 and 5000),
  fat_g numeric(6,1) not null default 0 check (fat_g between 0 and 5000),
  fiber_g numeric(6,1) check (fiber_g is null or fiber_g between 0 and 5000),
  sugar_g numeric(6,1) check (sugar_g is null or sugar_g between 0 and 5000),
  salt_g numeric(7,2) check (salt_g is null or salt_g between 0 and 5000),
  created_at timestamptz not null default now(),
  constraint food_logs_amount_required check (source = 'quick' or amount is not null)
);
create index if not exists food_logs_user_date_idx on public.food_logs (user_id, log_date);
create index if not exists food_logs_user_created_idx on public.food_logs (user_id, created_at desc);

-- ─── Ziele und Einstellungen (eine Zeile je Nutzer) ───────────────────────
create table if not exists public.nutrition_goals (
  user_id uuid references auth.users on delete cascade primary key,
  kcal integer not null check (kcal between 1000 and 6000),
  protein_g integer not null check (protein_g between 0 and 500),
  carbs_g integer not null check (carbs_g between 0 and 1000),
  fat_g integer not null check (fat_g between 0 and 400),
  water_ml integer not null default 2000 check (water_ml between 0 and 8000),
  -- Kalorienzahlen ausblenden: nur Makros und Mahlzeiten zeigen.
  hide_kcal boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ─── Wasser je Tag ────────────────────────────────────────────────────────
create table if not exists public.water_logs (
  user_id uuid references auth.users on delete cascade not null,
  log_date date not null,
  ml integer not null default 0 check (ml between 0 and 15000),
  updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

-- ─── Zugriff: nur eigene Zeilen ───────────────────────────────────────────
alter table public.food_items enable row level security;
alter table public.food_logs enable row level security;
alter table public.nutrition_goals enable row level security;
alter table public.water_logs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'food_items' and policyname = 'Own food items') then
    create policy "Own food items" on public.food_items
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  -- Ein Eintrag darf nur auf ein eigenes Lebensmittel zeigen.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'food_logs' and policyname = 'Own food logs') then
    create policy "Own food logs" on public.food_logs
      for all using (auth.uid() = user_id)
      with check (
        auth.uid() = user_id
        and (
          food_item_id is null
          or exists (select 1 from public.food_items f where f.id = food_logs.food_item_id and f.user_id = auth.uid())
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'nutrition_goals' and policyname = 'Own nutrition goals') then
    create policy "Own nutrition goals" on public.nutrition_goals
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'water_logs' and policyname = 'Own water logs') then
    create policy "Own water logs" on public.water_logs
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ─── Gerichte (Nachtrag 18.10.2026) ──────────────────────────────────────
-- Ein Gericht ist ein eigenes Lebensmittel mit Zutaten: Werte je 100 g sind
-- aus den Zutaten ausgerechnet, die Portion ist Gesamtgewicht / Portionen.
-- Die Zutaten stehen als Schnappschuss daneben (zum späteren Bearbeiten).
-- Rein additiv: zwei neue, leere Spalten; bestehende Zeilen bleiben, wie sie sind.
alter table public.food_items add column if not exists ingredients jsonb
  check (ingredients is null or (
    jsonb_typeof(ingredients) = 'array'
    and jsonb_array_length(ingredients) between 1 and 60
    and octet_length(ingredients::text) <= 60000
  ));
alter table public.food_items add column if not exists portions numeric(5,2)
  check (portions is null or (portions >= 0.1 and portions <= 50));
