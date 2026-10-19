# Ernährung: Kalorientracker (Etappe 1)

**Status:** Etappe 1 gemergt (#28); Migration `nutrition_etappe1` und Edge Function `food-lookup` am 18.10.2026 in Produktion. Nachtrag „Gerichte" (Abschnitt 8a) auf `claude/ernaehrung-kalorientracker`
**Route:** `/ernaehrung`
**Code:** `src/features/ernaehrung/`, `supabase/functions/food-lookup/`, `supabase-nutrition.sql`

## 1. Anlass

TYD erfasst Stack, Einnahmen, Gewicht und Blutwerte — aber nicht, was gegessen
wird. Gerade für Nutzer von GLP-1-Agonisten (Semaglutid, Tirzepatid,
Retatrutid) ist Ernährung der fehlende Teil des Bildes. Vorbild im Umfang sind
Yazio und MyFitnessPal (MFP); besser werden wir dort, wo beide nachweislich
schwach sind (Abschnitt 2).

Bereits entschieden (Nutzer, 18.10.2026): Datenquellen Open Food Facts + BLS,
Barcode-Scanner im ersten Wurf, eigene Route `/ernaehrung`.

## 2. Schwächen der Vorbilder → unsere Antwort

Belege und Zuverlässigkeit siehe `memory/projects/kalorientracker.md`.

| Schwäche (Beleg) | Antwort in TYD |
|---|---|
| Barcode-Scanner bei MFP seit 10/2022 nur Premium; Werbung in beiden Free-Versionen | Barcode, Suche, alle Makros, eigene Ziele kostenlos, keine Werbung |
| Datenschutz: MFP-Leck 2018 (150 Mio. Konten), 16 Tracker-SDKs (Exodus), mobilsicher rät ab | Keine Werbe-/Tracking-SDKs; Lebensmittel-Anfragen laufen über unseren Server, Open Food Facts sieht weder IP noch Nutzer |
| Crowd-Datenbank mit Dubletten und Fehlern | Quelle sichtbar (BLS / Open Food Facts / eigene); Plausibilitätsprüfung kcal ≈ 4·P + 4·K + 9·F; Korrektur wird zur eigenen Fassung, die beim nächsten Scan zuerst kommt |
| Zeitaufwand ist Hauptgrund für Abbruch (Laing 2014); Häufigkeit zählt mehr als Detail (Harvey 2019); MFP-Redesign 2026 mit mehr Taps | „Häufig" mit zuletzt genutzter Menge (2 Taps), Mahlzeit nach Uhrzeit vorgewählt, Vortag kopieren, Schnelleintrag |
| Kalorienzählen korreliert mit Essstörungssymptomen (Levinson 2017, Simpson & Mazzeo 2017, Linardon 2019) | Kein Rot, keine Streaks, Zielbereich ±10 % statt Punktlandung, Schalter „Kalorienzahlen ausblenden", Untergrenze bei Vorschlägen, Hinweis auf ärztlichen Rat |
| Yazio: nicht abschaltbare Pop-ups nach Einträgen | Keine Pop-ups im Logging; Rückmeldung nur als kurzer Toast mit „Rückgängig" |
| GLP-1: Problem ist eher zu wenig Essen und Eiweiß (Joint Advisory 2025; Nutzer im Schnitt 0,6 g/kg) | Eiweiß als gleichrangige Hauptzahl; Eiweißziel je kg Referenzgewicht; Hinweis bei mehreren Tagen deutlich unter Mindestzufuhr |

## 3. Ziele Etappe 1

1. Tagesansicht: Kalorienring (bzw. Eiweißring, wenn Kalorien ausgeblendet),
   Makros, vier Mahlzeiten, Wasser, letzte 7 Tage.
2. Hinzufügen: sofortiger Filter über Häufig + Meine Lebensmittel (beim
   Tippen), Markenprodukte über Open Food Facts erst auf „Suchen".
3. Barcode: Kamera über `getUserMedia`, Erkennung über `BarcodeDetector` (Chrome/Android) oder ZXing-WebAssembly (Safari, iOS-App); Zifferneingabe immer. Prüfziffer wird geprüft, UPC-A als GTIN-13 geführt (siehe 6a).
4. Menge: g/ml, Portion des Produkts, Schnellwerte; Mahlzeit wählbar.
5. Einträge ändern (Menge, Mahlzeit), löschen mit Rückgängig, Mahlzeit vom Vortag kopieren.
6. Meine Lebensmittel: anlegen, korrigieren, Favorit.
7. Ziele: manuell oder Vorschlag aus Profil + `weight_logs`.
8. Einstieg: Home-Kachel, Schnellzugriff.

## 4. Nicht-Ziele Etappe 1

- BLS-Import (Etappe 1b — Datei konnte nicht geladen und ihr Format nicht geprüft werden, siehe 7.)
- Mikronährstoffe über Ballaststoffe/Zucker/Salz hinaus
- ~~Foto-/KI-Erkennung~~ → nachgereicht als 8b (mit Pflicht-Prüfung)
- Aktivitätskalorien aus Apple Health/Health Connect, Schreiben nach Health
- Verknüpfung mit Dosis, Appetit, Gewichtsverlauf und PDF-Protokoll (Etappe 2)
- Fasten-Timer
- Übersetzungen außer de/en (CLAUDE.md)

## 5. Datenmodell (`supabase-nutrition.sql`)

- `food_items` — Meine Lebensmittel, Werte je 100 g/ml. Auch gemerkte oder
  korrigierte fremde Einträge (`source` = `off`/`bls`, `source_ref`).
  Eindeutig je Nutzer: Barcode; (Quelle, Referenz).
- `food_logs` — Protokoll mit **Schnappschuss** der Nährwerte. `food_item_id`
  `on delete set null`; RLS prüft, dass es ein eigenes Lebensmittel ist.
  `amount` null nur bei `source = 'quick'`.
- `nutrition_goals` — eine Zeile je Nutzer, inkl. `hide_kcal`.
- `water_logs` — Wasser je Tag.
- `log_date` ist das lokale Kalenderdatum (wie `daily_logs`).

Rein additiv, idempotent, ohne `drop`. Trockenlauf: zweimal, RLS-Fälle
(fremdes Lebensmittel, fremder Nutzer, doppelter Barcode, Menge fehlt) abgewiesen.

## 6. Open Food Facts

- **Über die Edge Function `food-lookup`**, nicht direkt aus dem Browser:
  OFF verlangt einen eigenen User-Agent (Browser können ihn nicht setzen),
  die Funktion verschlankt die Antwort, cacht und verbirgt IP und Suchbegriffe
  der Nutzer. Nur angemeldete Nutzer (JWT).
- Rate Limits OFF: 15 Produktabrufe/min, 10 Suchen/min je IP; OFF rät von
  Suche-beim-Tippen ab → Markensuche nur auf ausdrückliches „Suchen", Cache in
  der Funktion.
- Ungültige Einträge (ohne Namen/Energie, unmögliche Werte) werden verworfen,
  kJ ohne kcal umgerechnet, Dubletten zusammengefasst.
- Lizenz ODbL: Namensnennung + Link auf der Seite. Einzelne Werte im privaten
  Protokoll eines Nutzers sind keine öffentlich verbreitete Datenbank;
  **vor einer öffentlichen Weitergabe von Lebensmitteldaten rechtlich prüfen**
  (Share-Alike).

## 6a. Barcode-Scanner — warum kein natives Plugin

ML Kit für Capacitor (`@capacitor-mlkit/barcode-scanning`) unterstützt auf iOS
nur CocoaPods; das iOS-Projekt nutzt Swift Package Manager. Statt das ganze
iOS-Projekt umzustellen: ein Weg für alle Plattformen — `getUserMedia` +
`BarcodeDetector`, sonst `barcode-detector`/`zxing-wasm` (exakt gepinnt, ein
Test wacht darüber). Die .wasm-Datei (~1,1 MB) liefern wir selbst aus, lädt erst
beim ersten Scan und steht nicht im Precache des Service Workers. Damit scannt
auch die iPhone-Web-App, was mit ML Kit nicht gegangen wäre.
Native Berechtigungen: `NSCameraUsageDescription` (iOS), `CAMERA` (Android).

## 6b. Grenzen von Open Food Facts

Alle Abrufe teilen sich die IP der Edge Function. Schutz: echte Sitzung
(`auth.getUser`), 30 Abrufe/min je Nutzer, Bremse bei 12 Produkt- bzw. 8
Suchabrufen/min außerhalb des Caches (Cache 24 h bzw. 1 h). Mit wachsender
Nutzerzahl reicht das nicht: dann den OFF-Datenexport (täglicher Dump) selbst
importieren und nur noch für unbekannte Barcodes live fragen.

## 7. BLS 4.0 (Etappe 1b)

Max Rubner-Institut, seit 16.12.2025 kostenlos unter CC BY 4.0, auch für Apps;
ca. 7.140 Lebensmittel. Namensnennung: „Max Rubner-Institut (2025):
Bundeslebensmittelschlüssel (BLS), Version 4.0". Offen: Dateiformat, englische
Bezeichnungen. Ablauf, sobald die Datei vorliegt: Generator
`scripts/generate-bls-sql.mjs` → `supabase-nutrition-bls.sql` (öffentlich
lesbare Tabelle `food_catalog`, Trigramm-Suche), wie `npm run catalog:sql`.
Der Code für Quelle `bls` (Rangfolge, Kennzeichnung) ist schon vorbereitet.

## 8. Ziele und Vorschlag

Mifflin-St Jeor × Aktivitätsfaktor; Abnehmen −15 %, Zunehmen +10 %; nie unter
1200 (w) / 1500 (m) kcal. Eiweiß 1,6 g/kg (Abnehmen) bzw. 1,4 g/kg auf ein
Referenzgewicht (höchstens Gewicht bei BMI 27), damit hohe Körpergewichte
keine unrealistischen Ziele ergeben. Fett 27 %, Rest Kohlenhydrate. Gewicht aus
`weight_logs` (neuester Wert), sonst Profil. Immer als Richtwert gekennzeichnet.

## 8a. Gerichte (Nachtrag 18.10.2026)

Eigene Gerichte aus mehreren Zutaten, eingetragen wie ein Lebensmittel in jede Mahlzeit.

- **Datenmodell:** Ein Gericht ist ein `food_items`-Eintrag (`source = 'custom'`)
  mit zwei neuen Spalten: `ingredients` (jsonb, Schnappschuss der Zutaten mit
  Menge und Werten je 100 g, 1–60 Stück) und `portions` (0,1–50). Werte je
  100 g = Summe der Zutaten / Gesamtgewicht; Portion = Gesamtgewicht / Portionen.
  Dadurch gehen Eintragen, Häufig, Suche, Stern und Schnappschuss ohne Sonderweg.
  ml zählen beim Gewicht wie g.
- **Eintragen:** ein Eintrag mit Gramm-Menge; die Eingabe erfolgt in Portionen
  (½ · 1 · 1½ · 2). Ändert sich das Gericht später, bleiben alte Einträge wahr.
- **Anlegen:** Tab „Gerichte" → „Neues Gericht" → Zutaten über die gewohnte
  Suche (Häufig, Meine, Marken, Barcode) → speichern → gleich eine Portion
  eintragen. Oder „Als Gericht" an einer Mahlzeit mit mindestens zwei Einträgen
  (Schnelleinträge fallen weg).
- **Bearbeiten/Löschen:** Stift am Gericht. Löschen lässt Einträge stehen
  (`on delete set null`). Tippen neben den Editor verwirft ein angefangenes
  Gericht nicht.
- Nicht drin: Gewicht nach dem Kochen, Zutaten als eigene Einträge aufklappen.

## 8b. Essen per Foto (Nachtrag 18.10.2026, Wunsch Nutzer: „wie Cal AI")

**Entscheidungen Nutzer:** Eine KI-Erkennung von Essen kann nie genau sein.
Die KI nennt deshalb **nur, was es sein kann** — keine Mengen, keine
Nährwerte. Bei Gerichten, die man nicht sieht (Beispiel Kürbissuppe), listet
sie die möglichen Zutaten samt Alternativen (Sahne *oder* Kokosmilch); der
Nutzer tippt an, was er wirklich genommen hat. Eine Notiz mit dem Namen des
Gerichts wird empfohlen, weil sie die Zutaten genauer macht.

Ablauf:
1. **Aufnahme:** Tipp „Schreib dazu, was es ist", Notizfeld (diktieren über das
   Mikrofon der Tastatur), Kamera / Aus Fotos / „Ohne Foto – nur aus der Beschreibung".
2. **Auswahl:** Titel = erkanntes Gericht. Passt ein **eigenes Gericht**, steht
   es ganz oben („mit deinen genauen Zutaten"). Ist das Foto schwer zu deuten
   (`needs_note`: Suppe, Eintopf, Auflauf, Smoothie …), Bitte um den Namen +
   „Mit Notiz neu erkennen" (dasselbe Foto). Zutaten in Gruppen: **Drin**
   (sicher/üblich, vorgewählt), **„Für die Cremigkeit – was hast du genommen?"**
   (Alternativen, nicht vorgewählt), **Vielleicht auch** (optional).
3. **Zuordnung:** je Zutat Lebensmittel und Menge über die gewohnte Suche
   (vorbelegt mit dem kurzen Suchbegriff der KI). Zurück zur Auswahl verliert
   nichts. Dann „n Positionen eintragen" oder **„Als Gericht"** (Gericht-Editor
   mit Name und Zutaten vorbelegt → Portionen → eine Portion eintragen; beim
   nächsten Mal kommt es als eigenes Gericht zuerst).

**Rezeptwissen:** Die möglichen Zutaten kommen aus dem Wissen des Modells
(deckt sehr viele Gerichte und Varianten ab). Die eigenen Gerichte des Nutzers
sind die genaue Schicht darüber und wachsen mit jeder Nutzung. Eine eigene
Rezeptdatenbank ist bewusst nicht gebaut: offene Rezeptsammlungen sind meist
nur nicht-kommerziell (z. B. RecipeNLG) oder Share-Alike lizenziert — vor einer
Übernahme rechtlich prüfen.

**Technik:** Edge Function `food-photo` → Anthropic Messages API (offizielles
SDK, `claude-haiku-5-5` mit `effort: low` — „so preiswert wie möglich",
Entscheidung Nutzer; kein Server-Fallback bei Ablehnung, dann „nicht erkannt"; structured outputs: `dish`, `needs_note`, je Zutat
`name`, `search`, `kind` visible/usual/alternative/optional, `group`;
Server-Fallback). Foto optional, dann ist die Notiz Pflicht. Antwort serverseitig
geprüft (Alternative allein in ihrer Gruppe → optional, höchstens 20 Zutaten).
Kosten grob: Bild ~1.500 Token + Antwort ~400 Token ≈ 0,04 Cent je Erkennung.

**Datenschutzerklärung** (`src/features/compliance/legal/texts.ts`, de/en)
ergänzt: Ernährungsdaten, Kamera (Barcode auf dem Gerät), Anthropic für die
Mahlzeiten-Erkennung, Open Food Facts ohne Personenbezug.

**Datenschutz:** eigene Einwilligung `profiles.ai_food_consent_at` (Fotos *und*
Notizen; Server stempelt; Widerruf im Profil). Foto und Notiz werden nicht
gespeichert. Notiz als eigener Block, ohne Steuerzeichen; Text im Bild gilt nie
als Anweisung. Keine In-App-Spracherkennung (die Web-Speech-API schickt Audio an
Google bzw. Apple) — Diktieren über die Tastatur ist Sache des Betriebssystems.

**Kosten/Limit:** 30 Erkennungen je Nutzer und 24 h (`food_photo_scans`, nur
Zeitpunkt; erst eintragen, dann zählen). Nur Namen als Antwort → wenige Tokens.

**Grenze:** Generische Zutaten finden ohne BLS oft nur Markenprodukte — der
BLS-Import (Etappe 1b) macht die Zuordnung erst rund.

## 9. Review-Befunde (behoben vor dem ersten Commit)

Tageswechsel zeigte kurz den alten Tag bearbeitbar an; Mengenänderung rechnete
über gerundete 100-g-Werte; „Korrigieren" an alten Einträgen konnte neuere
Werte überschreiben; Merken eines schon gespeicherten Produkts lief in den
Unique-Index; UPC-A fand die eigene Fassung nicht wieder; DB-Grenzen enger als
die App; Edge Function nur mit öffentlichem Schlüssel geschützt; Profil-Logik
doppelt (jetzt `parseBioProfile`/`alterAm` aus Blutwerte); „Häufig" zählte
bearbeitete Einträge mehrfach; Stern setzte die getippte Menge zurück.

## 10. Offene Punkte

- BLS-Datei beschaffen (blsdb.de/download), Format prüfen → Etappe 1b
- Gerätetest Scanner (iOS/Android); Kamera-Texte in Info.plist
- heise-Test (6 Apps, Datenschutz) lesen
- Etappe 2: Kalorien/Eiweiß im Fortschritt-Chart neben Gewicht; GLP-1-Hinweise aus dem Stack; PDF-Protokoll
