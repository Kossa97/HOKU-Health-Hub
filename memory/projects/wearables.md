# Wearables

Überblick und Testen: `docs/wearables/README.md`.

## Entschieden (Nutzer, 5.11.2026)

- Kein Gerät einzeln anbinden: nur Apple Health und Health Connect.
  Direkte Hersteller-APIs oder Aggregator frühestens später.
- Gebaut ohne Mac und ohne Android-Gerät: Testdaten-Modus
  (`src/lib/healthDemo.ts`, `?healthDemo=…`), Unit- und E2E-Tests,
  Android-Manifest, iOS-Entitlement und Hinweistexte, Datenschutz-Abschnitt 4
  (Entwurf), Texte für die Play Console.
- Keine Anmeldeseite für die Testgruppe.

## Offen

| Punkt | Stand |
|---|---|
| Plugin-Wechsel | Kandidat `@capgo/capacitor-health` (`docs/wearables/plugin-vergleich.md`). Nutzer fragt nach Alternativen, noch nicht entschieden. Erst mit Testgeräten. |
| Gewicht lesen | `getWeight()` wird nirgends angezeigt, die Berechtigung aber angefragt (iOS und Android). Einbauen oder streichen. |
| HealthKit-Schlaf | `@perfood` meldet jede Nicht-InBed-Phase als „Asleep“, auch Wachphasen. |
| Nicht gebaut | weder iOS (kein Xcode) noch Android (kein SDK im Container). Capability „HealthKit“ in Xcode setzen. |
| Datenschutz | Abschnitt 4 ist ein Entwurf, der Nutzer muss ihn gegenlesen |
