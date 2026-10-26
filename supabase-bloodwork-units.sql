-- Blutwerte: gewaehlte Anzeige-Einheiten im eigenen Profil.
--
-- Form: { "system": "konventionell" | "si", "marker": { "<Markername>": "<Einheit>" } }.
-- Nur eine Anzeige-Vorliebe — die gespeicherten Messwerte bleiben unveraendert
-- in ihrer Original-Einheit. Profile sind nur fuer den eigenen Nutzer lesbar
-- (Policy "Own profile"), die Spalte erbt das.
--
-- Rein additiv und idempotent: eine neue Spalte mit Standardwert und eine
-- Pruefung der Grundform. Keine Zeile wird inhaltlich geaendert.

begin;

alter table public.profiles
  add column if not exists bloodwork_units jsonb not null default '{}'::jsonb;

-- Nur ein Objekt, und klein — Missbrauch als Datenablage ausschliessen.
-- Ohne drop: die Pruefung wird nur angelegt, wenn es sie noch nicht gibt.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_bloodwork_units_shape' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_bloodwork_units_shape
      check (jsonb_typeof(bloodwork_units) = 'object' and pg_column_size(bloodwork_units) <= 8192);
  end if;
end;
$$;

commit;
