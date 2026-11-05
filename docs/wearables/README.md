# Wearables in HOKU

HOKU bindet keine Geräte einzeln an. Uhr, Ring und Waage schreiben über die
App ihres Herstellers in **Apple Health** (iOS) bzw. **Health Connect**
(Android), HOKU liest nur dort.

```
Uhr/Ring/Waage → Hersteller-App → Apple Health / Health Connect → Plugin → src/lib/health.ts → Training, Ernährung, /health
```

- `src/lib/health.ts` bringt beide Plattformen auf eine Form (Gewicht, Schritte,
  Schlaf, Puls, Ruhepuls, Workouts, aktive Energie).
- Übernommene Workouts landen in `training_sessions` (Einstellung im Training,
  „Daten von der Uhr übernehmen“). Alles andere wird nur auf dem Gerät gelesen.

## Testen ohne Gerät

| Wie | Wann |
|---|---|
| `?healthDemo=normal` an die URL hängen (`leer`, `luecken`, `extrem`, `android`; aus mit `?healthDemo=aus`) | im Browser mit `npm run dev`; Daten aus `src/lib/healthDemo.ts` |
| `npm test` (`src/lib/health.test.ts`, `healthDemo.test.ts`) | Umrechnung, Plattformen, Manifest-Abgleich |
| `npx playwright test e2e/health-demo.spec.ts` | `/health` und Trainings-Import mit Testdaten |
| iOS-Simulator: Health-App, Werte von Hand eintragen | sobald Xcode da ist |
| Android-Emulator (API 34+) mit „Health Connect Toolbox“ | Testdaten einspielen, Android Studio nötig |
| Testgruppe über TestFlight / internen Play-Test | Eigenheiten einzelner Hersteller |

Im Produktions-Build fehlt der Testdaten-Code ganz (Schalter in `health.ts`,
`import.meta.env.DEV || VITE_HEALTH_DEMO === '1'`).

## Stand (5.11.2026)

| Bereich | iOS | Android |
|---|---|---|
| Berechtigungen | Entitlement drin; in Xcode Capability „HealthKit“ setzen | Manifest drin (Gewicht, Schritte, Puls, Ruhepuls) + Datenschutz-Verweis |
| Gewicht, Schritte, Puls, Ruhepuls | ja | ja |
| Schlaf | ja, aber ohne Phasen; das Plugin meldet Wachphasen als „Asleep“ | nein (Plugin) |
| Workouts, aktive Energie | ja | nein (Plugin) |
| HRV | nein (Plugin) | nein (Plugin) |
| gebaut und auf Gerät getestet | **nein** | **nein** (kein SDK im Container) |

Weiter: [Plugin-Vergleich](plugin-vergleich.md) · [Play Console](play-console.md)
