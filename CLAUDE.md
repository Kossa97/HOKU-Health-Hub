## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Projektgedächtnis

Entscheidungen und offene Punkte je Feature liegen unter `memory/projects/`
(z. B. `injektionstracker.md`: Körpermodell v2, offene Punkte). Vor Arbeit an
einem Feature dort nachsehen.

## Sprachen beim Start

Die App wird zunächst **nur auf Deutsch und Englisch** veröffentlicht.

Das heißt für Textänderungen:
- **Bearbeitet werden nur `de` und `en`** (Wunsch des Nutzers). Nur sie werden
  geschrieben, gegengelesen und geändert.
- Die zwölf übrigen Sprachen werden **nicht bearbeitet**: kein Übersetzen,
  kein Umformulieren bestehender Texte, auch nicht „nebenbei".
- Der i18n-Vertrag in `src/features/my-stack/lib/i18n.test.ts` verlangt
  trotzdem jeden Schlüssel in jeder Sprache. Ein **neuer** Schlüssel bekommt
  dort deshalb den englischen Text als Platzhalter — mehr nicht. Ändert sich
  nur der Wortlaut eines bestehenden Schlüssels, bleiben die zwölf Sprachen,
  wie sie sind.
- Vor dem Start weiterer Sprachen muss jemand mit der Sprache drüberlesen.

## Datenbankänderungen (Supabase)

In der Produktivdatenbank liegen **Gesundheitsdaten echter Nutzer** — Stack,
Einnahmeprotokolle, Blutwerte. Jede Änderung folgt deshalb derselben Reihenfolge,
auch wenn ein Supabase-Zugang verbunden ist:

1. **Als Datei ins Repo.** Jede Migration ist eine `supabase-*.sql`, reviewbar und
   versioniert — nie getippte Ad-hoc-SQL. Wo die Daten aus einer Quelle kommen,
   wird die Datei generiert (`npm run catalog:sql`) und nicht von Hand gepflegt.
2. **Trockenlauf hier im Container.** Postgres 16 liegt unter
   `/usr/lib/postgresql/16/bin` (`initdb`, `pg_ctl`, `psql`). Als `postgres`-Nutzer
   in einem für ihn erreichbaren Verzeichnis starten — `/tmp/claude-*` ist es
   nicht, `/var/tmp/...` schon. Dort das betroffene Schema nachbauen, den
   **Ist-Zustand der Produktivtabellen nachstellen**, die Migration **zweimal**
   laufen lassen (Idempotenz) und nachzählen.
3. **Erst dann gegen das echte Projekt.**
4. **Nachzählen und berichten.** Nach dem Lauf dieselbe Zählung wie im Trockenlauf,
   und das Ergebnis in der Antwort nennen — nicht „ist durchgelaufen".

Ohne ausdrückliche Zustimmung im selben Gespräch nie ausführen: `drop`,
`truncate`, `delete` ohne `where`, `alter … drop column`, `update` ohne `where`.
Auch nicht „nur kurz zum Testen".

Lesen ist erlaubt, aber sparsam: Nutzerzeilen (`stack_items`, `daily_logs`,
Blutwerte) nur, wenn die Aufgabe es verlangt — und Inhalte nie in Antworten,
Commits oder Artefakte kopieren.

## Notizen des Nutzers

Der Nutzer führt Notizen, Ideen und To-dos auf der Seite **Hoku Notizen**
(https://claude.ai/artifact/1TdihdC4AWy2Vv79LpPbjG, Quelle
`docs/werkbank/werkbank.html`, Collection `ideen`). Seine Einträge nur lesen,
wenn er darum bittet; nichts ungefragt daran ändern.

Jedes Fenster hält es dabei kurz (Werkzeug `ArtifactData`, URL oben):

- **Anmelden, einmal pro Sitzung** beim ersten Abschluss: `set` in `fenster`,
  Doc-ID ein kurzer Slug des Themas, Daten `{titel, am}` (Titel 2–4 Wörter,
  `am` als ISO-Zeit). So erscheint das Fenster in der Auswahl der Seite.
- **Nachsehen, ob etwas für dieses Fenster da ist**, am Ende jeder Runde:
  `query` auf `ideen` mit `arbeit == <Slug>` und `erledigt == false`. Treffer
  dem Nutzer nennen oder erledigen, wenn sie zur Aufgabe passen.
- **Claudes Liste:** Ein Fenster darf selbst To-dos, Notizen und Ideen
  eintragen: `ideen` mit `wer:"claude"`, `arbeit` = eigener Slug, `art`
  (notiz/idee/todo) und `feld` (wd/w/d/s) nach eigenem Ermessen, dazu `am`,
  `erledigt:false`. Nur was über die Sitzung hinaus zählt und der Nutzer später
  sehen will, **höchstens ein bis zwei Einträge pro Sitzung**, oft keiner. Text
  eine kurze Zeile (unter 60 Zeichen). Vorher mit `query` (`wer == "claude"`,
  `erledigt == false`) prüfen, dass es den Punkt noch nicht gibt. Keine
  Gesundheitsdaten von Nutzern.

## Git bei parallelen Fenstern

- **Jede Feature-Arbeit läuft in einem eigenen Worktree auf einem eigenen Branch**
  (neue Sitzung mit Worktree oder `EnterWorktree`). Im Hauptordner
  `peptid-tracker` wird kein Branch gewechselt, solange dort eine andere Sitzung
  arbeitet.
- **Merges nach `main` laufen nur in einem Fenster gleichzeitig.** Vor dem Merge
  `main` holen.

## Stand am Ende jeder Antwort

Wunsch des Nutzers, für alle Fenster: Jede Antwort, in der Änderungen an der
App (Code, Texte, Tests, Datenbankdateien) vorkommen, endet mit **einer**
Zeile zum Stand:

- Liegt alles auf `main`: **„Alles auf Main“**.
- Sonst: auf welchem Branch es liegt, mit PR-Link, falls es einen gibt,
  z. B. „Liegt auf Branch `claude/…` (PR #…), noch nicht auf Main“.

Vorher mit `git fetch` prüfen, nicht aus dem Gedächtnis.
