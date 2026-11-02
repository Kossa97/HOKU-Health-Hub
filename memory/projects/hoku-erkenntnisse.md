# Hoku-Erkenntnisse (Hintergrundanalyse)

Design: `docs/superpowers/specs/2026-11-02-hoku-erkenntnisse-design.md` (Entwurf 02.11.2026).

## Entschieden (Nutzer 02.11.2026)
- Feste Engine (Detektoren + Statistik) findet Muster; KI formuliert nur und beantwortet
  Rückfragen; Regelwächter prüft jeden Text.
- Keine anwaltliche Prüfung (Kosten) → KI-Einstufungsbegründung aus Primärquellen,
  **Stufe 1 zuerst**; Blutwert-Kontext, eigener Zielbereich, Kombinationen aus Studien,
  Blutdruck = Stufe 2.
- Alle S1/S1v-Funde plus belohnende Richtung; Substanzen ja, aber als Protokoll
  (beide Richtungen, gleichzeitige Änderungen, eigene Zufriedenheit, Selbstversuch),
  nie „X wirkt".
- Wochen-Update + Push bei Signifikantem; nativer Push (APNs/FCM) gehört dazu.
- Bezahl-Feature, keine Free-Version.
- Vom Nutzer an eine Substanz gehängte Tagebuch-Einträge: eigene Zuordnung („von dir
  verknüpft") getrennt von S4 („zeitlich gehäuft"); nie Ursache bestätigen; Nebenwirkungen
  nie ausblenden; fester Sicherheitshinweis (Arzt / 112) bei bestimmten Chips, ausgelöst
  durch die Auswahl, nicht durch Analyse. Offen: Chip-Liste, BfArM-Meldeweg für
  Stoffe ohne Zulassung.

## Mockup v1 (02.11.2026)
https://claude.ai/artifact/NX5KTV23zHGFofRLz12dZY — Design-Canvas, Look Soft Dark, sechs
Screens: Home mit Update-Karte, Wochen-Update, Fund im Detail (Beleg mit Einzeltagen),
Substanz-Bilanz (Zufriedenheit klickbar), Funde im Feature (Training, Blutabnahme),
Push und Einwilligung.

## Offen
- Rückmeldung des Nutzers zu Mockup v1.
- Gestaltung des Uhrzeit-Felds bei Getränken (Mockup vor UI).
- Schlafphasen (HS) warten auf Profil P1, Schritt 1b (Plugin-Wechsel).

## Katalog-Erweiterung (02.11.2026)
Abhak-Liste https://claude.ai/artifact/U4kzrmarXzaSag9D4AhjzQ: Nutzer hat **alle 53**
gewählt → im Design als V, VB, SW, WA, K, E5–E8, RY, G, C, S7–S12, H8–H10, L. Eigene
Ideen des Nutzers: Kraftverlauf (R6–R7), Koffein aus dem Ernährungstracker (KO1–KO5,
Anzahl Getränke statt mg, keine Schwellen), Schlafphasen (HS1–HS5).
Getränke bekommen eine **optionale Uhrzeit** (Nutzer: ja) → `food_logs.consumed_time`,
für heute mit „jetzt" vorbelegt; neue Funde KO6–KO8 (feste Uhrzeit-Gruppen, nie „spät"). Gleichförmige
Funde als Katalogdatei + allgemeine Vergleichsfunktion.

## Bauplan (02.11.2026)
Design vom Nutzer freigegeben. Aufgeteilt in Teile 1–7 + R (Recht/Datenschutz, vor
Freischaltung für Nutzer). Plan Teil 1: `docs/superpowers/plans/2026-11-02-hoku-erkenntnisse-teil1.md`
(Kern unter `supabase/functions/_shared/erkenntnisse/`, Edge Function `erkenntnisse`,
Vercel-Cron stößt nur an, Seite `/erkenntnisse` nur für Tester bis Teil R).
Offen: Ausführungsweise für Teil 1.
