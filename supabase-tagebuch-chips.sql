-- Tagebuch v2: ein Eintrag, viele Chips (Wirkungen und Nebenwirkungen).
--
-- Bisher hielt eine Zeile in `effects` genau eine Wirkung: Art, Freitext,
-- Intensitaet, Dauer. Jetzt ist ein Eintrag Titel + optionale Substanz +
-- Zeitpunkt + Notiz; jede gewaehlte Wirkung ist eine Zeile in
-- `effect_symptoms` mit eigener Art, Intensitaet und Dauer.
--
-- Was diese Datei tut:
--   1. neue Tabelle `effect_symptoms` mit Zugriffsregel und Eigentuemer-Pruefung
--   2. `effects.type` und `effects.severity` duerfen leer sein (neue Eintraege
--      tragen beides je Chip); `description` ist ab jetzt der Pflicht-Titel
--
-- Rein additiv: nichts wird geloescht oder umbenannt, die bisherige App
-- schreibt weiter wie gewohnt. Idempotent: ein zweiter Lauf aendert nichts.
-- Planung: memory/projects/tagebuch.md

begin;

create table if not exists public.effect_symptoms (
  id uuid primary key default gen_random_uuid(),
  effect_id uuid not null references public.effects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('effect', 'side_effect')),
  -- Schluessel aus dem Chip-Katalog der App (z. B. 'nausea'); Namen kommen aus
  -- der Uebersetzung. Eigene Chips haben stattdessen einen Namen.
  symptom_key text check (symptom_key ~ '^[a-z][a-z0-9_]{1,47}$'),
  custom_label text check (custom_label is null or char_length(btrim(custom_label)) between 1 and 80),
  severity smallint not null check (severity between 1 and 5),
  -- Dauer in Minuten; das Picker-Rad reicht bis 59 Wochen.
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 594720),
  ongoing boolean not null default false,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint effect_symptoms_key_or_label check ((symptom_key is null) <> (custom_label is null)),
  constraint effect_symptoms_ongoing_without_duration check (not (ongoing and duration_minutes is not null))
);

create index if not exists effect_symptoms_effect_id_idx on public.effect_symptoms (effect_id);
create index if not exists effect_symptoms_user_key_idx on public.effect_symptoms (user_id, symptom_key);
-- Derselbe Katalog-Chip nur einmal je Eintrag.
create unique index if not exists effect_symptoms_effect_key_uniq
  on public.effect_symptoms (effect_id, symptom_key) where symptom_key is not null;

alter table public.effect_symptoms enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'effect_symptoms' and policyname = 'Own effect symptoms'
  ) then
    create policy "Own effect symptoms" on public.effect_symptoms
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end
$$;

-- Ein Chip gehoert immer derselben Person wie sein Eintrag.
create or replace function public.check_effect_symptom_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.effects
    where id = new.effect_id and user_id = new.user_id
  ) then
    raise exception 'effect_symptom_not_owned' using errcode = '42501';
  end if;
  return new;
end
$$;

create or replace trigger effect_symptoms_check_owner
before insert or update of effect_id, user_id
on public.effect_symptoms
for each row
execute function public.check_effect_symptom_owner();

-- Nur als Trigger gedacht, nicht über die API aufrufbar (wie supabase-function-grants.sql).
revoke execute on function public.check_effect_symptom_owner() from public, anon, authenticated;

-- Neue Eintraege tragen Art und Intensitaet je Chip.
alter table public.effects alter column type drop not null;
alter table public.effects alter column severity drop not null;

comment on column public.effects.description is 'Titel des Eintrags (Pflicht).';
comment on table public.effect_symptoms is 'Tagebuch: gewaehlte Wirkungen/Nebenwirkungen eines Eintrags (Chips).';

commit;

-- Pruefabfrage (aendert nichts). Erwartet nach dem Lauf:
-- tabelle_da = 1 | rls_an = true | regel = 1 | trigger = 1 | type_leer_erlaubt = YES | severity_leer_erlaubt = YES
select
  (select count(*) from pg_tables where schemaname = 'public' and tablename = 'effect_symptoms') as tabelle_da,
  (select relrowsecurity from pg_class where oid = 'public.effect_symptoms'::regclass) as rls_an,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'effect_symptoms') as regel,
  (select count(*) from pg_trigger where tgrelid = 'public.effect_symptoms'::regclass and not tgisinternal) as trigger,
  (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'effects' and column_name = 'type') as type_leer_erlaubt,
  (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'effects' and column_name = 'severity') as severity_leer_erlaubt,
  (select count(*) from public.effects) as effects_zeilen,
  (select count(*) from public.effect_symptoms) as chip_zeilen;
