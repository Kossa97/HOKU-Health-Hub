-- Dot, der KI-Coach: Einwilligung, Pro-Zugang und Tageslimit.
--
-- Der Chat schickt Frage und eine Zusammenfassung der Nutzerdaten an
-- Anthropic (Edge Function `coach`). Apple 5.1.2(i) und Art. 9 DSGVO
-- verlangen eine ausdrückliche Einwilligung vorab; sie steht mit Zeitpunkt
-- im Profil, null heißt nicht erteilt oder widerrufen.
--
-- Heraus kommt Dot nur mit Pro (oder für Tester). `pro_until` setzt allein
-- der Server (später der Kauf-Abgleich); aus der App ist es unveränderbar.
--
-- Gespeichert wird vom Chat nichts außer der Zahl der Fragen je Tag.
--
-- Rein additiv und idempotent: zwei neue Spalten, eine neue Tabelle, zwei
-- Trigger, eine Funktion. Keine bestehende Zeile wird geändert.

begin;

alter table public.profiles add column if not exists coach_consent_at timestamptz;
alter table public.profiles add column if not exists pro_until timestamptz;

-- Den Zeitpunkt der Einwilligung setzt der Server, nicht das Gerät (wie bei
-- ai_import_consent_at): aus der App wird jede Einwilligung zu now(), eine
-- bestehende behält ihr Datum, null (Widerruf) geht immer.
create or replace function public.stamp_coach_consent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.coach_consent_at is null then
      return new;
    end if;
    if tg_op = 'UPDATE' and old.coach_consent_at is not null then
      new.coach_consent_at := old.coach_consent_at;
    else
      new.coach_consent_at := now();
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger profiles_stamp_coach_consent
before insert or update of coach_consent_at on public.profiles
for each row execute function public.stamp_coach_consent();

-- Pro aus der App unveränderbar: beim Anlegen leer, beim Ändern bleibt es.
create or replace function public.protect_profile_pro_until()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.pro_until := null;
    else
      new.pro_until := old.pro_until;
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger profiles_protect_pro_until
before insert or update on public.profiles
for each row execute function public.protect_profile_pro_until();

-- Fragen je Nutzer und Tag (UTC). Nur die Zahl, kein Inhalt.
create table if not exists public.coach_usage (
  user_id uuid not null references auth.users on delete cascade,
  tag date not null,
  anzahl integer not null default 0 check (anzahl >= 0),
  primary key (user_id, tag)
);
alter table public.coach_usage enable row level security;
-- Lesen darf jeder seine eigenen Zeilen; schreiben nur die Edge Function.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'coach_usage' and policyname = 'Own coach usage') then
    create policy "Own coach usage" on public.coach_usage for select using (auth.uid() = user_id);
  end if;
end;
$$;
revoke insert, update, delete on public.coach_usage from anon, authenticated;

-- Atomar hochzählen. Gibt die neue Zahl zurück, oder null, wenn das Limit
-- schon erreicht ist (dann wird nicht gezählt). Nur für die Edge Function.
create or replace function public.coach_zaehlen(p_user uuid, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.coach_usage (user_id, tag, anzahl)
  values (p_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, tag) do update
    set anzahl = public.coach_usage.anzahl + 1
    where public.coach_usage.anzahl < p_limit
  returning anzahl into n;
  return n;
end;
$$;

revoke all on function public.coach_zaehlen(uuid, integer) from public, anon, authenticated;
grant execute on function public.coach_zaehlen(uuid, integer) to service_role;

commit;
