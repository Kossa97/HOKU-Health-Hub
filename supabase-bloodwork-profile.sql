-- Blutwerte: Geburtsdatum und biologisches Geschlecht im eigenen Profil.
--
-- Wofuer: Referenzbereiche nach Alter und Geschlecht, wenn ein Befund keinen
-- eigenen Laborbereich hat. Beide Angaben sind freiwillig (NULL = keine
-- Angabe). Profile sind nur fuer den eigenen Nutzer lesbar (Policy "Own
-- profile"); die Spalten erben das. Das oeffentliche Profil (/u/<name>) und
-- der PDF-Export lesen sie nicht.
--
-- Die alten Spalten "age" und "gender" (genutzt von /health und dem PDF)
-- bleiben, wie sie sind — nichts wird geloescht oder umgeschrieben.
--
-- Rein additiv und idempotent: zwei neue Spalten ohne Standardwert und je
-- eine Pruefung. Keine Zeile wird inhaltlich geaendert.

begin;

alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists bio_sex text;

do $$
begin
  -- Erwachsene: ein plausibles Datum, nicht in der Zukunft.
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_birth_date_range' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_birth_date_range
      check (birth_date is null or birth_date between date '1900-01-01' and date '2100-01-01');
  end if;
  -- Nur fuer die Laborbereiche: maennlich oder weiblich; NULL = keine Angabe.
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_bio_sex_values' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_bio_sex_values
      check (bio_sex is null or bio_sex in ('male', 'female'));
  end if;
end;
$$;

commit;
