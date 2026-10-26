-- Blutwerte, Etappe 0: Einwilligung in die KI-Auswertung von Befunden.
--
-- Der Befund-Import schickt Foto oder PDF an Anthropic (Edge Function
-- `bloodwork-extract`). Apple 5.1.2(i) und Art. 9 DSGVO verlangen dafuer eine
-- ausdrueckliche Einwilligung vorab. Sie steht mit Zeitpunkt im Profil; null
-- heisst: nicht erteilt oder widerrufen. Die Edge Function prueft sie selbst.
--
-- Rein additiv und idempotent: eine neue Spalte und ein Trigger, keine Zeile
-- wird geaendert.

begin;

alter table public.profiles add column if not exists ai_import_consent_at timestamptz;

-- Den Zeitpunkt setzt der Server, nicht das Geraet: aus der App wird jede
-- Einwilligung zu now(), eine bestehende bleibt beim alten Datum, und null
-- (Widerruf) geht immer. So laesst sich der Nachweis nicht faelschen oder
-- rueckdatieren.
create or replace function public.stamp_ai_import_consent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.ai_import_consent_at is null then
      return new;
    end if;
    if tg_op = 'UPDATE' and old.ai_import_consent_at is not null then
      new.ai_import_consent_at := old.ai_import_consent_at;
    else
      new.ai_import_consent_at := now();
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger profiles_stamp_ai_import_consent
before insert or update of ai_import_consent_at on public.profiles
for each row execute function public.stamp_ai_import_consent();

commit;
