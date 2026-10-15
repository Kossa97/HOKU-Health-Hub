# Injektionstracker

**Stand:** 15.10.2026, v1 auf `main` (PR #23, Merge 13590b3a)
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
| Herkunft der gespeicherten Pins | Großteil stammt aus der Zeit vor dem 3D-Tracker (seit 24.06.2026) mit auffällig regelmäßigen Positionen. `supabase-injection-regions-v2.sql` bleibt **gesperrt**, bis geklärt ist, ob Name oder Position stimmt. Alternative: Positionen statt Namen verschieben |
| Kontrast Überschriften in Tracker-Sheets im Light-Theme | offen |
| Aufräumen (Punkt 7) | `InjektionsTracker.tsx` lang mit Inline-Styles; Mojibake-Workaround `IntramuskulÃ¤r` in `INJECTABLE_METHODS`; ungenutzt `injectionSaveActionLabel` und Keys `inj_setup_required`/`inj_setup_hint`/`inj_copy_sql`/`inj_copied`; veraltete `supabase-injection-pro.sql` (`peptide_id`) |
| Ladezeit in Prod prüfen | nach Deploy von 13590b3a |
| Test auf echten Geräten | VoiceOver/TalkBack, fps |
| Dauerhafter e2e-Test | braucht Embed-Support in `e2e/support` MockSupabase |

## Erledigt (v1)

Modell 17,7 MB → 1,2 MB; Rendern nur bei Bedarf; Bearbeiten/Löschen;
Einnahme + Stelle atomar (`confirm_intake_with_injection`, in Prod); i18n de/en;
SQL-Bildschirm entfernt; Stellen-Auswahl per Liste (Tastatur/Screenreader);
Regionserkennung an das Modell angepasst.
