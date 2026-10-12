-- Blutwerte: Wechseljahre je Messung (nur Östradiol, LH, FSH bei Frauen).
--
-- Wofür: Für diese drei Werte hängt der Referenzbereich bei Frauen davon ab,
-- ob die Wechseljahre schon vorbei sind. Die App fragt das beim Eintragen
-- (nur wenn im Profil „weiblich“ steht). NULL = nicht angegeben; dann zeigt
-- die App ohne Laborbereich weiterhin keinen Bereich.
--
-- Rein additiv und idempotent: eine Spalte ohne Standardwert und eine
-- Prüfung. Keine Zeile wird geändert. Die Spalte erbt die bestehende Regel
-- „Own data only“ der Tabelle.

begin;

alter table public.bloodwork
  add column if not exists menopause text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bloodwork_menopause_values' and conrelid = 'public.bloodwork'::regclass
  ) then
    alter table public.bloodwork add constraint bloodwork_menopause_values
      check (menopause is null or menopause in ('pre', 'post'));
  end if;
end;
$$;

commit;
