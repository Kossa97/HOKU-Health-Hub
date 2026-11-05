# Plugin-Vergleich (Recherche 5.11.2026)

Heute im Einsatz: `@perfood/capacitor-healthkit` 1.3.2 (02/2025, für Capacitor 4)
und `capacitor-health-connect` 0.7 (08/2024, für Capacitor 5). Beide sind
veraltet; Android liest weder Schlaf noch Workouts noch aktive Energie, keins
liefert HRV.

| Plugin | Capacitor 8 | Pflege | Ruhepuls | HRV | Schlaf mit Phasen | Workouts | Lizenz |
|---|---|---|---|---|---|---|---|
| **@capgo/capacitor-health** | ja | Firma Capgo, Release 2.11.2026 | ja | ja | ja | Typ, Dauer, kcal, Strecke; Puls separat holen | MPL-2.0 |
| capacitor-health (mley) | ja | 1 Maintainer | nein | nein | nein | ja, mit Puls und Route | MIT |
| @flomentumsolutions/…-extended | 0.9.2 ja, neuere verlangen Cap 9 Beta | sehr klein | ja | ja | unklar | ja | MIT |
| cordova-plugin-health | über Cordova-Kompatibilität | ältestes, aktiv | ja | iOS ja, Android unklar | ja | ja | MIT |
| sahha-capacitor | ja | Firma | ja | ja | ja | ja | proprietär, Daten über Sahha-Cloud |
| eigene Brücke (Swift/Kotlin) | ja | wir | alles | alles | alles | alles | eigen |

Unsicher (nur README/Registry geprüft, nicht auf Geräten): die genauen Felder
von Capgo bei Android-Schlaf, HRV und Workouts.

**Für alle gilt:** iOS liefert HRV als SDNN, Android als RMSSD. Die Werte sind
nicht vergleichbar und gehören in der Oberfläche getrennt beschriftet. Health
Connect gibt ohne `READ_HEALTH_DATA_HISTORY` nur etwa 30 Tage heraus.

## Was andere Apps machen

- **Athlytic:** nur HealthKit.
- **Yazio, Lifesum, MyFitnessPal, Hevy:** Apple Health und Health Connect.
- **Bevel, Welltory, Cronometer:** Apple Health und Health Connect, dazu direkte
  APIs der Hersteller (Garmin, Oura, WHOOP, Polar …), vor allem wegen HRV.
- **Strava:** Garmin direkt, dazu Apple Health (Beleg nur aus Foren).

Keine dieser Apps setzt nachweislich einen Aggregator (Terra, Thryve, Rook)
ein.

## Empfehlung

1. **v1:** beide Plugins durch `@capgo/capacitor-health` ersetzen, eine API für
   beide Plattformen. Erst, wenn ein iPhone/Mac und ein Android-Gerät zum
   Testen da sind. Fehlt danach etwas, eine kleine eigene Swift- oder
   Kotlin-Ergänzung schreiben statt ein zweites Plugin.
2. **Später:** direkte APIs von Oura und WHOOP (eigener Server, EU), danach
   Garmin (Antrag als Firma, war 2026 zeitweise pausiert).
3. **Aggregator** erst ab mehreren Herstellern. Wegen DSGVO dann am ehesten
   Thryve (Berlin, Hosting in DE). Er wäre ein weiterer Auftragsverarbeiter für
   Gesundheitsdaten.

Quellen: npm-Registry und GitHub der Plugins; Hilfeseiten von Bevel, Athlytic,
Welltory, Cronometer, MyFitnessPal, Yazio, Lifesum und Hevy; Garmin Developer
Program FAQ.
