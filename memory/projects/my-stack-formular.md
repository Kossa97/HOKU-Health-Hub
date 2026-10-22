# My Stack: Formular „Substanz hinzufügen" (v2)

Mockup mit dem Nutzer abgestimmt (Oktober 2026):
https://claude.ai/artifact/Rsk8kmpGcyxdryt1594NBJ

## Entscheidungen

- **4 Schritte:** Substanz → Zusammensetzung → Einnahme → Überblick.
- **Substanz:** Suche; ist die Substanz im Katalog gefunden, erscheint ein
  kleines Karussell nur mit den passenden Darreichungsformen. Sobald eine Form
  gewählt ist, erscheint darunter die Farbe (12 iOS-Systemfarben + „Eigene
  Farbe"). Kein eigener Form- oder Farbschritt mehr.
- **Tracking-Tiefe** wird nicht mehr gefragt. Wer die Stärke einträgt, trackt
  gründlich; wer sie überspringt, einfach.
- **Zusammensetzung:** Stärke wie auf dem Etikett + Haltbarkeit.
  Wortwahl je Form:
  | Form | Datumsfeld | Haltbarkeit |
  |---|---|---|
  | Vial, fertige Lösung | Angebrochen am | Haltbar nach Anbruch |
  | Vial, Pulver | Angemischt am | Haltbar nach Anmischen |
  | Pen | In Benutzung seit | Haltbar nach erster Benutzung |
  | Tropfen, Nasenspray, Spray, Gel, Tube, Pulver (Dose) | Geöffnet am | Haltbar nach Öffnen |
  | Ampulle, Kapsel, Tablette, Pflaster | – | nur Ablaufdatum |
  Ablaufdatum der Packung ist überall optional.
- **Einnahme:** Menge prominent mit Umrechnung (ml/Stück); mehrere Einnahmen
  am Tag mit eigener Tageszeit, Menge, optionaler Uhrzeit; bei Wochentagen je
  Tag eigene Liste.
- **Überblick:** alle Angaben antippbar, Bestand als Schalter.

## Scan (umgesetzt, Oktober 2026)

- Name und Wirkstoffe gemeinsam abgleichen, der genauere Treffer gewinnt
  (Fehler: „Testosteron" statt „Testosteron Enantat").
- Mehrere Kandidaten einer Familie, Etikett nennt den Ester nicht → Auswahl.
- Mehrere Wirkstoffe → je eine Zeile, mit Katalog verknüpft, wo möglich.
- Barcode Protein/Supplements: Open Food Facts mit Nährwerten (Protein je Portion).
- Medikamente: Data-Matrix (PZN, Charge, Verfall) lesen + Etikettfoto. Keine
  kostenpflichtige PZN-Datenbank (ABDA) — Entscheidung des Nutzers.

Umsetzung: `lib/substanzScan.ts` (Abgleich, Familie, Zeilen, Eiweiß),
`lib/packungscode.ts` (IFA- und GS1-Data-Matrix), Auswahl im Ergebnis
(`SubstanzScanner.tsx`). Eiweiß braucht die neue `food-lookup`-Version
(Edge Function deployen); ohne sie bleibt die Stärke leer.
