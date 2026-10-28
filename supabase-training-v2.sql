-- Workout-Tracker v2: Ordner (Plan) fuer Routinen
--
-- Eine Routine gehoert optional zu einem Plan („Push/Pull/Beine"). Der Plan ist
-- nur ein Name auf der Routine, keine eigene Tabelle: gruppiert wird in der
-- App, „Als Naechstes" ergibt sich aus dem Verlauf. Die uebrigen v2-Felder
-- (Wdh.-Bereich, Ziel-RPE je Satz) liegen im jsonb `exercises` und brauchen
-- keine Migration.
--
-- Nur eine neue Spalte, keine bestehende Zeile wird veraendert; die App liest
-- `folder` als null, solange die Spalte fehlt.
-- Idempotent: zweimal ausfuehren aendert nichts.

alter table public.training_routines
  add column if not exists folder text
    check (folder is null or char_length(btrim(folder)) between 1 and 40);
