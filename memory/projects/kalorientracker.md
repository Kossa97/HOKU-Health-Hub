# Kalorientracker / Ernährung

**Stand:** 18.10.2026 — Etappe 1 gemergt (#28). Nachtrag **Gerichte** auf `claude/ernaehrung-kalorientracker` (Spec 8a). Spec:
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
| Datenschutzerklärung / Store-Angaben | Ernährungsdaten, Kamera, Weitergabe an OFF (ohne Personenbezug) ergänzen |
| Skalierung OFF | bei mehr Nutzern OFF-Dump importieren statt live |
| Gerätetest Scanner iOS/Android | offen |
| Gerichte: Migration gegen Produktion | **erledigt 18.10.2026** (`nutrition_gerichte`): food_items Spalten 20 → 22, Checks 15 → 17; Zeilen food_items/food_logs/water_logs unverändert, Policies 4 |
| Gerichte: Gewicht nach dem Kochen | bewusst weggelassen; bei Bedarf optionales Feld |
| Foto-KI (Spec 8b) | gebaut auf `claude/ernaehrung-foto`; Migration `supabase-nutrition-photo.sql` (Trockenlauf ok) + Edge Function `food-photo` warten auf Freigabe; Modell Opus 5.5 (Kosten ≈1–2 ct/Foto) — Nutzer fragen, ob günstiger |
| Datenschutzerklärung | zusätzlich: Essensfotos an Anthropic (USA), eigene Einwilligung |
| Etappe 2 | Fortschritt-Chart, GLP-1-Hinweise aus Stack, PDF-Protokoll, Health-Aktivitätskalorien |
