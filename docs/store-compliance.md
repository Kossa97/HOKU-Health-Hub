# Store-Checkliste: App Store Connect und Google Play Console

Stand: 05.10.2026. Was die App jetzt selbst erfüllt, steht unter **In der App erledigt**.
Alles darunter musst du in den Konsolen eintragen oder selbst entscheiden.

## In der App erledigt

| Richtlinie | Umsetzung |
|---|---|
| Apple 1.2 / Google UGC: Bedingungen vor dem Teilen | Registrierung mit Pflicht-Häkchen; Bestandskonten sehen einmal die Zustimmungsseite (`ConsentGate`) |
| Apple 1.2 / Google UGC: Filter | Trigger auf Erfahrungen (inkl. Substanzname) und öffentlichen Profilen: keine Links, kein Handel, keine Beleidigungen |
| Apple 1.2 / Google UGC: Melden | Erfahrung und Profil melden (angemeldet, max. 20/Stunde) |
| Apple 1.2 / Google UGC: Blockieren | Profil blockieren, im eigenen Profil wieder freigeben |
| Apple 1.2: Reaktion auf Meldungen | Admin-Panel → Meldungen: ausblenden oder ablehnen. **Zusage in den Bedingungen: 24 Stunden** |
| Apple 1.4.1 / Google Health: kein Medizinprodukt | Hinweis an Registrierung, Rechner, Simulation, Profil; „Nur für Forschungszwecke" in de/en ersetzt |
| Apple 1.4.3 / Google „Unapproved substances" | Kein Handel, keine Bezugsquellen in öffentlichen Texten; Bedingungen verbieten es |
| Apple 5.1.1(v) / Google „Account deletion" | Profil → Konto löschen (sobald `supabase-store-compliance-sql-editor.sql` ausgeführt ist) |
| Apple 5.1.1 / Google User Data: Datenschutzerklärung | `/datenschutz`, `/impressum`, `/nutzungsbedingungen`, ohne Anmeldung erreichbar |
| Alter 18+ | Pflicht-Häkchen bei der Registrierung |
| Apple 5.1.2(i): Daten an Drittanbieter-KI nur mit Zustimmung | Befund-Import fragt vorher ausdrücklich (Anthropic, USA); gespeichert in `profiles.ai_import_consent_at`, Widerruf im Profil; die Edge Function `bloodwork-extract` sendet ohne Einwilligung nichts. Ebenso die Mahlzeiten-Erkennung („Essen fotografieren"): eigene Einwilligung `profiles.ai_food_consent_at`, Edge Function `food-photo` |
| Apple 2.3.1: keine versteckten Funktionen | Vorschau-Routen nur noch in der Entwicklung |

## Vor dem Einreichen — von dir

### Supabase
- [ ] `supabase-store-compliance-sql-editor.sql` im SQL-Editor ausführen (Konto löschen + Wortliste).
- [ ] Storage-Policy „Batch read" auf `batch-files` auf eigene Dateien beschränken.
- [ ] Prüfen, ob das eine Admin-Konto deins ist.

### Rechtstexte
- [ ] Alle gelb markierten Platzhalter in `src/features/compliance/legal/texts.ts` füllen (Name, Anschrift, E-Mail, Aufsichtsbehörde, Vercel-Region, Sentry-Aufbewahrung, AV-Verträge, Anthropic: Aufbewahrung und Übermittlungsgrundlage).
- [ ] Haftungsklausel und Gerichtsstand rechtlich prüfen lassen.
- [ ] Solange Platzhalter drin sind, zeigt jede Seite „Entwurf" — so nicht einreichen.

### App Store Connect (Apple)
- [ ] **Datenschutz-URL:** `https://<deine-domain>/datenschutz`
- [ ] **Support-URL** mit erreichbarer Kontaktmöglichkeit (Apple 1.2 verlangt veröffentlichte Kontaktdaten für UGC-Apps).
- [ ] **Altersfreigabe:** Fragebogen ehrlich ausfüllen — Medizin-/Behandlungsinfos „häufig", nutzergenerierte Inhalte „ja" → ergibt 17+/18+.
- [ ] **App Privacy (Nutrition Label):** Gesundheit & Fitness, Kontaktinfo (E-Mail), Nutzerinhalte (Fotos, Erfahrungen), Diagnose (Absturzberichte) — „mit Identität verknüpft", „nicht zum Tracking". Zusätzlich: Gesundheitsdaten (Laborbefunde, Essensfotos und Notizen zu Mahlzeiten) werden für die App-Funktion an einen Dritten (Anthropic) übertragen. Kamera: Barcode-Erkennung auf dem Gerät; Essensfotos nur nach Einwilligung.
- [ ] **HealthKit:** Begründungstexte in `Info.plist` (`NSHealthShareUsageDescription`), nur Lesen; in der Beschreibung nennen.
- [ ] **Demo-Konto** für die Prüfung (mit Beispieldaten, ohne echte Gesundheitsdaten).
- [ ] **Review-Notizen:** Rechner und Simulation rechnen nur mit Nutzereingaben bzw. Literatur-Durchschnittswerten, keine Empfehlung; Moderation mit Melden/Blockieren/Filter/24-h-Prüfung; KI: Befund-Import und Mahlzeiten-Erkennung (beide optional, je nur nach ausdrücklicher Einwilligung, Anthropic; die Mahlzeiten-Erkennung nennt nur Zutaten, keine Mengen oder Nährwerte) und Bibliothekstexte im Admin-Panel.
- [ ] **Beschreibung:** „Kein Medizinprodukt, ersetzt keinen ärztlichen Rat", keine Heilversprechen, keine Substanzwerbung.

### Google Play Console
- [ ] **Datenschutzerklärung-URL** wie oben.
- [ ] **Data Safety:** Gesundheitsdaten, E-Mail, Fotos, Absturzberichte; verschlüsselt übertragen; Löschen in der App möglich. „Geteilt": Laborbefunde sowie Essensfotos und -notizen an Anthropic (optional, je nach Einwilligung); Barcode/Suchbegriff an Open Food Facts ohne Personenbezug.
- [ ] **Health-Apps-Erklärung** ausfüllen; Health Connect: nur Lesen von Gewicht, Schritten, Herzfrequenz, Begründung je Datentyp.
- [ ] **Account-Löschung:** zusätzlich eine Web-Möglichkeit nennen (z. B. Anleitung auf der Support-Seite oder Löschanfrage per E-Mail) — Google verlangt einen Weg außerhalb der App.
- [ ] **Zielgruppe:** nur 18+; Inhaltsbewertung (IARC) ausfüllen.
- [ ] **Demo-Zugang** in „App-Zugriff" hinterlegen.

## Restrisiken

- **Rechner und Blutspiegel-Simulation** (Apple 1.4.2, Dosisrechner): bewusst behalten. Gegenargument in den Review-Notizen: rechnet nur mit eigenen Eingaben, keine Empfehlung, Hinweis sichtbar.
- **Die zwölf weiteren Sprachen** sagen noch „nur für Forschungszwecke" (nicht bearbeitet, Regel in CLAUDE.md). Zum Start nur Deutsch und Englisch anbieten oder vorher gegenlesen lassen.
- **Substanzkatalog** enthält nicht zugelassene Substanzen. Kein Handel und keine Empfehlung in der App; trotzdem kann die Prüfung nachfragen.
