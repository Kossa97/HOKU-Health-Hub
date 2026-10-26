# Werkzeugregel

**Für jede Arbeit wird das dafür vorgesehene Plugin/Skill benutzt — auch mehrere,
wenn die Aufgabe mehrere berührt.** Erst prüfen, welches Werkzeug zuständig ist,
dann arbeiten. Passt keins, normal arbeiten und das in der Antwort sagen.

Mehrere kombinieren ist der Normalfall, nicht die Ausnahme: eine Änderung am Code
ist typischerweise `graphify` (orientieren) → arbeiten → `graphify update .` →
`code-review`; ein Artefakt mit Diagrammen ist `artifact-design` +
`artifact-diagramming`.

## Zuordnung

| Arbeit | Werkzeug |
|---|---|
| Frage zur Codebasis, Architektur, „wo liegt X", „was hängt woran" | `graphify` (`query` / `path` / `explain`) — **vor** grep/read |
| nach jeder Codeänderung | `graphify update .` |
| Code auf Fehler prüfen (Diff, Branch, PR, Pfad) | `code-review` |
| Code aufräumen: Wiederverwendung, Vereinfachung, Effizienz | `simplify` |
| Sicherheitsprüfung der Änderungen | `security-review` |
| App starten, ansehen, Screenshot, „läuft das wirklich?" | `run` |
| Diagramm, Chart, Dashboard, Datenvisualisierung | `dataviz` |
| geteilte Seite / Artefakt bauen | `artifact-design`, dazu `artifact-diagramming` (Diagramme) und `artifact-capabilities` (Eingaben, gespeicherter Zustand) |
| geteiltes, kommentierbares Dokument | `anthropic-skills:docs` |
| Word / PowerPoint / Excel / PDF als Datei | `anthropic-skills:docx` / `:pptx` / `:xlsx` / `:pdf` |
| Claude-Code-Konfiguration: Hooks, Permissions, Env, Regeln festlegen | `update-config` |
| weniger Berechtigungs-Nachfragen | `fewer-permission-prompts` |
| Tastenkürzel | `keybindings-help` |
| wiederkehrende Aufgabe, Intervall, „alle N Minuten prüfen" | `loop` |
| Claude-API, Modell-IDs, Preise, Token, Caching | `claude-api` |
| neuen Skill bauen oder verbessern | `anthropic-skills:skill-creator` |
| Startup-Hook für Web-Sessions | `session-start-hook` |
| CLAUDE.md neu anlegen | `init` |
| Animation bauen (Übergang, Bewegung, Feder, Geste) | `animate`, Grundhaltung aus `emil-design-eng` |
| Animation ruckelt, Frames fallen, welche Eigenschaft animieren | `animation-performance` |
| Wo lohnt sich Bewegung, wo nicht | `find-animation-opportunities` |
| alle Animationen prüfen und Pläne schreiben | `improve-animations` |
| UI-Feinschliff, Gesten, Sheets, Federn, Apple-Gefühl | `emil-design-eng`, `apple-design` |
| Web-App soll sich auf dem Handy nativ anfühlen (100vh, Tap-Highlight, Safe Area, Zoom bei Eingaben) | `mobile-native` |
| Komponente mit Extremdaten testen (lange Namen, leere Listen, große Zahlen) | `break-ui` |
| Bewegung benennen („wie heißt das …“) | `animation-vocabulary` |
| nur auf ausdrücklichen Aufruf: Animation-Diff streng prüfen / Varianten bauen / Bibliothek wählen | `review-animations` / `prototype` / `pick-ui-library` |

Die Liste ist nicht abschließend. Steht ein Skill in der Sitzungsliste und passt
er auf die Aufgabe, wird er benutzt, auch wenn er hier fehlt.

## Design- und Animations-Skills (Emil Kowalski)

Übernommen aus https://github.com/emilkowalski/skills (MIT, Stand Commit
2d228630, 2026-10-11), Lizenz liegt in jedem Ordner. Nicht übernommen:
`write-swift`, `animate-expo` (kein Swift/React Native im Projekt) und
`ask-sonner` (die App nutzt react-hot-toast). Die Skills sind Ratgeber, keine
Projektregeln: Wo sie etwas empfehlen, das hier anders entschieden ist (z. B.
eine neue Bibliothek), gilt das Projekt. Sprache der App-Texte bleibt de/en.

## graphify

- **graphify** (`.claude/skills/graphify/SKILL.md`) — beliebige Eingabe in einen
  Wissensgraphen. Auslöser: `/graphify`
- Tippt der Nutzer `/graphify`, zuerst den installierten graphify-Skill benutzen.
- **Vor der Arbeit:** `graphify query` statt blind grep/read. Erinnert wird per
  `PreToolUse` auf `Bash` (grep/rg/find/fd/ack/ag) und auf `Read|Glob|Grep`.
- **Nach der Arbeit:** `graphify update .`, sobald die Änderung steht und geprüft
  ist, dann `graphify-out` in einem eigenen Commit. Erinnert wird zweifach:
  `PostToolUse` auf `Write|Edit` meldet sich direkt nach einer geschriebenen
  Quelldatei; der `Stop`-Hook blockt am Ende der Runde, wenn eine Datei unter
  `src/` oder `scripts/` jünger ist als `graphify-out/manifest.json` (das schreibt jeder `graphify update`-Lauf neu, auch ohne Änderung am Graphen) — der fängt
  auch Änderungen über die Shell (sed, heredoc, Skript).
- Alles in `.claude/settings.json`. Die Regel gilt auch für Subagenten — sie
  gehört in jeden Subagenten-Prompt, der Code erkundet.

> Hinweis für spätere Änderungen an diesen Hooks: die Hinweistexte dürfen keine
> Backticks, `$` oder einfachen Anführungszeichen enthalten. Das `echo` im Hook
> ist einfach gequotet; ein Backtick darin würde von der Shell ausgeführt statt
> ausgegeben. Genau das ist beim Bau einmal passiert und hat ungefragt
> `graphify update` gestartet.
