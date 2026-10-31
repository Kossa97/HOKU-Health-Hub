# Health Connect: Angaben für die Play Console

Texte für die Erklärung zu Gesundheitsdaten in der Google Play Console
(App-Inhalte → Health Connect / Gesundheits-Apps). Stand: Oktober 2026,
passend zu `android/app/src/main/AndroidManifest.xml` und
`ANDROID_READ_PERMISSIONS` in `src/lib/health.ts`.

Die App **liest nur**. Sie schreibt nichts nach Health Connect und fragt keine
`WRITE_*`-Berechtigung an.

Datenschutzerklärung: `https://<Domain>/datenschutz#gesundheitsdaten`
(Abschnitt 4 „Apple Health und Health Connect“). Dieselbe Seite öffnet die App,
wenn jemand im Health-Connect-Dialog oder in den Android-Einstellungen auf
den Datenschutz-Hinweis tippt.

## Gemeinsame Angaben (für alle Typen)

**Deutsch**

- Zweck: Die Werte werden in der App neben den eigenen Einträgen angezeigt
  (Seite „Gesundheit“), als Tageswerte für den eigenen Verlauf.
- Speicherung: Nur wenn die Person dem in der App gesondert zustimmt, speichert
  die App je Tag einen Wert im Konto der Person (Supabase, EU) — keine einzelnen
  Messungen; betrifft Schritte, Ruhepuls, aktive Kalorien, SpO2, Atemfrequenz
  und Blutdruck. Ohne diese Zustimmung bleiben die Werte auf dem Gerät.
- Sichtbarkeit: Nur die Person selbst sieht die Werte. Später kann sie einzelne
  Werte in ihrem Profil zeigen, aber nur, wenn sie das selbst auswählt.
- Keine Werbung, kein Marketing, kein Verkauf, keine Weitergabe an Dritte.
- Widerruf jederzeit in der App (Profil) oder in Health Connect; gespeicherte
  Tageswerte lassen sich im Profil löschen.

**English**

- Purpose: the values are shown in the app next to the user's own entries
  (the "Health" page), as daily values for the user's own history.
- Storage: only if the user agrees to it separately in the app, one value per
  day is stored in the user's account (Supabase, EU) — no individual
  measurements; this covers steps, resting heart rate, active calories, SpO2,
  respiratory rate and blood pressure. Without that consent the values stay on the device.
- Visibility: only the user can see the values. Later they can show selected
  values in their profile, but only if they choose to.
- No advertising, no marketing, no selling, no sharing with third parties.
- Consent can be withdrawn at any time in the app (profile) or in Health
  Connect; stored daily values can be deleted in the profile.

## Zweck je Datentyp / Purpose per data type

| Berechtigung | Deutsch | English |
|---|---|---|
| `READ_STEPS` | Schritte pro Tag für den eigenen Aktivitätsverlauf. | Steps per day for the user's own activity history. |
| `READ_HEART_RATE` | Herzfrequenz der letzten 24 Stunden, nur zur Anzeige auf der Seite „Gesundheit“; wird nicht im Konto gespeichert. | Heart rate of the last 24 hours, shown on the "Health" page only; not stored in the account. |
| `READ_RESTING_HEART_RATE` | Ruhepuls pro Tag für den eigenen Verlauf. | Resting heart rate per day for the user's own history. |
| `READ_WEIGHT` | Gewicht, um es neben den eigenen Einträgen anzuzeigen; wird nicht als Tageswert gespeichert. | Weight, to show it next to the user's own entries; not stored as a daily value. |
| `READ_ACTIVE_CALORIES_BURNED` | Aktive Kalorien pro Tag für den eigenen Aktivitätsverlauf. | Active calories per day for the user's own activity history. |
| `READ_OXYGEN_SATURATION` | Sauerstoffsättigung (SpO2) als Tageswert für den eigenen Verlauf. | Oxygen saturation (SpO2) as a daily value for the user's own history. |
| `READ_RESPIRATORY_RATE` | Atemfrequenz als Tageswert für den eigenen Verlauf. | Respiratory rate as a daily value for the user's own history. |
| `READ_BLOOD_PRESSURE` | Blutdruck (systolisch/diastolisch) als Tageswert für den eigenen Verlauf. | Blood pressure (systolic/diastolic) as a daily value for the user's own history. |

## Hinweise für die Einreichung

- Nicht angefragt: Training/Workouts (`READ_EXERCISE`) — `capacitor-health-connect`
  0.7 kann diese Einträge nicht lesen. Schlaf kommt auf Android derzeit nicht
  aus Health Connect.
- Offen vor dem Einreichen: `READ_WEIGHT` wird angefragt, aber `getWeight`
  in `src/lib/health.ts` hat derzeit keinen Aufrufer in der App. Google prüft,
  ob jede Berechtigung genutzt wird — entweder das Gewicht anzeigen oder die
  Berechtigung streichen.
- Kommt ein Typ dazu, muss er an drei Stellen gleich stehen: Manifest,
  `ANDROID_READ_PERMISSIONS` und diese Liste (plus Datenschutzerklärung).
- Vor dem Store-Start steht ein Test auf echter Hardware aus.
