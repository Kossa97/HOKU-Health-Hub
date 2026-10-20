# Kalorientracker / Ernährung

**Stand:** 18.10.2026 — Etappe 1 gemergt (#28), **Gerichte** gemergt (#30, Spec 8a). **Foto-KI** auf `claude/ernaehrung-foto` (Spec 8b). Spec:
`docs/superpowers/specs/2026-10-18-ernaehrung-kalorientracker-design.md`.

## Entschieden (Nutzer, 18.10.2026)
- Datenquellen: **Open Food Facts + BLS**
- Erster Wurf: **Kern + Barcode-Scanner**
- Ort: **eigene Route `/ernaehrung`**

## Entschieden (technisch, mit Grund)
- OFF nur über Edge Function `food-lookup` (User-Agent-Pflicht, Cache, Datenschutz); echte Sitzung, 30/min je Nutzer, Bremse 12 Produkt-/8 Suchabrufe pro Minute.
- Scanner OHNE natives Plugin: ML Kit kann auf iOS nur CocoaPods, Projekt nutzt SPM → `getUserMedia` + `BarcodeDetector`/ZXing-WASM (gepinnt: barcode-detector 3.2.2, zxing-wasm 3.1.3; nicht im SW-Precache).
- Barcode: Prüfziffer Pflicht, UPC-A → GTIN-13 (führende 0), UPC-E bleibt 8-stellig.
- i18n: 143 Schlüssel `nutr_*`/`tile_ernaehrung*`, de/en echt, 12 Sprachen engl. Platzhalter; Vertrags-Hashes in `my-stack/lib/i18n.test.ts` neu.
- Markensuche nur auf „Suchen", nicht beim Tippen (OFF: 10 Suchen/min/IP, rät von Suche-beim-Tippen ab).
- Schnappschuss der Nährwerte im Eintrag; Korrekturen fremder Einträge werden eigene `food_items`.
- Keine Streaks, kein Rot, Zielbereich ±10 %, „Kalorien ausblenden".
- Gerichte (Wunsch Nutzer 18.10.): = `food_items` mit `ingredients` jsonb + `portions`; Eintrag in Gramm, Eingabe in Portionen. Migration als Nachtrag in `supabase-nutrition.sql` (2 Spalten, additiv).
- Kalender (Nutzer 19.10.): **kein gemeinsamer Kalender** mit den Substanzen. Ernährung hat oben eine Wochenleiste (Mo–So) und ein Monatsblatt mit **Ringen je Tag** (außen kcal, dann Eiweiß, KH, Fett; bei „Kalorien ausblenden" ohne kcal-Ring). Der **gewählte Tag** wird zwischen Kalender und Ernährung geteilt (`src/lib/sharedDay.ts`, sessionStorage, verfällt um Mitternacht; geschrieben nur bei Nutzerwahl). Branch `claude/ernaehrung-kalender`, baut auf #35 auf.
- Kalorien-Kugel (Nutzer 20.10., Prototyp https://claude.ai/artifact/1k6RvpTR3LF6ozh8nB4Nmq): Tagesfortschritt als Punkt-Kugel im Stil von `thinking-orbs` (Paket 0.3.2 installiert, eigene Canvas-Komponente nötig: die fertige Komponente kann nur 20/32/64 px und eine Farbe). **1 Punkt = 1 kcal** (ab 4000 mehrere kcal), **nur Kalorien** in der Akzentfarbe, Füllung **von unten nach oben**, über dem Ziel als lockere Hülle außen (kein Rot). Lebendig: langsame Eigendrehung, leichtes Schwingen, neue Punkte leuchten beim Eintragen auf; 30 fps, Pause im Hintergrund, „Bewegung reduzieren“ = still. **Drehen per Finger in alle Richtungen** (Quaternion, Schwung), **verankert**: richtet sich nach ~0,7 s langsam wieder auf (nur Kippen wird zurückgenommen). Makros nicht in der Kugel (Energie ≠ Gramm, zu viel). **Festgehalten: Orbits** = drei schräge Punkt-Ringe (Eiweiß/KH/Fett) um die Kugel, leuchtend bis zum Grammziel, darunter „64 / 150 g“. **Gewählt (Nutzer 20.10.): Makro-Monde** = drei kleine Punkt-Kugeln auf schrägen Bahnen um die Kalorien-Kugel, je nach Grammziel gefüllt, Größe nach Grammziel (KH > Eiweiß > Fett). Drehen nur noch **seitlich mit Schwung** (senkrecht scrollt die Seite, `touch-action: pan-y`), kein Aufrichten mehr nötig; **Mond antippen** (oder Legende) holt ihn nach vorne, vergrößert ihn und zeigt „Eiweiß 64 / 150 g“ für ~3 s. Orbits bleiben als Alternative festgehalten. **Animationen (20.10.):** Eintragen = Punkte fliegen vom Knopf im Bogen in ihre Plätze der Kugel (bis 90) und in die Monde (36, nach Gramm), ~0,56 s je Punkt, 0,42 s gestaffelt, ease-in-out (0.77, 0, 0.175, 1); Plätze bleiben grau bis zur Ankunft und leuchten dann auf — **in den Monden genauso** (Nutzer 20.10.: bis 24 Punkte je Mond in genau die neu gefüllten Plätze, kein Pulsieren des ganzen Mondes; Entfernen holt sie aus den Plätzen, die leer werden). Entfernen (Nutzer 20.10. geändert) = halb so viele Punkte wandern zum **untersten Punkt ihrer Kugel** (kcal aus der großen Kugel, Makros aus dem jeweiligen Mond) und fallen dort unten heraus, verblassend, ~0,6 s, 0,26 s gestaffelt, ease-in-out (0.77, 0, 0.175, 1), ohne Aufleuchten; „Rückgängig" spielt den Einflug. Mond-Fokus: eigener Wert je Mond (der alte schrumpft, während der neue wächst), weich vom aktuellen Wert aus, während des Übergangs volle Bildrate. Bewegung reduzieren: kein Flug. Dauer der Animation ist fest (~1,1 s rein, ~0,9 s raus), nur die Punktzahl hängt vom Gericht ab. Große Ziele (bis 10.000 kcal getestet im Prototyp): höchstens 4000 Punkte, dann 1 Punkt = mehrere kcal; Punktgröße schrumpft mit √(3000/Punkte), begrenzt 0,8–1,15. **Monde: 1 Punkt = 1 g** (Nutzer 20.10.): Punktzahl je Mond = Grammziel (20–1500, darüber mehrere g je Punkt), Größe √(Mondpunkte / Kugelpunkte) → gleiche Punktdichte wie die Kalorien-Kugel, wächst mit dem Ziel; Anzeige „1 Punkt = 1 kcal · 1 g“. **WebGL entschieden (Nutzer 20.10.: „Flüssigkeit geht vor")**: Kugel, Monde, Bahnen und Hülle in einem einzigen `gl.POINTS`-Auftrag; Lage/Farbe/Aufleuchten weiter in JS, weicher Kreis im Fragment-Shader (voll bis 55 %, dann linear aus) — sieht aus wie das Canvas-2D-Sprite. Canvas 2D bleibt Rückfall ohne WebGL; Kontextverlust wird abgefangen. Fliegende Punkte (≤ ~200) und Mini-Kugeln bleiben Canvas 2D. Immer volle Display-Bildrate (kein 30-fps-Deckel mehr), Pause im Hintergrund. Headless gemessen: ~0,9 ms Rechenzeit je Bild bei 4000 Punkten. Auf dem iPhone 16 Pro des Nutzers 60 fps: WebKit deckelt `requestAnimationFrame` in Safari/WKWebView auf 60 (`CADisableMinimumFrameDurationOnPhone` hilft dort nicht). **Entscheidung (Nutzer 20.10.): in der App bei 60 bleiben**, kein Plugin mit privaten WebKit-APIs (App-Store-Risiko), keine native Kugel. Der Code hat keinen Deckel — hebt Apple die Grenze auf, läuft es ohne Änderung mit 120. Kalender: schlichte Mini-Kugel (nur kcal) statt Ringe, Reihenfolge Kugel – Zahl – Tag, gewählter Tag graue Fläche.

## Recherche (Agent-Bericht 18.10.2026, nur WebSearch — Primärseiten waren gesperrt)
Legende: [B] belegt, [H] Hersteller, [K] Konkurrenz-Blog, [E] Einzelstimme/Sekundär

**Preise/Funktionen**
- MFP: Free / Premium 79,99 $/J / Premium+ 99,99 $/J [E/K]. Barcode seit 1.10.2022 Premium [B] (droid-life.com, pocket-lint.com). Meal Scan, Voice Log, Makroziele in g nur Premium [E]. GLP-1-Modus angekündigt, nur US [H]. März 2026 Übernahme von Cal AI [E].
- Yazio: Free = Zähler + Fasten-Timer mit Werbung [E, giga.de]. PRO ~30–84 €/J je nach Region/Aktion [E/K]. Kein GLP-1-Angebot gefunden.

**Schwächen**
- Werbung/Pop-ups: Yazio KI-Pop-up nach fast jedem Eintrag, nicht abschaltbar [E, Trustpilot]; Kimola: Pop-ups, Datenverlust, Datenbank, Abo [E].
- Datenschutz: MFP-Leck 02/2018 ~150 Mio. Konten [B, bleepingcomputer]; mobilsicher.de rät von MFP ab [B]; Exodus: 16 Tracker in MFP 25.3.0 [B, statisch].
- Abo: Yazio-Kündigung je Kaufweg, App löschen kündigt nicht [E, giga].
- Stiftung Warentest zuletzt 2013 [B, veraltet]; heise-Test 6 Apps (FDDB, FatSecret, Lifesum, MFP, Noom, Yazio) — Ergebnis noch nicht gelesen.

**Wissenschaft**
- Evenepoel 2020 (JMIR, PMC7641788): MFP Energie r = 0,96, Makros r = 0,90, schlecht bei Natrium [B].
- NIH/NUTRITION 2026 (Abstract): Foto-Apps unterschätzen 250–345 kcal/Mahlzeit [E, vorläufig].
- Nur 3 % von 190.000 Downloads > 1 Woche Nutzung (Cordeiro CHI 2015) [B/E]; Laing 2014 RCT: kein Effekt, Zeitaufwand [B]; Harvey 2019: Häufigkeit > Detail, ~15 min/Tag [B]; Withings: Abbruch nach Gewichtszunahme [B, PMC7109615].
- Essstörung: Simpson & Mazzeo 2017; Levinson 2017 (73 % der MFP-Nutzer mit ES sehen Beitrag) [B, PMC5700836]; Linardon & Messer 2019 [B]; Design-Empfehlung ohne Zahlen, weniger Erinnerungen [B, PMC8485346].

**Umsetzung**
- OFF: 15 Produkt-/10 Suchanfragen pro Minute und IP; User-Agent Pflicht; v3 Produkt-API empfohlen; Search-a-licious `search.openfoodfacts.org`; ODbL (Share-Alike bei öffentlicher Datenbank) [B via Suche].
- BLS 4.0: MRI, seit 16.12.2025 kostenlos, **CC BY 4.0**, kommerziell/Apps erlaubt, ~7.140 Lebensmittel, 138 Nährstoffe; blsdb.de/download, Doku blsdb.de/assets/uploads/BLS_4_0_Dokumentation_DE.pdf. Format/englische Namen ungeprüft.
- GLP-1: Joint Advisory 2025 (ACLM/ASN/OMA/TOS): Eiweiß + Krafttraining, GI-Nebenwirkungen, Mikronährstoffe [B]. Eiweiß 1,2–1,6 g/kg [E]. Fettfreie Masse ~40 % (STEP 1) bzw. ~25 % (SURMOUNT-1) des Verlusts [B]. App-Daten: GLP-1-Nutzer 0,6 g/kg Eiweiß [E].
- Konkurrenz GLP-1: MyNetDiary GLP-1 Companion (05/2026, Premium) [H].

## Offen
| Punkt | Stand |
|---|---|
| BLS-Datei laden, Format prüfen, Generator + `food_catalog` | Container-Netz sperrt blsdb.de — Domain freigeben oder Datei ins Repo legen |
| OFF live testen | Container-Netz sperrt openfoodfacts.org; Tests mit nachgebildeten Antworten |
| Migration gegen Produktion | **erledigt 18.10.2026** (`nutrition_etappe1`): 4 Tabellen mit RLS, 4 Policies, 7 Indizes, 0 Zeilen; Nutzer 14, weight_logs 645, profiles 13 unverändert. Parallel lief `training_workout_tracker` (andere Sitzung, +4 Tabellen/+16 Policies) |
| Edge Function deployen | **erledigt 18.10.2026**: `food-lookup` v1 aktiv, verify_jwt an. Rauchtest aus dem Container nicht möglich (supabase.co gesperrt) — erster echter Aufruf aus der App steht aus, dann Logs prüfen |
| Datenschutzerklärung / Store-Angaben | ergänzt (siehe unten); Store-Angaben in `docs/store-compliance.md` nachgezogen |
| Skalierung OFF | bei mehr Nutzern OFF-Dump importieren statt live |
| Gerätetest Scanner iOS/Android | offen |
| Gerichte: Migration gegen Produktion | **erledigt 18.10.2026** (`nutrition_gerichte`): food_items Spalten 20 → 22, Checks 15 → 17; Zeilen food_items/food_logs/water_logs unverändert, Policies 4 |
| Gerichte: Gewicht nach dem Kochen | bewusst weggelassen; bei Bedarf optionales Feld |
| Foto-KI (Spec 8b) | Nutzer 18.10.: KI nennt **nur Zutaten** (Gericht + mögliche Zutaten mit Alternativen, Nutzer tippt an), Notiz empfohlen, auch ohne Foto; Lebensmittel/Menge wählt der Nutzer. Rezeptwissen = Modell + eigene Gerichte (keine eigene Rezept-DB: Lizenzen). Gebaut auf `claude/ernaehrung-foto`; **Produktion 19.10.2026:** Migration `nutrition_photo_ai` (profiles Spalten 24 → 25, Trigger 3 → 4, Profile 13 und Befund-Einwilligungen 1 unverändert; `food_photo_scans` neu, RLS an, 1 Policy, 0 Zeilen) und Edge Function `food-photo` v1 (verify_jwt an). Erster echter Aufruf aus der App steht aus — dann Logs prüfen; Modell: **Haiku 5.5, effort low** (Nutzer: „so preiswert wie möglich“) |
| BLS-Import | wird mit Foto-KI wichtiger: generische Zutaten finden sonst nur Markenprodukte |
| Datenschutzerklärung | **ergänzt** auf `claude/ernaehrung-foto` (Ernährung, Kamera, OFF, Anthropic-Mahlzeiten); geht mit dem Foto-PR live |
| **Nutzer kümmert sich (gemerkt 18.10.2026)** | 1. Anthropic-Vertrag: Speicherdauer/Nutzung und Übermittlungsgrundlage USA in die Platzhalter [[…]] der Datenschutzerklärung (Abschnitt 5). 2. Ergänzte Rechtstexte rechtlich prüfen lassen. Beides auch in der Checkliste `docs/store-compliance.md` → „Vor dem Einreichen — von dir“. Bei jedem Ernährungs-/Store-Thema daran erinnern |
| Etappe 2 | Fortschritt-Chart, GLP-1-Hinweise aus Stack, PDF-Protokoll, Health-Aktivitätskalorien |
