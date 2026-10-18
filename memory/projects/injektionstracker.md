# Injektionstracker

**Stand:** 16.10.2026, v1 auf `main` (PR #23, Merge 13590b3a); Folgearbeit auf `claude/vigilant-davinci-iucck1`
**Code:** `src/pages/InjektionsTracker.tsx`, `src/components/injection3d/`,
`src/lib/injection*.ts`

## Entschieden: Körpermodell v2

**Quelle:** Blender Studio „Human Base Meshes“ — https://www.blender.org/download/demo-files/
(Asset Bundles). Lizenz **CC0** (kostenlos, auch kommerziell, keine Namensnennung).
v1.4.1, 49 MB, `.blend`, braucht Blender 4.2 LTS+. 17 Meshes, darunter realistisch
männlich und weiblich.

**Ziel:** weiblicher Torso, dazu ggf. ein besserer männlicher als Ersatz für
`torso_hybrid_v1` (Herkunft/Lizenz des aktuellen Modells unbekannt).

**Nutzer will sich die Modelle erst selbst ansehen** — nicht ungefragt anfangen.

**Ablauf v2:**
1. In Blender öffnen, Torso zuschneiden, als glTF exportieren → `assets-src/models/`.
2. `npm run model:optimize` (Skript `scripts/optimize-torso-model.mjs`).
3. Neue `model_version` je Modell (z. B. `female-v1`, `male-v2`), nicht `placeholder-v1` überschreiben.
4. `BODY_LANDMARKS` (`src/lib/injectionGeometry.ts`) je Modell neu vermessen.
5. Presets je Modell mit `scripts/compute-injection-site-presets.mjs` (exakte Region pro Preset).
6. `FIT_HEIGHT`/`FIT_Y_OFFSET` in `InjectionMapCanvas.tsx` je Modell.
7. Einstellung „Körpermodell männlich/weiblich“ (nur de/en, sonst Platzhalter).
8. Pins eines anderen Modells nur im Verlauf zeigen, nicht auf der Karte.

## Offen

| Punkt | Stand |
|---|---|
| Kontrast Überschriften in Tracker-Sheets im Light-Theme | offen |
| Rest Aufräumen | Inline-Styles in `InjektionsTracker.tsx` (bewusst gelassen: Safe-Area-Rechnungen, Risiko ohne Nutzen); 4 tote i18n-Keys `inj_setup_required`/`inj_setup_hint`/`inj_copy_sql`/`inj_copied` (Entfernen braucht neue Vertrags-Hashes für alle 14 Sprachen); `supabase-injection-pro.sql` bleibt, Trockenlauf-Tests bauen damit das Schema |
| Zwei-Schritt-Speichern bucht Bestand vor dem Insert | Altverhalten, nur ohne `confirm_intake_with_injection`/planTimelineV2 relevant (`src/lib/injectionSave.ts`) |
| Verlauf-Beschriftung nur Deutsch | `formatInjectionSite`/`regionLabel` in `src/lib/injectionHistory.ts` hart kodiert; sollte die Keys `injection_region_*`/`injection_side_*` nutzen |
| Tote i18n-Keys nach Formular-Umbau | `injection_tab_open`, `injection_open_*`, `injection_mode_*`, `injection_log_help_*`, `injection_cycle_label`, `injection_sort_*` u. a. — Entfernen braucht neue Vertrags-Hashes |
| `dose_logs`-Abfrage 90 Tage ohne Methodenfilter | Bei sehr vielen Einnahmen/Tag kann das PostgREST-Zeilenlimit (1000) greifen; dann erscheinen alte, genommene Einnahmen als offen. Schon vorher so (Altverhalten) |
| Test auf echten Geräten | VoiceOver/TalkBack, fps |
| Dauerhafter e2e-Test | braucht Embed-Support in `e2e/support` MockSupabase |

## Erledigt (v1)

Modell 17,7 MB → 1,2 MB; Rendern nur bei Bedarf; Bearbeiten/Löschen;
Einnahme + Stelle atomar (`confirm_intake_with_injection`, in Prod); i18n de/en;
SQL-Bildschirm entfernt; Stellen-Auswahl per Liste (Tastatur/Screenreader);
Regionserkennung an das Modell angepasst. Ladezeit in Prod vom Nutzer bestätigt (deutlich besser).

16.10.2026: Die 224 auffälligen Pins waren Seed-Daten des Testkontos
`test1@trackyourdose.test` (Branch `claude/testaccount-seed`). Positionen
verschoben (`supabase-injection-testaccount-sites.sql`), danach
`supabase-injection-regions-v2.sql`: 5 echte Pins „Brust“ → „Bauch“. Beides
in Prod, mit Sicherungstabellen. Seed-Skript auf dem Branch hat noch die
alten Koordinaten — vor erneutem Seeden anpassen.
Intramuskulär wurde in älteren Abfragepfaden nicht gefunden (kaputt kodierte
Liste) — behoben. Speichern ausgelagert nach `src/lib/injectionSave.ts`,
Kopf/Fehleransicht nach `InjectionTrackerChrome.tsx`.

16.10.2026, Formular-Umbau (Wunsch des Nutzers): Liste „Einnahmen“ zeigt
offene und bestätigte Einnahmen ohne Stelle, Filter Substanz (Chips) und
Zeitraum Heute/Gestern/7/14/30/60/Alle (Alle = 90 Tage). Beide Wege nutzen
dieselbe Liste (`InjectionIntakeList.tsx`). Nach Wahl der Einnahme nur noch
Karte + Stelle + Uhrzeit (einklappbar) + „Hat sich deine Dosis geändert?“ +
Notiz (einklappbar). Manuell als Link „Ohne Plan eintragen“. Karte/Verlauf:
7/14/30/Alle.

18.10.2026, Look „Bühne“ (Variante B aus den Licht-Mockups, Branch
`claude/injektionstracker-glas`; C „Dunkles Glas“ war erst umgesetzt und hat
dem Nutzer nicht gefallen): Haut bleibt im Originalmaterial. Licht in
`src/lib/injectionStageLook.ts` + `InjectionStageLight.tsx`: schwaches Licht
von vorn oben, zwei helle Kantenlichter seitlich hinten (zeichnen auch die
Rückseite), kühles Gegenlicht, schwache Spiegelungen aus lokal erzeugter
RoomEnvironment (kein HDR aus dem Netz). Hintergrund Schwarz mit Lichtkegel
von oben. Gilt für Karte und Vorschau-Karte auf Home. Pinköpfe leuchten
leicht. Kontaktschatten entfernt (auf Schwarz unsichtbar).
Offen: Test auf echtem iPhone.
