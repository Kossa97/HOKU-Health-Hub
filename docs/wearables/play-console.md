# Play Console: Gesundheitsdaten

Zum Einfügen in der Play Console. Englisch, weil Google auf Englisch prüft.
Stimmt nur so lange, wie Manifest und `src/lib/health.ts` dieselben Arten
lesen. Kommen mit dem neuen Plugin Schlaf, Workouts, aktive Energie oder HRV
dazu, müssen sie hier, im Manifest und in der Datenschutzerklärung nachgetragen
werden.

## 1. App-Inhalte → Health apps

Kategorie: **Fitness / Activity tracking** (zusätzlich ggf. *Nutrition*,
*Medication tracking*, je nach den übrigen Funktionen der App).

## 2. App-Inhalte → Health Connect

Datenschutz-URL: `https://hokuhealth.app/datenschutz`

Lesen, nicht schreiben. Je Art eine Begründung:

| Permission | Begründung (zum Einfügen) |
|---|---|
| READ_WEIGHT | Shows the user's current weight next to the weight log they keep in the app. **Offen:** `getWeight()` wird derzeit nirgends angezeigt. Vor dem Einreichen entweder auf `/health` einbauen oder die Berechtigung streichen (Manifest, `health.ts`), sonst kann Google ablehnen. |
| READ_STEPS | Shows today's step count on the Health screen. |
| READ_HEART_RATE | Shows the user's latest heart rate on the Health screen. |
| READ_RESTING_HEART_RATE | Used for the daily readiness indicator in the training log, which compares today's resting heart rate with the user's own recent average. |

Kurzbeschreibung der Funktion:

> HOKU is a personal health log. With the user's permission it reads weight,
> steps, heart rate and resting heart rate from Health Connect to show them next
> to the user's own entries and to estimate daily training readiness. Data from
> watches, rings and scales arrives through Health Connect; HOKU does not connect
> to devices directly. HOKU does not write to Health Connect. Health Connect data
> is not used for advertising, not sold and not shared with third parties.

Video-Nachweis (verlangt Google oft): Bildschirmaufnahme vom Android-Emulator
mit Health Connect Toolbox: Erlaubnis erteilen → Werte erscheinen auf `/health`.
Das geht erst mit einem gebauten APK.

## 3. App-Inhalte → Datensicherheit (nur der Gesundheitsteil)

| Frage | Antwort |
|---|---|
| Health info / Fitness info: collected? | Unter Android **derzeit nein**: Schritte, Puls und Ruhepuls werden nur auf dem Gerät gelesen, Workouts kann das Plugin dort nicht lesen. Sobald Workouts übernommen werden (neues Plugin), **ja** für Fitness info (im Konto gespeichert, dazu ergänzte kcal/Puls an eigenen Einheiten). |
| Shared with third parties? | Nein |
| Optional? | Ja, nur nach Erlaubnis |
| Purpose | App functionality |
| Encrypted in transit | Ja |
| Users can request deletion | Ja (Konto löschen; einzelne Einheiten in der App löschen) |

Den Rest des Formulars (Konto, Ernährung, Blutwerte usw.) nicht von hier
übernehmen, das hängt an den übrigen Funktionen.
