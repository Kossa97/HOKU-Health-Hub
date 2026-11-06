# Apple Health im iOS-Build

Stand 06.11.2026.

## Befund

- Das iOS-Projekt nutzt Capacitor 8 mit Swift Package Manager (`ios/App/CapApp-SPM`),
  kein Podfile.
- `@perfood/capacitor-healthkit@1.3.2` bringt nur eine Podspec mit, keine
  `Package.swift`. `npx cap sync` hat es deshalb übersprungen
  („does not have a Package.swift"). Im iOS-Build fehlte das Plugin.
- Folge auf dem iPhone: `CapacitorHealthkit` war nicht registriert, jeder Aufruf
  aus `src/lib/health.ts` endete mit „not implemented on ios".
  `requestPermissions()` meldete „nicht verfügbar"; Training, Schlaf, Ruhepuls,
  Workouts und aktive Energie kamen nie an.
- Zusätzlich fehlte das Entitlement `com.apple.developer.healthkit`. Auch mit
  Plugin hätte HealthKit die Anfrage abgelehnt.

## Gewählte Lösung (Option B: SPM-Hülle um die Plugin-Quellen)

| Option | Aufwand | Warum nicht / warum |
|---|---|---|
| A: anderes Plugin mit SPM | `health.ts` neu schreiben (andere API, Workouts, Schlafphasen) | größte Änderung, neues Verhalten |
| B: SPM-Hülle | 2 kleine Dateien + `postinstall` | **gewählt**: gleicher Plugin-Code, `cap sync` nimmt es selbst auf |
| C: CocoaPods | Podfile, Workspace, Projekt umbauen | Rückschritt, CocoaPods läuft aus |

- `ios/spm-plugins/capacitor-healthkit/Package.swift`: Paket `PerfoodCapacitorHealthkit`
  (den Namen leitet die Capacitor-CLI aus dem npm-Namen ab), Target auf
  `ios/Plugin`, `.m`/`.h` ausgeschlossen (SPM mischt kein Swift mit Objective-C).
- `scripts/capacitor-healthkit-spm.mjs` (läuft als `postinstall`): kopiert die
  `Package.swift` ins Plugin und erzeugt aus dem `CAP_PLUGIN`-Block der `.m`
  die `CAPBridgedPlugin`-Erweiterung, die Capacitor 8 zum Registrieren braucht.
- `npx cap sync ios` nimmt das Plugin jetzt in `CapApp-SPM/Package.swift` auf,
  die Warnung ist weg. `packageClassList` enthält `CapacitorHealthkitPlugin`.
- `App.entitlements`: `com.apple.developer.healthkit` + leeres `…healthkit.access`.
- Berechtigungstext (`NSHealthShareUsageDescription`, de/en) nennt jetzt auch
  Ruhepuls, Workouts und aktive Energie.

## Prüfen auf dem Mac (steht aus)

```bash
npm install
```

```bash
npm run build
```

```bash
npm run ios:sync
```

(`ios:sync` legt die Hülle auch dann an, wenn `npm install` ohne Skripte lief, und startet dann `cap sync ios`.)

```bash
npx cap open ios
```

1. Xcode: *File → Packages → Reset Package Caches*, dann bauen. Erwartet: das
   Paket `PerfoodCapacitorHealthkit` erscheint unter *Package Dependencies*.
2. *Signing & Capabilities*: HealthKit muss erscheinen (aus dem Entitlement).
   Bei automatischer Signierung trägt Xcode die Capability in die App-ID ein.
3. Auf dem iPhone (nicht im Simulator ohne Health-Daten): Training →
   Einstellungen → „Apple Health / Health Connect" → „Daten von der Uhr
   übernehmen" einschalten. Erwartet: Apple-Health-Dialog mit
   Gewicht, Schritten, Schlaf/Workouts, aktiver Energie, Puls, Ruhepuls.
4. Xcode-Konsole: kein „not implemented on ios", kein „Missing
   com.apple.developer.healthkit entitlement".

Wird `@perfood/capacitor-healthkit` aktualisiert, erzeugt das Skript die
Erweiterung neu; `scripts/capacitor-healthkit-spm.test.ts` prüft, dass jede in
`health.ts` benutzte Methode registriert ist.
