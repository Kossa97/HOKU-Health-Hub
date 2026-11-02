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

## Werkbank: Übersicht aller Arbeiten

Der Nutzer arbeitet in vielen Fenstern parallel, auf dem Computer und in der
Cloud (claude.ai/code; das Repo hieß dort früher TYD-TrackYourDose, heute
HOKU-Health-Hub). Die Regel gilt für beide. Den Überblick hält die Seite
**Hoku Werkbank**: https://claude.ai/artifact/1TdihdC4AWy2Vv79LpPbjG
(Quelle: `docs/werkbank/werkbank.html`). Ihre Daten liegen in der
Artefakt-Datenbank, gelesen und geschrieben mit dem Werkzeug `ArtifactData`.

**Zu Beginn einer Arbeit:** `list` auf `arbeiten` ausführen. Gibt es schon eine Zeile für
diese Arbeit, wird sie weiterverwendet. Danach `ideen` mit `arbeit == <id>`
lesen; offene Ideen des Nutzers kurz ansprechen. Ideen mit `uebernehmen: true`
(ohne Arbeit) dem Nutzer vorschlagen: daraus eine neue Arbeit machen, sie danach
mit `arbeit` verknüpfen und `uebernehmen` auf `false` setzen.

**Am Ende jeder Runde, in der an der App gearbeitet wurde** (vor `wrap_up`),
die eigene Zeile in `arbeiten` schreiben. `doc_id` ist ein kurzer, stabiler Slug
der Arbeit (z. B. `profil`, `push-erinnerungen`). Bei bestehender Zeile wird
`update` mit `if_version` benutzt.

**Der Nutzer programmiert nicht.** Alles auf der Seite ist Alltagssprache ohne
Fachwörter (kein Branch, Merge, PR, Commit, Deploy, Migration). Technisches
gehört nur in `offen`, `branch`, `ordner`, `pr`, die auf der Seite eingeklappt sind.

Für den Nutzer, in Alltagssprache:
- `titel`: kurzer Name der Arbeit
- `wasIstDas`: ein Satz, was die Arbeit für die App bedeutet
- `stufe`: `idee` | `geplant` | `bau` (wird gebaut) | `pruefung` (wird geprüft) |
  `live` (ist in der App)
- `status` (wer dran ist): `laeuft` (Claude) | `wartet` (die Runde endet mit
  einer Frage an den Nutzer) | `pausiert` | `fertig`
- `wartetAuf`: die offene Frage an den Nutzer, so gestellt, dass sie sich ohne
  Vorwissen beantworten lässt (sonst leer)
- `letzterSchritt`: ein Satz, was zuletzt passiert ist
- `naechsterSchritt`: ein Satz, was als Nächstes passiert
- `deinTeil`: Liste `{text, erledigt}` mit Aufgaben, die **nur der Nutzer** erledigen
  kann (auf dem iPhone testen, Konto bei Apple, Entscheidung treffen). Vom Nutzer
  abgehakte Einträge stehen lassen.
- `fuerStart`: setzt der Nutzer selbst (Stern), nicht ungefragt ändern

Technik (eingeklappt):
- `offen`: offene Punkte, die Claude erledigt (kurz, Fachsprache erlaubt)
- `branch`, `ordner` (Arbeitsordner der Sitzung), `pr` (volle URL oder leer)
- `ort`: `computer` (Fenster in der Desktop-App) oder `cloud` (claude.ai/code)
- `sitzungLink`: `link` aus `get_session("self")`; in der Cloud die
  `https://claude.ai/code/...`-Adresse der Sitzung
- `fensterTitel`: `title` aus `get_session("self")`, also der Name in der
  Seitenleiste. Fenster auf dem Computer lassen sich aus der Seite nicht direkt
  öffnen; der Knopf „Zum Fenster“ zeigt dann diesen Namen.
- `aktualisiert`: jetzt, ISO-Zeit

Keine Gesundheitsdaten von Nutzern in die Werkbank schreiben, nur die Arbeit
beschreiben. Den Status, den der Nutzer auf der Seite gesetzt hat, nicht
ungefragt zurücksetzen. Ideen nicht löschen, erledigte nur abhaken.

## Git bei parallelen Fenstern

- **Jede Feature-Arbeit läuft in einem eigenen Worktree auf einem eigenen Branch**
  (neue Sitzung mit Worktree oder `EnterWorktree`). Im Hauptordner
  `peptid-tracker` wird kein Branch gewechselt, solange dort eine andere Sitzung
  arbeitet.
- **Merges nach `main` laufen nur in einem Fenster gleichzeitig.** Vor dem Merge
  `main` holen; zeigt die Werkbank eine andere Arbeit, die gerade merged, wird gewartet.
- Die Werkbank warnt, wenn sich zwei offene Arbeiten einen Ordner teilen.
