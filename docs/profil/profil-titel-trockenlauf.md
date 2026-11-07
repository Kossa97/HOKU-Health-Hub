# Trockenlauf `supabase-profil-titel.sql`

Stand 06.11.2026. Postgres 16 im Container (`/var/tmp/titel`, als `postgres`), zwei frische Cluster
(`voll.sh data1`, `voll.sh data2`), beide Ausgaben gleich. **Nicht gegen Produktion gelaufen.**
Produktivlauf nur nach ausdrücklichem Ja, Reihenfolge 2a → 2b → 2c → Titel, jeweils direkt vor dem Merge.

## Aufbau

1. Basis, P1, Ist-Stand nach P1 und die Meldungen wie im Trockenlauf 2c (`docs/profil/profil-p2c-trockenlauf.md`).
2. 2a, 2b, Einstellungen nach dem App-Update (wie in 2c), dann 2c.
3. Stand nach 2c, wie die App ihn vor dem Titel-Update schreibt: drei Zeilen `progress_settings` mit
   verdienten Abzeichen (nur IDs aus 2b), eine Web-Abweichung (`web_badges`).
4. `profile_view` aller Profile festgehalten: anon, angemeldet fremd (cleo), Eigentümer in allen vier
   Sichten (57 Ausgaben).
5. `supabase-profil-titel.sql` zweimal, je mit Zählung; die 57 Ausgaben erneut; Proben T1–T17; ein dritter Lauf.

## Zählungen (nur Zahlen)

| | vor Titel | Lauf 1 | Lauf 2 | Lauf 3 (nach Proben) |
|---|---|---|---|---|
| Profile | 9 | 9 | 9 | 9 |
| Schnappschüsse | 8 | 8 | 8 | 8 |
| `progress_settings` | 3 | 3 | 3 | 4 (Probe T17) |
| Sichtbarkeit gesetzt | 8 | 8 | 8 | 8 |
| Web-Link an | 7 | 7 | 7 | 7 |
| `web_badges` gesetzt | 1 | 1 | 1 | 1 |
| Spalten `title_choice`, `personal_titles`, `title_consents` | 0 | 3 | 3 | 3 |
| Prüfungen `profiles_title_choice_check`, `profiles_title_consents_check` | 0 | 2 | 2 | 2 |
| neue Funktionen (5 Namen) | 0 | 5 | 5 | 5 |
| Abzeichen-IDs / Felder / Web-Felder | 39 / 32 / 8 | 81 / 33 / 9 | 81 / 33 / 9 | 81 / 33 / 9 |
| heikel / Grenzfall | 10 / 8 | 12 / 10 | 12 / 10 | 12 / 10 |
| ungültige `earned_badges` / Sichtbarkeit / `web_badges` | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Titel gesetzt (Wahl, Schalter oder Einwilligung) | – | 0 | 0 | 1 (Proben) |

Lauf 2 und 3 melden nur „column … already exists, skipping“ (drei Spalten). „Titel gesetzt“ vor dem
Lauf: Spalte gibt es noch nicht (erwarteter Fehler in der Zählung).

**Vorher/nachher `profile_view`:** 48 von 57 Ausgaben gleich. Die übrigen 9 sind die Eigentümer-Sicht
`owner` je Profil; dort kommen nur `personal_titles: false` und `title_consents: {}` dazu. Kein
Titel für irgendwen, solange die App keine Ränge geschrieben hat und `title` auf „Nur ich“ steht.

## Proben

- **T1/T2** Ränge und neue Abzeichen lassen sich in `earned_badges` speichern; alle 81 IDs auf einmal passen (8192 Byte).
- **T3** Titel-Feld Standard „Nur ich“: Fremde sehen keinen Titel, der Eigentümer `rank_3`, „Ansehen als Alle“ keinen.
- **T4** Titel auf „Alle“: cleo und anon (Web-Link an) sehen `rank_3` (höchster verdienter Rang).
- **T5** Titel auf „Freunde“: cleo (keine Freundin) und anon sehen nichts.
- **T6** Leiter: Wahl `run_10`, verdient `run_10` + `run_50` → `run_50`.
- **T7** Wahl nicht verdient (`streak_365`) → Rang. **T8** Wahl verdient ohne Leiter (`streak_100`) → `streak_100`.
- **T9** Persönlich `body_fat_5`: ohne Schalter → Rang; Schalter ohne Einwilligung → Rang.
- **T10** Mit Einwilligung, `body_fat` auf „Alle“: cleo sieht `body_fat_5`; anon (Web) ohne Web-Freigabe des heiklen
  Abzeichens → Rang. **T10b** Mit Web-Freigabe von `body_fat_5` sieht anon `body_fat_5` (wie gekennzeichnet).
- **T11** Deckel durch das Quellfeld: `body_fat` auf „Freunde“ → cleo und „Ansehen als Alle“ sehen den Rang,
  „Ansehen als Freunde“ und die eigene Sicht `body_fat_5`; anon sieht trotz Web-Freigabe den Rang.
- **T12** `title_choice`, `personal_titles`, `title_consents` nur in der Eigentümer-Sicht.
- **T13** Ein `title` im Schnappschuss wird nie übernommen (eigene Sicht und anon).
- **T14** Genau 6 erwartete Fehler: Rang bzw. Unbekanntes als Wahl, Einwilligung für Nicht-Persönliches,
  kaputtes Datum, Liste statt Objekt, Stufe `public` für `title`.
- **T15** RLS: Mara schreibt ihre eigene Wahl; cleo kann Gustavs nicht ändern (0 Zeilen).
- **T16** Gustav ohne Ränge und ohne Titel-Freigabe: kein Titel. **T17** Privat sperrt den Titel für andere.
- **T18** Web-Freigabe gilt auch für den Titel: „Schlafbeobachter“ (Grenzfall, ab Werk aus) → anon sieht den
  Rang, cleo den Titel; nach Freigabe in `web_badges` auch anon. **T19** `steps_weeks_12` ist Grenzfall (10 Grenzfälle).

## Vertrauen

Verdiente Abzeichen und Ränge rechnet das Gerät (wie in 2b); der Server prüft nur bekannte IDs und
gültige Tage. Ein manipuliertes Gerät könnte sich also einen Rang „verdienen“ — wie jedes Abzeichen
aus 2b. Gesundheitsdaten verrät das nicht: persönliche Titel brauchen Schalter, Einwilligung und ein
sichtbares Quellfeld, im Web dazu das Quellfeld auf „Alle“ und die Web-Freigabe des Abzeichens
(heikle ab Werk aus).
