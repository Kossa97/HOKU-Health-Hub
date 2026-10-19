# TYD — Track Your Dose · Handoff-Dokument
> Stand: Mai 2026 · Entwickelt mit Claude Code

---

## Offen — für den Nutzer (Stand 06.10.2026)

- [ ] **Store-Einreichung:** Checkliste `docs/store-compliance.md` (Platzhalter in den Rechtstexten, Konsolen-Angaben, Demo-Konto).
- [ ] **Vercel: `VITE_ANTHROPIC_KEY` → `ANTHROPIC_API_KEY`.** Nicht dringend: der Schlüssel wird nur serverseitig in `api/peptide-ai.js` gelesen (liest `ANTHROPIC_API_KEY` schon zuerst). Aber `VITE_`-Variablen landen im Browser-Bundle, sobald App-Code sie anfasst. Weg: in Vercel neuen Eintrag `ANTHROPIC_API_KEY` (Secret, Production + Preview) mit dem Schlüssel anlegen — der alte ist „Sensitive" und nicht mehr auslesbar, ggf. in console.anthropic.com einen neuen erzeugen —, dann `VITE_ANTHROPIC_KEY` löschen, neu deployen, alten Schlüssel bei Anthropic widerrufen.

## Substanz-Scan in My Stack (Stand 19.10.2026)

Im Assistenten („Substanz hinzufügen", nur beim Neuanlegen) neben der Suche ein Scan-Knopf (`components/SubstanzScanner.tsx`). Zuerst Barcode ohne KI: `food-lookup` mit `kind: 'item'` liefert aus Open Food Facts nur Name, Marke, Menge (auch Supplements ohne Nährwerte); Form und Stärke je Stück kommen aus dem Produktnamen. Sonst Etikett fotografieren oder Foto wählen → neue Edge Function `label-extract` (Claude Haiku 5.5, JSON-Schema, Bild wird nicht gespeichert, Grenze 10 je 10 min / 40 je Tag und Instanz). Abgleich mit dem Katalog und Vorbelegung (Substanz, Form, Stärke, Marke) in `lib/substanzScan.ts` (getestet); ein Scan ersetzt den Entwurf (`draft_restarted`), der Nutzer prüft danach jeden Schritt. Kamera gemeinsam mit der Ernährung (`ernaehrung/lib/useBarcodeKamera.ts`).
Einwilligung: dieselbe wie für Befunde (`ai_import_consent_at`), Text in de/en erweitert. Für Etiketten zählt sie erst ab `ETIKETT_EINWILLIGUNG_AB` = `LABEL_CONSENT_SINCE` (2026-10-19); ältere werden einmal neu gefragt (zurücknehmen + erteilen, weil der Trigger sonst den alten Zeitpunkt behält). Datenschutzerklärung und `NSCameraUsageDescription` angepasst. Keine DB-Änderung.
- [x] Ausgerollt am 19.10.2026: `label-extract` v1 und `food-lookup` v2 in Supabase, App über PR #36 (Stichtag passt zum Release-Tag).
- [ ] Barcode-Scan einmal auf einem echten Gerät prüfen (im Container keine Kamera).

## Betrieb (Stand 29.09.2026)

- **Fehler-Monitoring: Sentry**, Organisation `devin-koslowski`, Projekt `javascript-react`, Region EU (`de.sentry.io`). `VITE_SENTRY_DSN` und `SENTRY_AUTH_TOKEN` stehen in Vercel. Filter vor dem Senden: `src/lib/monitoring.ts` (nur bekannte Fehlertexte, keine Nutzerdaten; bei Updates des Sentry-Pakets prüfen, ob neue Standardwerte Daten sammeln). IP-Speicherung in Sentry ausgeschaltet. Source-Maps lädt der Build hoch (`vite.config.ts`) und löscht sie danach. Der Sentry-Connector ist mit Claude verbunden: „schau in Sentry" genügt.
- **Gerätetests:** `npm run test:e2e` (Playwright, iPhone 13/SE, Pixel 7, nachgebildetes Supabase in `e2e/support/`). Laufen bei jedem Push als GitHub Action (`.github/workflows/e2e.yml`).

## Archiviert — für spätere Updates

- **Raster-Zoom in My Stack** (Stand 01.10.2026, aus der App genommen am 02.10.2026, weil es auf dem iPhone noch nicht rund lief). Zwei Finger im Karussell zusammenziehen → alle Substanzen im Vollbild-Raster: Flieger-Animation, Aufteilung nach Anzahl (`seitenAufteilung`), Seiten, zwei Zoomstufen, Reiter unten, zurück per X oder Auseinanderziehen. Vollständig im Commit **`294e522`** auf `main`. Zurückholen:
  ```bash
  git checkout 294e522 -- src/features/my-stack/page/StackZoomGrid.tsx src/features/my-stack/lib/rasterZoom.ts src/features/my-stack/lib/rasterZoom.test.ts src/features/my-stack/stage/liquidBubbles.ts e2e/my-stack-raster.spec.ts
  git diff 294e522^ 294e522 -- src/features/my-stack/MyStackPage.tsx   # Einbindung + Geste ansehen
  ```
  Die Einbindung (Geste, Menüeintrag „Raster“, Texte `my_stack_view_*`) steckt in `MyStackPage.tsx`, `MyStackHeader.tsx`, `model.ts` und den Sprachdateien — dort per `git diff ead570b 294e522 -- <Datei>` nachsehen. Offene Punkte beim Archivieren: auf dem iPhone noch nicht flüssig genug; gemessen (Chrome, 4× gedrosselt) war der Hauptthread zuletzt sauber, die Restkosten lagen im Zusammensetzen der Grafikebenen.

## 0. Projektstatus

**Ziel:** Eine vollständige, mobile-first Peptid-Tracking-App — Inventar, Rekonstitution, Zyklen, Kalender, Dosierungsrechner, Tagebuch, Bewertungen, Profil, Injektionsstellen-Rotation — international in 14 Sprachen.

**Aktueller Stand:** App ist funktionsfähig, vollständig und deployed auf Vercel. PWA-fähig (installierbar auf iPhone & Android). 14 Sprachen. Homescreen mit Quick-Stats (Nächste Einnahme, Streak, Studie des Tages) + Kacheln. Geführtes **Onboarding** (24 Schritte): Sprach-Gate beim ersten Start, Spotlight-Ring auf Eingabefeldern, Feld-für-Feld-Cycling mit ✓-Button, Tour-Karte immer im Vordergrund (z-index 10050). Neues **Injektionsstellen-Modul** (/injektionen) mit SVG-Körperkarte und Rotationsprotokoll.

**Peptipedia** (evidenzbasierte Peptid-Datenbank) + **Studies** (PubMed-Forschungsmodul) komplett umgesetzt und auf Home-Screen integriert.

Neu in dieser Session (September 2026) — **My Stack stabil, Monitoring, Gerätetests**:
- **My Stack aufgeteilt:** `MyStackPage` in kleinere Teile zerlegt, Zyklus-Aktionen gebündelt, Doppeltes entfernt.
- **Sentry** (Paket `@sentry/react` v11): Filter in `src/lib/monitoring.ts` lässt nur bekannte Fehlertexte durch; unbekannte Schlüssel werden zu „…". v11 sammelt standardmäßig Nutzerdaten — deshalb steht `dataCollection` dort ausdrücklich auf aus. Kein Ort, keine IP. Berichte tragen Browser und Betriebssystem als Tags, React-Abstürze gelten als „nicht behandelt".
- **Gerätetests:** Playwright gegen ein nachgebildetes Supabase (`e2e/support/mockSupabase.ts`, feste Uhrzeit). Abgedeckt: Anlegen, Bearbeiten, Planwechsel, Archivieren, Tabs, Speicherfehler, veraltete Version. Neue Tabellen oder RPCs, die My Stack liest, müssen dort nachgetragen werden, sonst scheitern die Tests.
- **Veraltete Version nach Deployment** (Sentry JAVASCRIPT-REACT-2, Kalender-Absturz): Der Service Worker (`src/sw.ts`) übernimmt neue Versionen sofort und löscht den alten Cache — die alte Seite fand ihre Programmteile nicht mehr. Lösung in `src/lib/staleChunkReload.ts`: nach einer Übernahme lädt die App beim nächsten Seitenwechsel neu (`ReloadOnUpdate`); scheitert trotzdem ein Nachladen, einmal neu laden (`lazyPage`). ⚠️ Neue Seiten in `App.tsx` immer über `lazyPage(() => import(...), 'Name')`, nie mit bloßem `lazy()`.
- **Karussell:** nur sichtbare Vials animieren (IntersectionObserver, Wurzel ist der Streifen) — spart Akku.
- **Begriffe je Darreichungsform (Einnahme / Bestand / Knopf):** Gezählt wird weiter in der Packungseinheit (Sprühstöße, Tropfen, Dosen), angezeigt wird für Menschen. Einnahme: Wirkstoff + Stückzahl — „250 mcg · = 2 Sprühstöße" (`stueckRechnung`/`stueckZahl` in `lib/bestand.ts`, Gegenstück zur Spritzenrechnung „= 6 E aufziehen" beim Vial). Bestand: in Behältern — „2 Sprays · + 1 geöffnet · 40 %", „2 Pens · + 1 angebrochen", „2 Flaschen" (`behaelterArt`, `vorratZeilen`); „geöffnet" nur mit Öffnungsdatum. Knopf je Form (`neuAnbrechenLabel`): Vial „Neu rekonstituieren", Pen „Neuen Pen anbrechen", Spray/Nasenspray „Neues Spray öffnen", Tropfen „Neue Flasche öffnen"; im Alarm blinkt sein Kreispfeil und der Knopf pulsiert (`.tyd-alarm-knopf`). Vial-Texte „angemischt" → „rekonstituiert" (nur de/en). Bezugseinheiten überall übersetzt („125 mcg / 1 Sprühstoß", Etikett „/ Sprühstoß", „Wirkstoff pro Sprühstoß"). Im Assistenten (Stärke-Schritt) ist die Produkteinheit eine Auswahl mit Namen („Sprühstoß", „Tropfen", „Vial") plus „Andere Einheit …" für freie Einheiten; eine Einheit außerhalb der Liste bleibt als Textfeld sichtbar (`StrengthEditor`).
- **Datumsanzeige:** My Stack zeigt Daten in der Sprache der Oberfläche statt fest TT.MM.JJJJ. Die Formatierer werden je Zeitzone zwischengespeichert (`src/lib/planTimeline.ts`); ein Test zählt, dass es dabei bleibt (`intakeSchedule.test.ts`).
- **Listenansicht neu:** je Substanz eine Zeile (~80 px) statt aufklappbarer Karte — für jede Darreichungsform gleich und bewusst nur vier Angaben (Wunsch des Nutzers): **Name, Aktiv/Inaktiv, Zusammensetzung, Haltbarkeit**. Keine nächste Einnahme, kein Vorrat, keine Warn-Chips, keine Aktionen auf der Zeile. Zusammensetzung: Menge je Bezug („5 mg / 2 ml", „400 mg / 1 Tablette"), Mischungen mit Namen. Haltbarkeit: dasselbe Abzeichen wie im Karussell (`page/HaltbarkeitChip.tsx`: grün „Haltbar noch n Tage", ab 7 Tagen gelb, abgelaufen ohne Rahmen „Seit n Tagen abgelaufen!" mit blinkendem Warnsymbol (`components/ExpiredBadge.tsx`), ohne Angabe „Nicht gesetzt"); die Frist ist in beiden Ansichten die frühere von „nach Öffnen/Anmischen" und Packungsdatum (`haltbarkeitFuer`). Aktiv = ein Zyklus läuft jetzt (pausiert/geplant/beendet = inaktiv). Logik in `src/features/my-stack/lib/listRow.ts` (getestet), Darstellung in `page/StackListView.tsx`. Antippen öffnet dasselbe Vollbild wie im Karussell (`oeffneVollbild`; das Vollbild hängt an der Substanz in der Historie, nicht am aktiven Karussell-Eintrag). Bearbeiten, Löschen, Zyklen, Bestand nur noch im Vollbild. Im Vollbild steht oben links dasselbe Haltbarkeits-Abzeichen (`StageDetailSheet` Slot `topLeft`); ist die Frist nach dem Anmischen/Öffnen vorbei (`anbruchAbgelaufen`), blinkt im Knopf „Neues Vial anmischen" das Warnsymbol — bei nur abgelaufenem Packungsdatum nicht, das behebt Anmischen nicht. Entfernt: Info-Sheet (`SubstanceInfoSheet`), +/- am alten Inventar; „Rekonstitution wiederholen" für alte Vials ohne geführten Bestand steht im Vollbild.
- **Liste: Wischen und Gruppen.** Nach links wischen legt unter der Zeile „Bearbeiten" und „Löschen" frei (`useWischen` in `StackListView.tsx`; Loeschen fragt wie im Vollbild nach). Waagerecht ab 10 px, sonst bleibt es Scrollen (`touch-pan-y`); einrasten ab halber Strecke; nur eine Zeile offen, ein Tipp daneben schließt. Gegliedert nach Dringlichkeit (`gruppeVon` in `lib/listRow.ts`): „Braucht Aufmerksamkeit" (abgelaufen oder ≤ 7 Tage), „Aktiv", „Inaktiv" — innerhalb jeder Gruppe die gewählte Sortierung. Überschriften nur bei mehr als einer Gruppe und erst, wenn die Pläne geladen sind. Eine einzige `<ul>`, Überschriften als eigene Einträge: eine Zeile, die die Gruppe wechselt, wandert, statt neu aufgebaut zu werden.
- **Füllstand aus dem Bestand:** Spray, Nasenspray und Tropfflasche zeigen den Pegel der geöffneten Flasche (`fuellstandFuer` in `page/model.ts`; `hasMeaningfulFill` jetzt wahr). Ohne geführten Bestand stehen sie voll da und ohne Prozentzahl; Vials wie bisher. Die Füllstand-Sortierung nutzt dieselbe Funktion.
- **Kleinkram:** Stärke-Hinweis mit eigenem Beispiel für Spray, Tablette, Pflaster (`strengthHintKey`). Die Zählung „2 / 5" steht im Karussell neben den Punkten statt in der Statuszeile (brach dort um). Abstand der Liste zum „?"-Knopf.
- **Helles Design im Vollbild:** farbige Texte, Flächen und weiße Ränder im `[data-stage-detail]` dunkel bzw. als Hauch gesetzt (`index.css`); Etiketten auf Glas tragen einen Schatten (`data-stage-label`). Die Attribut-Regeln treffen nur die Klasse selbst, keine `hover:`-Variante, und nie das Glas-Etikett.
- **Wischen auf iOS-Niveau** (`page/useWischZeile.ts`, getestet): die Zeile folgt dem Finger ohne React-Rendern (direkt `translate3d` am Element), Richtung nach 8 px festgelegt, waagerecht wird das Scrollen unterbunden (`touchmove` nicht passiv). Gummiband an beiden Enden, Schwung entscheidet beim Loslassen (Schnippen öffnet/schließt), danach eine Feder mit der Fingergeschwindigkeit. Halb gezogen nur Symbole, Beschriftung erst mit Platz. Ganz durchgewischt (> 62 % der Breite) füllt „Löschen" die Zeile und fragt beim Loslassen nach. Gefasst wird die ganze Zeile, auch an den Aktionen. Touch über Touch-Ereignisse, Maus/Stift über Pointer. Gerätetests mit echtem Finger (CDP-Touch) in `e2e/my-stack-liste.spec.ts`.
- **Abgelaufen im Karussell wieder mit Wechsel** (Wunsch des Nutzers): rotes Abzeichen mit Rand, 3 s „Abgelaufen!" mit glühendem Rand, 3 s „seit n Tagen" (`ExpiredBadge variante="wechsel"`, über `HaltbarkeitChip`). Liste und Vollbild bleiben beim stillen, ausgeschriebenen Satz.
- **Offen:** die Onboarding-Tour (8 von 9 Ziele gibt es nicht mehr) — separat.
- **Bewertungen v2, Etappe 0 (Datenbank, ausgeführt 2026-10-04):** `supabase-reviews-v2.sql` — rein additiv, idempotent. Neu an `reviews`: `cycle_id` (→ `cycles`, beim Löschen des Zyklus `set null`; eindeutig je Zyklus), `wirkung`/`vertraeglichkeit` (1–5), `wieder_nehmen` (ja/unsicher/nein), `is_public` (Standard aus), `updated_at` (Trigger). `experience` steht jetzt in einer Datei, mit Prüfregel gut/mittel/schlecht. Policy „Own reviews" prüft beim Schreiben, dass Substanz und Zyklus dem Nutzer gehören und zusammenpassen (`alter policy`, kein drop). `profiles.share_bewertungen` standardmäßig aus (bestehende Werte unverändert). Probelauf: Postgres 16 im Container, Produktions-Struktur nachgebaut, zweimal gelaufen, RLS-Fälle geprüft. Produktion vorher/nachher: 6 Bewertungen, alle `experience = gut`, 0 öffentlich, 0 mit Zyklus. Öffentliches Lesen fremder Bewertungen gibt es noch nicht — kommt mit Etappe 4 (nur `is_public`).
- **Bewertungen v2, Etappe 1 (Bewerten-Sheet):** `src/features/reviews/` — `lib/reviewModel.ts` (getestet: Vorschlag des Zyklus — zuletzt beendet ohne Bewertung, sonst laufend; alte Bewertung → Zyklus nach Datum; Kontext „Zeitraum · Dauer · Dosis (250 → 500 mcg) · Rhythmus"; `experience` folgt den Sternen, bleibt aber, wenn die Sterne gleich bleiben), `services/reviews.ts` (wirft Fehler statt still leer), `components/ReviewSheet.tsx` (Chips für Substanz/Zyklus, bewertete Zyklen gesperrt, Sterne ohne Vorauswahl als Radiogruppe, Wirkung/Verträglichkeit 1–5, „Wieder nehmen?", Texte freiwillig, Schalter „Im öffentlichen Profil zeigen" aus). `pages/Bewertungen.tsx` nutzt Sheet und Dienst; Liste zeigt Zyklus und Kriterien (Neugestaltung = Etappe 2). Datenschutz nebenbei: `Profil.tsx` startet `share_bewertungen` mit aus, `PublicProfile.tsx` liest nur `is_public`-Bewertungen. Texte `review_*` nur de/en. e2e: `e2e/bewertungen.spec.ts`; das Nachbild kennt `reviews → stack_items`.
- **Bewertungen v2, Etappe 2 (Übersicht):** `pages/Bewertungen.tsx` neu — je Substanz eine Gruppe (Name, „archiviert", Sternschnitt, Anzahl), darin Zyklen neueste zuerst, „Ohne Zyklus" dahinter (`gruppiereBewertungen`, getestet). Karte antippen = bearbeiten; nach links wischen = Bearbeiten/Löschen über dieselbe Geste wie My Stack (`useWischZeile`). Löschen fragt im eigenen Sheet (`components/ReviewDeleteSheet.tsx`, Fokus auf „Abbrechen") statt `confirm()`. Ladefehler als Hinweis mit „Erneut versuchen". Suche/Reihenfolge (neueste/beste) ab vier Bewertungen. My Stack: „Endgültig löschen" nennt, wie viele Bewertungen mitgehen (`DeleteSubstanceDialog`).
- **Bewertungen v2, Etappe 3 (Anstoß):** Nach „Plan beenden" (`finishTimeline` in `MyStackPage`) einmal eine Meldung „Zyklus beendet — wie war …?" mit „Bewerten"/„Später" (`components/BewertenAnstoss.tsx`, react-hot-toast, 12 s). „Bewerten" führt nach `/bewertungen?bewerten=<Substanz>&zyklus=<Zyklus>`; die Seite öffnet das Sheet einmal und löscht die Parameter. Oben auf der Seite „n beendete Zyklen noch nicht bewertet" mit „Jetzt bewerten" (`unbewerteteZyklen`, nur aktive Substanzen). „Beendet" heißt überall: `ended_at` liegt in der Vergangenheit (`istBeendet`) — ein Plan mit festem Enddatum trägt sein Ende schon vorher. Ohne Zyklus bewerten geht immer (Wunsch des Nutzers): Substanzen ohne Plan landen automatisch bei „Ohne Zyklus", sonst ist es wählbar; der Hinweis sagt „gilt für die Substanz allgemein". Mehrere allgemeine Bewertungen je Substanz sind erlaubt. Nachbild: RPC `end_cycle`.
- **Bewertungen v2, Etappe 4 (öffentlich, Auswertung) — ausgeführt 2026-10-04:** Das öffentliche Profil `/u/<name>` war für Besucher immer leer (RLS: nur eigene Zeilen). Jetzt: `supabase-reviews-public.sql` — Funktion `public_profile_reviews(p_username)` (security definer, `search_path=''`, ausführbar nur für anon/authenticated). Liefert nur für `profiles.is_public` Anzeigename/Nutzername/Bio und nur `reviews.is_public`-Bewertungen mit Substanzname, Sternen, Kriterien, Texten und Monat — nie Dosis, Zyklus, Alter, Geschlecht, genaues Datum, IDs. Privat und unbekannt liefern beide `null` (gleiche Seite „Profil nicht verfügbar"). Tabellen, Zeilen, Policies unverändert; Probelauf zweimal im Container (anon ohne Tabellenzugriff, 2 von 3 freigegeben sichtbar). Produktion danach: 6 Bewertungen, 0 öffentlich. Wunsch des Nutzers: öffentlich nur Bewertungen — `Profil.tsx` zeigt statt der vier alten Teilen-Schalter (wirkten für Besucher nie) einen Hinweis „nur einzeln freigegebene Bewertungen"; die Spalten `share_*` bleiben unangetastet. Stack/Kalender/Tagebuch öffentlich = eigene Planung. `PublicProfile.tsx` neu, übersetzt (de/en). Protokoll und PDF zeigen Wirkung, Verträglichkeit und „Wieder nehmen" (`reviewsByPeptide`, `renderReviews`; alte Bewertungen „–"). Nachbild: RPC `public_profile_reviews`.
- **„Bewertungen" heißt jetzt „Erfahrungen"** (Wunsch des Nutzers: der Bereich soll das Nehmen nicht zugelassener Substanzen nicht bewerben). Nur Wortlaut, nur de/en: Titel, Kachel, Sheet („Neue Erfahrung", Textfeld „Notiz"), Toasts, Löschen, Anstoß („Zyklus … beendet — festhalten, wie es dir ging?"), „noch ohne Erfahrung", Profil-Hinweis, öffentliche Seite, Protokoll („Eigene Erfahrungen nach Substanz (subjektiv)", „Einträge"), PDF-Abschnitt, FAQ. Entfernt: „was bei dir wirklich gewirkt hat", „Beste zuerst" (jetzt „Meiste Sterne zuerst"). Neu: Hinweis `review_disclaimer` „Persönliche, subjektive Notizen — keine Empfehlung und keine Aussage über Wirksamkeit oder Sicherheit einer Substanz" oben in den Erfahrungen und auf dem öffentlichen Profil. Sterne, „Wieder nehmen?" und Teilen bleiben vorerst (Nutzer: „solange es keine Probleme macht"). Code-Namen (`Bewertungen.tsx`, `reviews`, Route `/bewertungen`) unverändert. Die i18n-Prüfsummen für de/en außerhalb des My-Stack-Bereichs sind bewusst neu gesetzt.
- **Store-Konformität, Datenbank — ausgeführt 2026-10-05:** `supabase-store-compliance.sql`. (0) Trigger `profiles_protect_admin_flag`: Die App (anon/authenticated) kann `is_admin` nicht mehr setzen. Vorher ließ die Policy „Own profile" das zu. (1) `profiles.age_confirmed_at/terms_accepted_at/terms_version`. (2) Meldungen: `reviews.hidden_by_moderation` (geschützt per Trigger), Tabelle `content_reports` (nur Admins lesen), RPCs `report_public_review` (anon+auth), `open_content_reports` und `resolve_content_report` (nur Admins). (3) Blockieren: `user_blocks`, `set_profile_block`, `my_blocked_profiles`; `public_profile_reviews` liefert jetzt `blocked` und lässt Ausgeblendetes weg. (4) Filter-Trigger `reviews_check_public_text` nur für öffentliche Texte, Fehler `oeffentlicher_text_link/handel/beleidigung`, Wortliste `moderation_terms` (9). (5) `delete_my_account` ist noch offen, siehe oben (inzwischen mit Vorabprüfung `p_nur_pruefen`). Supabase gibt neuen Funktionen von selbst `anon`; bei den Funktionen nur für Angemeldete ist es ausdrücklich entzogen. Probelauf zweimal im Container. Produktion danach: 12 Profile, 13 Konten, 6 Erfahrungen, davon 1 öffentlich, 0 ausgeblendet, 1 Admin, 9 Filterwörter, 0 Meldungen, 0 Blockierungen, 3 Trigger, 3 neue Policies.
- **Store-Konformität, App und Korrekturen — 2026-10-05:** Registrierung mit drei Pflicht-Häkchen (18+, Bedingungen/Datenschutz, Einwilligung Gesundheitsdaten), gespeichert mit `TERMS_VERSION` (`src/features/compliance/lib/consent.ts`; hochzählen = alle stimmen erneut zu). `ConsentGate` vor dem Layout. Rechtsseiten `/datenschutz`, `/impressum`, `/nutzungsbedingungen` (`legal/texts.ts`, de/en, Platzhalter `[[…]]` gelb + Entwurfshinweis). Öffentliches Profil: Erfahrung und Profil melden (angemeldet), blockieren; Profil → blockierte Profile, Konto löschen (Vorabprüfung, Dateien in `progress-photos/<id>`, `batch-files/<id>`, `batch-files/progress/<id>`, dann Konto, dann Abmelden). Admin-Panel: Meldungen (`moderation_queue`). Hinweis „kein Medizinprodukt" an Registrierung, Rechner, Simulation; „Nur für Forschungszwecke" in de/en ersetzt (die zwölf anderen Sprachen bewusst unverändert). Vorschau-Routen nur bei `import.meta.env.DEV`. DB-Teil 2 `supabase-store-compliance-2.sql` nach Code-Review: ein Filter für alles Öffentliche (Wortgrenzen, „wieder kaufen" erlaubt, Substanzname und Profiltexte geprüft), Melden nur angemeldet mit 20/Stunde, Schnappschuss je Meldung (überlebt das Löschen), Profile ausblendbar, Blockieren eindeutig, `own` im öffentlichen Profil. Probelauf zweimal im Container; Produktion danach: 12 Profile (1 öffentlich, 0 ausgeblendet), 13 Konten, 6 Erfahrungen (1 öffentlich), 1 Admin, 0 Meldungen, 0 Blockierungen, 5 Trigger; Wortliste noch 9 (siehe offen). Gerätetests `e2e/store-compliance.spec.ts`; Nachbild kennt die neuen RPCs und einen kleinen Dateispeicher.
- **Blutwerte, Etappe 0 — KI-Einwilligung — 2026-10-06:** Der Befund-Import schickt Foto/PDF an Anthropic (Edge Function `bloodwork-extract`, Claude Haiku). Neu: `profiles.ai_import_consent_at` (`supabase-bloodwork-ai-consent.sql`; Trigger `profiles_stamp_ai_import_consent` setzt aus der App immer `now()`, behält eine bestehende Einwilligung, Widerruf = null). Import-Sheet und „Datei scannen“ im Befund fragen vorher (`KiEinwilligung.tsx`, Hook `useKiEinwilligung.ts`; Lesefehler → „Erneut versuchen“ statt erneuter Frage), Widerruf im Profil. Edge Function v5 antwortet ohne Einwilligung 403 `consent_required` — die App fragt dann neu. Fehlertexte der Auswertung gemeinsam in `lib/extractError.ts`. Datenschutzerklärung de/en: der falsche Satz „keine Nutzerdaten an KI-Dienste“ ist ersetzt, Anthropic steht unter Empfängern (Platzhalter für Aufbewahrung und Übermittlungsgrundlage). Probelauf zweimal im Container; Produktion danach: 12 Profile, 13 Konten, 190 Blutwerte, 3 Befunde, 0 Einwilligungen. Gerätetests `e2e/blutwerte-ki.spec.ts` (Nachbild der Edge Function in `mockSupabase`). 
- **Blutwerte, Etappe 1 — Deutsch/Englisch — 2026-10-06:** Alle Texte über i18n (`bw_*`, de/en, andere Sprachen englischer Platzhalter). Markerkatalog auf Englisch als Anzeigeschicht `lib/markerCatalog.en.ts` (77 Namen + Erklärungen, Kategorien als `bw_cat_*`); `markerName()` löst auch Synonyme über den Katalog auf. In der Datenbank bleibt der deutsche Name Schlüssel. Datum/Zahl/„bis–ab“ in der aktiven Sprache (`lib/format.ts`, gemeinsamer Helfer `lib/sprache.ts`, Formatierer zwischengespeichert); Sortierung „Name“ nach dem angezeigten Namen. Löschen eines Werts per eigenem Sheet statt `confirm()`. Layout: 48 px Platz unter dem Inhalt für den schwebenden FAQ-Knopf (verdeckte vorher den Löschen-Knopf der letzten Zeile; Seiten mit `lockViewport` unverändert). Gerätetests `e2e/blutwerte-sprache.spec.ts`.
- **Blutwerte, Etappe 2 — Zyklen unter dem Verlauf — 2026-10-06:** In der Marker-Ansicht stehen unter dem Diagramm die Zyklen aus My Stack, je Substanz eine Zeile mit Namen (`components/ZyklusStreifen.tsx`, Rechnung in `lib/zyklusZeilen.ts`, getestet). Diagramm und Zeilen teilen eine Zeitachse (`achse`/`achsenTicks`: Tage als UTC-Mitternacht, Ende einschließlich des letzten Tags, Ticks auf ganzen Tagen; Messpunkte in der Tagesmitte). Pausen sind Lücken (Tage in der Zeitzone des Zyklus; am selben Tag fortgesetzt = keine Lücke); „läuft“ nur, was bis heute reicht. Höchstens 6 Zeilen, Rest als Zahl. Farbe folgt der Substanz (Wunschplatz nach erstem Start; teilen sich zwei sichtbare Zeilen einen Platz, weicht die spätere auf den nächsten freien aus), Farben `--cycle-1..6` je Thema, geprüft mit dem dataviz-Validator. Ein Wert mit Datum in der Zukunft verlängert die Achse. Geladen über `loadCycleHistory` (`my-stack/services/planLifecycle.ts`): auch archivierte Substanzen, ohne bei einer Migration verworfene Zyklen, ohne offene Konflikte und offene Zeitzonen-Prüfung, Zyklen ohne Plan fallen einzeln heraus; Namen kommen aus demselben Abruf (`display_name` nur in dieser Abfrage). Scheitert das Laden, bleibt der Verlauf ohne Zeilen und der Fehler geht an `reportError`; die Zyklen sind je Konto gemerkt. Hinweis „nur zur Orientierung — kein Ursache-Wirkungs-Zusammenhang“. Texte `bw_cycles_*` de/en. Gerätetest in `e2e/blutwerte-sprache.spec.ts`.
- **Blutwerte, Etappe 3 — Einzelwerte bearbeiten — 2026-10-06:** In der Marker-Ansicht hat jede Zeile „Bearbeiten“ (Stift) und „Löschen“, je 44 px groß, mit Wert und Datum im Namen für Screenreader. Bearbeiten öffnet das bekannte Formular (`EntryModal`, Titel „Wert bearbeiten“, Marker fest) und ändert per `update` nur Datum, Wert und Einheit — die Notiz bleibt. Die Laborreferenz bleibt nur bei gleicher Einheit; bei anderer Einheit fällt sie weg (Hinweis im Formular), dann gilt der Katalogbereich. Neu und Bearbeiten teilen einen Speicherweg; Abbrechen setzt das Formular zurück. Werte aus einem Befund: Datum gesperrt mit Hinweis, es wird nicht mitgeschickt (der Befund-Editor kann sein Datum selbst nicht ändern). Zahl im Feld mit dem Dezimalzeichen der Sprache, nur Komma oder Punkt (`formatEingabe`). Die Datumssperre für Befundwerte ist bewusst nur in der App: kein Pfad ändert das Befunddatum, ein DB-Trigger wäre eine Produktionsmigration ohne Anlass. Keine DB-Änderung: Policy „Own data only“ gilt für alle Befehle. Nebenbei: Referenzskala beginnt bei nicht negativen Bereichen links bei 0 statt z. B. bei −5 (`referenceBar.ts`). Texte `bw_edit_*`, `bw_updated`, `bw_update_error`, `bw_delete_aria`, `bw_date_from_report`, `bw_unit_drops_range` de/en. Gerätetests in `e2e/blutwerte-sprache.spec.ts`; WebKit-Projekt im Container nicht lauffähig.
- **Blutwerte, Filter „Auffällige“ — 2026-10-06 (Wunsch des Nutzers):** Oben bleiben die Tabs „Marker · Befunde“. Unter „Marker“ steht in der Kategorie-Leiste zuerst „Auffällige“ (mit Anzahl, vorausgewählt; `AUFFAELLIG`/`MarkerFilter` in `lib/bloodwork.ts`), dann „Alle“ und die Kategorien. Sortieren nur im Raster, nicht in der Liste der Auffälligen. Darin die zuletzt gemessenen Werte außerhalb des Referenzbereichs (`components/AuffaelligeWerte.tsx`); ohne auffällige Werte „Alle … im Referenzbereich“ (grün nur, wenn jeder Wert einen Referenzbereich hat; sonst „Kein Wert außerhalb seines Referenzbereichs“ plus Anzahl „ohne Referenzbereich, nicht geprüft“, `ungepruefteWerte`) mit „Alle Marker ansehen“, ohne Messwerte ein Einstiegshinweis, bei Ladefehler Meldung mit „Erneut versuchen“ statt „keine Blutwerte“. „Laden …“ nur beim ersten Laden, späteres Neuladen lässt den Inhalt stehen. Screenreader: Chip heißt „Auffällige (n)“ (sichtbarer Text plus Anzahl), die Liste ist eine Region „Auffällige Werte (n)“. Ladefehler-Hinweis unter jedem Filter. `filterByKategorie` versteht `AUFFAELLIG`. Der Block oben im Raster ist weg. Kopfzeile bricht um (auf 320 px war „Neu“ abgeschnitten). „Alle Marker ansehen“ wählt „Alle“. Texte `bw_view_flagged`, `bw_flagged_*` de/en; Rot-Töne `RED_WEAK`/`RED_BORDER` in `styles.ts`. Gerätetests in `e2e/blutwerte-sprache.spec.ts`; `e2e/blutwerte-ki.spec.ts` prüft den erkannten Wert jetzt im Import-Feld (war nur zufällig grün über den Marker-Katalog).
- **Speicher `batch-files` — ausgeführt 2026-10-06:** `supabase-storage-batch-files.sql` (nur `alter policy`). Vorher: „Batch read“ ließ jeden, auch nicht Angemeldete, alle Dateien auflisten; „Batch upload“ erlaubte fremde Ordner; „Batch delete“ erfasste `progress/<id>/…` nicht, alte Fortschrittsfotos blieben beim Konto-Löschen liegen. Jetzt nur angemeldet: lesen/löschen `<id>/…` und `progress/<id>/…`, hochladen `<id>/…`. Öffentliche Links liefen nicht über diese Regeln — deshalb danach privat, siehe nächster Eintrag. Probelauf zweimal im Container (anon sah 8 → 0, Nutzer 8 → 5 eigene, fremder Upload abgelehnt, eigenes altes Foto löschbar). Produktion vorher/nachher: 8 Dateien, alle für ihren Besitzer erreichbar. **Admin geprüft:** das einzige `is_admin`-Konto ist das des Nutzers.
- **Speicher `batch-files` privat — 2026-10-06:** Die App zeigt Analyse-Dokumente und alte Fortschrittsfotos über signierte Links (1 h): `src/lib/batchFiles.ts` (`batchDateiPfad` liest alte öffentliche URL wie neuen Pfad, nur eigene Ablageorte `<uuid>/…`/`progress/<uuid>/…`; `signiereBatchDateien`), `src/components/BatchDateiLink.tsx` (Link steht signiert im `href`, damit ihn auch die native App öffnet; erneuert ab 40 min beim Zurückkehren in die App, bei Berührung/Fokus und per Timer; abgelaufen beim Tippen = erst neu holen; Fehler an `reportError`, nach 30 s erneut; fehlende Datei = Name ohne Link). `useFortschrittData` signiert alte Fotos und erneuert alle Foto-Links beim Zurückkehren. `uploadBatchDocument` speichert den Pfad statt der öffentlichen URL. Gespeicherte Daten unverändert (je 2 Dokument-Links in `inventory_items`, `stack_item_inventory`, `stack_items`; 1 altes Foto). Danach `supabase-storage-batch-files-private.sql` (`public = false`) — **ausgeführt 2026-10-06**, nachdem Vercel-Produktion mit Commit 1c82809 READY war; Probelauf zweimal im Container; Produktion vorher öffentlich/8 Dateien, nachher privat/8 Dateien. Gegenprobe des alten öffentlichen Links von außen ging aus dem Container nicht (Netzwerkrichtlinie). `supabase-inventory.sql` legt für neue Projekte gleich den privaten Bucket mit den Regeln für eigene Ordner an. Code- und Sicherheits-Review; Tests `src/lib/batchFiles.test.ts`, `src/components/BatchDateiLink.test.tsx`, `e2e/batch-dateien.spec.ts`.
- **Store-Konformität, SQL-Editor-Teil — vom Nutzer ausgeführt 2026-10-06:** `supabase-store-compliance-sql-editor.sql`. Nachgezählt: `delete_my_account` vorhanden (security definer, `search_path=''`, anon nein, angemeldet ja), Wortliste 8 (ohne „retard“), 12 Profile, 13 Konten, 190 Blutwerte — unverändert bis auf die Wortliste.

Neu in Session davor (2. Juli 2026) — **PDF-Generator komplett neu**:
- **Weg vom Screenshot, hin zu nativem Text-PDF.** Alt: html2canvas-Screenshot des dunklen Dashboards (Rasterbild, nicht markierbar, mehrere MB). Neu: `src/lib/protocolPdf/` — helles, druckfertiges A4-Dokument mit markierbarem Text (jsPDF + `jspdf-autotable` + vektorgezeichnete Charts). Beispiel-Report: 4 Seiten, ~76 KB.
- **Freie Section-Auswahl:** Neues Modal `src/components/ProtocolPdfModal.tsx` — Nutzer hakt ab, was ins PDF kommt (leere Sektionen ausgegraut). Sektionen: Persönliche Angaben · Zusammenfassung · Protokoll/Zyklen · Einnahmetreue · Blutwerte · Gewichtsverlauf · Wohlbefinden · Wirkungen & Nebenwirkungen · Bewertungen · Notizen/Fragen (+ Disclaimer immer).
- **Anonymisierung ohne Extra-Feature:** „Persönliche Angaben" abwählen ⇒ Deckblatt + Kopfzeile zeigen „Anonym" (Forum-Use-Case). Verifiziert.
- **Struktur:** `types.ts`, `sections.ts` (Registry + `visibleSections`/`defaultSelection`/`resolveSubject`), `loadProtocolData.ts` (eigener Loader, lädt Dosis/Methode/Frequenz der Zyklen), `renderProtocolPdf.ts` (Renderer). Nur DE + EN (Helvetica, keine Font-Einbettung). ⚠️ Weitere Sprachen später: brauchen eingebettete Unicode-Fonts (CJK/Arabisch/Hindi). ⚠️ Nur WinAnsi-Zeichen im PDF (kein Δ/✓/→) — für Deltas +/- schreiben.
- **Presets** (Arzt/Coach, Forum, Freunde) bewusst später — aktuell nur freie Auswahl (Wunsch des Nutzers).
- **Aufgeräumt:** alter Screenshot-Code (`addCoverPage`, `decoratePdf`, `withOpacity`, `loadImage`) entfernt, `html2canvas` deinstalliert (nirgends mehr genutzt). 14 neue Tests (`protocolPdf.test.ts`, inkl. Runtime-Smoke der PDF-Generierung).

Neu in Session davor (1. Juli 2026) — **PK-Profile-Update (A+B+C)**:
- **32 → 44 PK-Profile.** ⚠️ `supabase-pk-profiles-2026-update.sql` einmalig im Supabase SQL Editor ausführen (bypassed RLS; `npm run seed:pk` scheitert seit der RLS-Härtung am Anon-Key).
- **3 Korrekturen** (Datenfehler laut reputabler Quellen): Melanotan II HWZ 24 h → ~1 h, Testosteron Enanthat 192 h → ~110 h, Tesamorelin 0,1 h → ~0,3 h.
- **5 GLP-1/Metabolic** (Phase-2/3-PK): Retatrutide, Cagrilintide, Survodutide, Mazdutide, Orforglipron (oral, BV 35 %).
- **7 Research-Peptide**: MOTS-c, AOD-9604, HGH-Fragment 176-191, Thymosin Alpha-1, Hexarelin, DSIP, Kisspeptin-10.
- **Neu: `pk_profiles.notes`-Feld befüllt** mit Datenquelle + Belastbarkeit ("Schätzung" wenn aus Tier-/Einzelstudien extrapoliert). Wird in der manuellen Simulation (`BlutspiegelSimulation.tsx`, „Hinweis:"-Block) automatisch angezeigt.
- SARMs (Gruppe D) bewusst ausgelassen — PK-Datenlage zu dünn; kann später mit Schätz-Flag ergänzt werden.
- Kanonische Quellen aktualisiert: `scripts/seed-pk-profiles.ts` (Single Source of Truth, 44 Einträge) + `supabase-pk-profiles.sql` (Vollbestand mit `notes`/`bioavailability_sc` im Upsert).

Neu in Session davor (1. Juli 2026) — **Optimierungspaket 1**:
- **Push-Reminder repariert**: `api/send-reminders.js` prüft jetzt den echten Einnahme-Plan (Frequenz, Wochentage, Alle-X-Tage, start/end_date, schedule_history) statt nur die Uhrzeit — keine Pings mehr an Off-Tagen. Erinnerungs-Offsets (`on_time`, `2h`, `1day`) werden ausgewertet, Custom-Zeiten minutengenau im Cron-Fenster gematcht, Dosis im Text berücksichtigt Dosis-Anpassungen. Logik liegt testbar in `api/_lib/reminderSchedule.js` (28 Vitest-Tests). Cron in `vercel.json` von täglich 08:00 UTC auf **stündlich** gestellt — ⚠️ Vercel-Hobby-Plan erlaubt nur tägliche Crons; falls Deploy meckert: Schedule zurückstellen und `REMINDER_WINDOW_MIN` anpassen oder externen Cron-Dienst mit `CRON_SECRET` stündlich auf den Endpoint zeigen lassen.
- **RLS-Härtung**: `supabase-rls-hardening.sql` — ⚠️ **einmalig im Supabase SQL Editor ausführen!** Vorher konnte JEDER (auch anonym) `pk_profiles` beschreiben und jeder eingeloggte User `peptide_library`. Jetzt schreiben nur Admins (`profiles.is_admin`, wie im Admin-Panel). Danach eigenen Account per UPDATE-Statement (unten im SQL-File) zum Admin machen.
- **API-Key umbenannt**: `api/peptide-ai.js` liest jetzt `ANTHROPIC_API_KEY` (Fallback auf `VITE_ANTHROPIC_KEY`). ⚠️ In den Vercel Environment Variables umbenennen — `VITE_`-Variablen landen im Client-Bundle, sobald sie referenziert werden.
- **Bundle 60 % kleiner**: Haupt-Bundle 870 kB → 357 kB (gzip 277 → 114 kB), FAQ-Chunk 310 kB → 8 kB. Locale-JSONs, FAQ-Bundles und date-fns-Locales laden jetzt lazy pro Sprache (`src/i18n/index.ts` Lazy-Backend, `src/i18n/dateLocales.ts`, `main.tsx` wartet auf `i18nReady`). Ungenutzte Dependencies entfernt (three, @react-three/fiber, @react-three/drei, @types/three — 50 Pakete).
- **Peptipedia i18n fertig**: Alle Labels in `PeptideLibrary.tsx`, `PeptideCard.tsx`, `PeptideDetailPage.tsx`, `AdminPanel.tsx` laufen über `t()`; `peptideLibrary.ts` exportiert Key-Maps (`CATEGORY_LABEL_KEYS` etc.). 70 neue `plib_*`-Keys in allen 14 Sprachen (`scripts/add-peptipedia-i18n.mjs`).

Neu in Session davor (23. Mai 2026):
- **Home-/Design-System-Update**: Home-Dashboard modernisiert; gemeinsame Dashboard-Komponenten eingeführt und auf Rechner + Blutwerte angewendet.
- **Protokoll-Redesign** (/protokoll): Biohacking-Dashboard mit KPI-Streifen (Adherence, Gewicht Δ, IGF-1 Δ, CRP Δ), 6 Preset-Chips, freie Marker-Toggles, Chart 1 (% Veränderung ab Start, alle Marker normalisiert auf einer Achse, Glow-Linien + Gradient-Fills + Zyklusphasen-Hintergründe + Bluttest-Ereignislinien + Hover-Tooltip), Chart 2 (Small Multiples — ein Mini-Chart je aktivem Marker mit echter Einheit + Normalbereich-Band, synchronisierter Hover), Gradient-Adherence-Balken je Peptid
- **Health-Seite** (/health): BMI, Körperfett-Schätzung (Deurenberg-Formel), Idealgewicht (Devine-Formel), Körperprofil aus Profil-Daten (Alter, Geschlecht, Größe)
- **Profil-Seite**: "Gesundheitsdaten"-Karte entfernt (Daten jetzt auf /health)
- **Blutwerte + Gewichtslogs geseedet**: `scripts/seed-health-data.mjs` — 3 Bluttests × 15 Marker (45 Einträge) + 26 Gewichts-Wochenmessungen (90.3 → 82.6 kg)
- **Test-Account vollständig geseedet**: `scripts/seed-test-data.mjs` — 6 Monate rückwirkend, 6 Peptide, 7 Zyklen, 533 Dose-Logs, Effekte, Bewertungen
- **Vercel-MIME-Fix**: vercel.json von `rewrites` auf `routes` mit `{ "handle": "filesystem" }` umgestellt (JS-Assets wurden als HTML ausgeliefert)

**Deployment:**
- **Vercel:** Automatisches Deployment bei jedem `git push` auf `main`
- **GitHub:** `https://github.com/Kossa97/TYD-TrackYourDose`
- **Lokal:** `cd C:\Users\Devin\peptid-tracker && npm run dev`

---

## 1. Tech-Stack

| Schicht | Technologie |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v3 + custom CSS (index.css) |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |
| Routing | React Router v6 |
| Icons | lucide-react |
| Notifications | react-hot-toast |
| Datums-Utils | date-fns (14 Locales) |
| i18n | i18next + react-i18next + i18next-browser-languagedetector |
| PWA | vite-plugin-pwa |
| Deployment | Vercel (Auto-Deploy via GitHub) |

### Zugang
- **GitHub:** `https://github.com/Kossa97/TYD-TrackYourDose`
- **Supabase:** `app.supabase.com` (Account: `devinko97@gmail.com`)
- **Lokal starten:** `cd C:\Users\Devin\peptid-tracker && npm run dev`

---

## 2. Datenbankschema (Supabase)

Alle Tabellen haben Row Level Security (RLS) aktiviert.

### `profiles`
```
id (uuid, FK → auth.users)
username, display_name, age, weight_kg, height_cm, gender
notes, is_public, public_bio
share_peptide, share_kalender, share_tagebuch, share_bewertungen (boolean)
```

### `inventory_items`
```
id, user_id
name, batch_number, batch_source, batch_file_url
vials_count, vials_initial      ← vials_initial = Ausgangsbestand (NIE überschreiben)
mg_per_vial
created_at
```

### `peptides`
```
id, user_id
name, default_unit, default_dose, default_method
vial_amount_mg, reconstitution_ml
syringe_type                    ← Format: "1:100" (mL:Einheiten)
vials_in_stock, vials_initial
reconstitution_date, expiry_days
batch_number, batch_source, batch_file_url
inventory_item_id (FK → inventory_items)
notes, created_at
```

### `cycles`
```
id, user_id, peptide_id
name, dose, unit, method
frequency, x_days_interval, schedule_days (text[])
start_date, end_date, active
intake_time, intake_time_custom  ← komma-getrennte Slot-Keys: morgens,mittags,abends,custom
intake_time_custom               ← komma-getrennte HH:MM-Strings für custom-Slots
reminder                         ← Format: "on_time,2h" (komma-getrennt)
```

### `dose_escalations`
```
id, user_id, cycle_id
increase_amount, unit
start_type ('date' | 'after_days' | 'after_weeks')
start_date, start_after_days, notes
```

### `dose_logs`
```
id, user_id, peptide_id
dose, unit, method, logged_at (timestamptz), notes
taken (boolean | null)   ← null=ausstehend, true=eingenommen, false=übersprungen
```

### `effects` (Tagebuch)
```
id, user_id, peptide_id
type ('effect' | 'side_effect')
description, severity (1-5), status, duration, occurred_at, notes
```

### `reviews`
```
id, user_id, peptide_id
rating (1-5), title, body, pros, cons
experience ('gut' | 'mittel' | 'schlecht'), created_at
```

### `bloodwork`
```
id, user_id
test_date (date)
marker (text)       ← z.B. 'IGF-1', 'Testosteron', 'CRP', 'TSH', ...
value (numeric)
unit (text)
notes (text)
created_at
```

### `weight_logs`
```
id, user_id
logged_at (timestamptz)
weight_kg (numeric)
notes (text)
```

### Storage Buckets
- `batch-files` — PDFs und Bilder für Analyse-Dokumente (public)

### SQL (falls noch nicht ausgeführt)
```sql
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  batch_number text, batch_source text, batch_file_url text,
  vials_count integer not null default 1,
  vials_initial integer,
  mg_per_vial numeric not null,
  created_at timestamptz default now()
);
alter table inventory_items enable row level security;
create policy "Users manage own inventory" on inventory_items
  for all using (auth.uid() = user_id);

alter table peptides
  add column if not exists inventory_item_id uuid references inventory_items(id);

alter table dose_logs
  add column if not exists taken boolean default null;
```

---

## 3. Dateistruktur

```
src/
├── App.tsx                    ← Routes + Provider-Stack
├── main.tsx                   ← i18n-Import + RTL-Richtung setzen
├── index.css                  ← Design-System (Tokens, Components, ob-*-Klassen)
│
├── i18n/
│   ├── index.ts               ← i18next-Konfiguration, LANGUAGES-Array, applyDirection()
│   ├── faq/                   ← FAQ-Bundles: getFaqBundle(lang) (alle 14 Sprachen)
│   │   ├── types.ts / index.ts
│   │   └── locales/           ← de.ts, en.ts, *.categories.ts …
│   ├── data/
│   │   └── onboarding-i18n.json
│   └── locales/
│       ├── de.json            ← Deutsch (Basis, ~200 Keys)
│       ├── en.json … ko.json  ← 13 weitere Sprachen
│
├── context/
│   ├── AuthContext.tsx
│   └── OnboardingContext.tsx  ← Keys: `_ob_done_${uid}`, `tyd_lang_picked_${uid}`
│
├── components/
│   ├── Layout.tsx             ← 5-Item Bottom-Nav + FAQ-Button + Onboarding-Overlay
│   ├── ProtectedRoute.tsx
│   ├── NewDot.tsx
│   ├── LanguageGate.tsx       ← Erststart-Sprachwahl (i18n.language.split('-')[0] für Erkennung)
│   ├── Onboarding.tsx         ← Scrim + Tour-Karte + ✓-Button + Feld-Cycling
│   ├── onboardingSteps.ts     ← 24 Schritte (Metadaten, Routen, Selektoren)
│   ├── onboardingTarget.ts    ← Rect-Messung, Modal-Erkennung
│   ├── onboardingPlacement.ts ← Karten-Position (Viewport, Tab-Bar, snap top/bottom)
│   └── onboardingLayers.ts   ← z-index-Stapel (Scrim 10000 … Panel 10050)
│
├── pages/
│   ├── Home.tsx               ← Begrüßung + Stats (Nächste Einnahme, Streak, Studie) + Kacheln
│   ├── Dashboard.tsx          ← Kalender + Tagesprotokoll (/kalender)
│   ├── Peptide.tsx            ← Lager-Tab + Meine Peptide-Tab (~1900 Zeilen)
│   ├── InjectionTracker.tsx   ← Injektionsstellen-Rotation (/injektionen)
│   ├── TheLab.tsx             ← Studies / PubMed-Forschungsmodul (/lab)
│   ├── StudyDetail.tsx        ← Studien-Detail-Seite (/lab/study/:id)
│   ├── PeptideLibrary.tsx     ← Peptipedia-Übersicht (/lab/library) ⚠️ noch nicht i18n
│   ├── PeptideDetailPage.tsx  ← Peptid-Profil (/lab/library/:slug) ⚠️ noch nicht i18n
│   ├── lab/
│   │   ├── PeptideCard.tsx    ← Karte für Peptipedia ⚠️ noch nicht i18n
│   │   ├── AdminPanel.tsx     ← AI-gestütztes Admin-Panel (/lab/admin)
│   │   ├── pubmed.ts          ← PubMed eutils API (esearch, esummary, efetch)
│   │   ├── LabHero.tsx        ← Hero-Section mit Search
│   │   ├── ResearchSnapshot.tsx ← 3 Snapshot-Karten
│   │   ├── StudyCard.tsx      ← Studie-Kachel im Feed
│   │   ├── StudySidebar.tsx   ← Desktop-Sidebar mit Filtern
│   │   ├── StudyFeed.tsx      ← Study-Feed + Sidebar-Layout
│   │   └── FilterSheet.tsx    ← Mobile Bottom-Sheet Filter
│   ├── Rechner.tsx
│   ├── Tagebuch.tsx
│   ├── Bewertungen.tsx
│   ├── Protokoll.tsx          ← Biohacking-Dashboard (KPI-Strip, Preset-Chips, 2 Charts, Adherence)
│   ├── Health.tsx             ← Körperprofil (BMI, Körperfett, Idealgewicht) + Gewicht-Sparkline
│   ├── Blutwerte.tsx          ← Bluttest-Verlauf + Marker-Tabelle (/blutwerte)
│   ├── Profil.tsx
│   ├── FAQ.tsx
│   ├── PublicProfile.tsx
│   └── Auth.tsx
│
├── lib/
│   ├── supabase.ts
│   ├── peptideColors.ts       ← 12 Farben + getPeptideColor(index)
│   └── useNew.ts
│
├── services/
│   └── peptideLibrary.ts      ← Typen (PeptideEntry etc.), Supabase-Queries, Display-Helpers
│                              ← ⚠️ CATEGORY_LABELS, STATUS_LABELS, EVIDENCE_LABELS, getConfidenceLabel
│                              ←    sind noch hardcoded Deutsch — für i18n durch t()-Calls ersetzen
│
└── components/
    └── LabLoader.tsx          ← Full-Screen Ladeanimation (spinning FlaskConical)

scripts/
├── seed-test-data.mjs         ← Test-Account seeden (6 Monate, alle Features)
├── seed-health-data.mjs       ← Blutwerte + Gewichtslogs seeden
├── update-ob-texts.cjs        ← Onboarding-Texte in alle 14 Locales schreiben
├── update-escalation-steps.cjs ← Dosiserhöhungs-Steps (16-18) initial hinzugefügt
├── fix-subtitle-numbers.cjs   ← Schritt-Nummern in Subtiteln korrigieren
├── merge-onboarding-i18n.mjs  ← Legacy-Merge-Skript
└── generate-faq-locales.mjs
```

---

## 4. Navigation & Routing

### Bottom-Nav (5 Items)
```
Lager    → /peptide?tab=inventar
Peptide  → /peptide
🏠 Home  → /   (Mitte, Cyan-hervorgehoben)
Kalender → /kalender
Profil   → /profil
```
FAQ erreichbar über schwebendes `?`-Icon (unten rechts über der Nav).

### Alle Routen
```
/                    ← Homescreen
/kalender            ← Kalender + Tagesprotokoll
/peptide             ← Lager + Meine Peptide (?tab=inventar)
/rechner             ← Dosierungsrechner
/tagebuch            ← Wirkungen & Nebenwirkungen
/bewertungen         ← Sterne-Bewertungen
/profil              ← Nutzer-Einstellungen + Sprache
/faq                 ← Hilfe
/injektionen         ← Injektionsstellen-Rotation
/lab                 ← Studies (PubMed-Forschung) ← NEU
/lab/study/:id       ← Studien-Detail-Seite ← NEU
/lab/library         ← Peptipedia (Peptid-Datenbank) ← NEU
/lab/library/:slug   ← Peptid-Detail-Profil ← NEU
/lab/admin           ← Admin-Panel (AI-gestützt, nur eingeloggte User) ← NEU
/protokoll           ← Biohacking-Dashboard (Zyklusauswertung)
/health              ← Körperprofil (BMI, Körperfett, Idealgewicht)
/blutwerte           ← Bluttest-Verlauf
/auth                ← Login (außerhalb Layout)
/u/:username         ← Öffentliches Profil (außerhalb Layout)
```

---

## 5. Internationalisierung (i18n)

### 14 Sprachen
🇩🇪 Deutsch · 🇬🇧 English · 🇪🇸 Español · 🇫🇷 Français · 🇮🇹 Italiano · 🇧🇷 Português · 🇷🇺 Русский · 🇹🇷 Türkçe · 🇸🇦 العربية · 🇮🇳 हिन्दी · 🇮🇩 Bahasa Indonesia · 🇨🇳 中文 · 🇯🇵 日本語 · 🇰🇷 한국어

### Sprache wechseln
- **LanguageGate** beim ersten Start (User-spezifisch: `tyd_lang_picked_${uid}`)
- **Profil → Sprache** jederzeit änderbar
- `localStorage('tyd_lang')` speichert die Wahl, i18n liest sie beim Start
- `i18n.language.split('-')[0]` — regionaler Code (z.B. `de-DE`) wird korrekt auf `de` gemappt
- Arabisch aktiviert RTL (`dir="rtl"`)

### Keys hinzufügen
```ts
// 1. Key in src/i18n/locales/de.json + en.json eintragen
// 2. Für alle 14 Sprachen via Node-Skript in scripts/ schreiben
// 3. In Komponente:
const { t } = useTranslation()
{t('mein_key')}
```

**KRITISCH:** Locale-JSON-Dateien nur per `node` schreiben — PowerShell `ConvertTo-Json` escaped keine Zeilenumbrüche in Strings und erzeugt kaputtes JSON.

---

## 6. Kernfunktionen

### Homescreen — Quick-Stats (Home.tsx)
Drei Karten oben, live aus Supabase:

| Karte | Inhalt | Datenquelle |
|---|---|---|
| ⏱ Nächste Einnahme | Nächste geplante Uhrzeit (HH:MM) oder ✓ wenn erledigt | `cycles.intake_time` aktiver Zyklen |
| 🔥 Streak | Aufeinanderfolgende Tage mit mind. 1 `taken=true` Log | `dose_logs` |
| 📰 Studie des Tages | Täglich rotierend aus 14 Peptid-Forschungsschnipseln | Statisches Array in `Home.tsx`, `Math.floor(Date.now()/86400000) % 14` |

### Inventar-Workflow (kritische Logik)
```
1. Einlagern → inventory_items erstellt (vials_count & vials_initial gesetzt)
   → vials_initial wird NIEMALS danach überschrieben

2. "Peptid anlegen" → peptides-Eintrag mit inventory_item_id
   → KEIN Abzug von vials_count bei Anlage

3. Vials-Abzug NUR bei:
   a) "Peptid verwerfen"           → vials_count - 1
   b) "Rekonstitution wiederholen" → vials_count - 1

4. Nach savePeptide/saveCycle: setExpandedId(savedId) → Peptid-Karte klappt auf
```

### Frequenzen & Einnahmezeiten (cycles)
```
BASE_FREQUENCIES: Täglich | Jeden 2. Tag | 5 Tage an / 2 aus | Mo-Fr |
                  Wöchentlich | Alle X Tage | Wochentage wählen

INTAKE_TIME_CONFIG:
  morgens → 08:00
  mittags → 12:00
  abends  → 20:00
  custom  → HH:MM aus intake_time_custom

daily_freq: '1' | '2' | '3'  ← Wie oft täglich (Buttons im Formular)
```

### Injektionsstellen (/injektionen) — NEU
- **12 Zonen**: Deltoid L/R, Bauch L/R, Oberschenkel L/R (front) + Gesäß L/R, Oberschenkel hinten L/R, Deltoid hinten L/R (back)
- **SVG-Körperkarte** bei 1.65× Skalierung via `<g transform="scale(1.65,1.65)">` — `shapeRendering="geometricPrecision"`
- **Farbcodierung** nach Tagen seit letzter Injektion: grün (5+T) → gelb (2–3T) → orange (gestern) → rot (heute)
- **Empfehlung** — Zone mit längster Pause, ⭐-Markierung + Puls-Ring
- **✓ Markieren** — Tap auf Zone oder ✓-Button in Liste → setzt `days[key] = 0`
- **Undo-Toast** — erscheint 6 Sekunden, Rückgängig stellt exakten Vorwert wieder her
- **Verlauf** — letzte 5 Aktionen mit Rückgängig-Button
- **Aktuell:** Mock-Daten (`INITIAL_DAYS`). Für Produktion: Supabase-Tabelle `injection_sites` anlegen

---

## 7. Onboarding (24 Schritte)

### Ablauf beim ersten Start
1. `LanguageGate` — Sprache wählen → `tyd_lang_picked_${uid}` + `tyd_lang` gesetzt
2. Willkommen (Schritt 0, zentriert) → Route `/`
3. Tour Schritte 1–22 → Finish (Schritt 23)

### Schritte (`onboardingSteps.ts`)

| # | ID | Fokus | Advance |
|---|---|---|---|
| 0 | welcome | — | next |
| 1 | inv-nav | Bottom-Nav Lager | click |
| 2 | add-stock | + Einlagern | click (auto-advance bei Modal) |
| 3 | inv-name | Peptidname-Feld | next + ✓ |
| 4 | inv-amounts | Vials + mg | next + ✓ |
| 5 | inv-batch | Batch + Quelle | next + ✓ |
| 6 | inv-save | Einlagern-Button | click |
| 7 | create-peptide | Peptid anlegen | click |
| 8 | pep-liquid | Zugefügte Flüssigkeit | next + ✓ |
| 9 | pep-expiry | Datum + Haltbarkeit | next + ✓ (2 Felder) |
| 10 | pep-dose | Dosis + Einheit + Methode | next + ✓ |
| 11 | pep-save | Peptid speichern | click |
| 12 | pep-tab | Tab Meine Peptide | click |
| 13 | add-cycle | + Zyklus hinzufügen | click |
| 14 | cycle-plan | Zyklus-Formular (alle Felder) | next + ✓ |
| 15 | cycle-save | Zyklus speichern | click |
| 16 | esc-open | + Dosiserhöhung hinzufügen | click |
| 17 | esc-form | Dosiserhöhungs-Formular | next + ✓ |
| 18 | esc-save | Erhöhung speichern | click |
| 19 | calendar-nav | Kalender-Nav | click |
| 20 | calendar-use | Monatsansicht | next |
| 21 | home-nav | Home-Button | click |
| 22 | home-features | Kacheln-Übersicht | next |
| 23 | finish | — | next |

### Feld-Cycling & ✓-Button
- `getCycleFields(el)` sammelt sichtbare `input`/`select` **und** `[data-ob-self]`-Container in DOM-Reihenfolge
- `data-ob-self` = ganzer Block als eine Einheit (z.B. Haltbarkeit-Buttons, Wochentage, Einnahmezeitpunkt, Erinnerung)
- `isModalTarget = showSpotlight && modalOpen` → Karte snapped via `snap='top'|'bottom'` weg vom aktiven Feld
- `confirmBtn` (Portal, runder ✓-Button rechts im Feld): erscheint bei `isModalTarget && advance==='next'`
- Datum-Inputs: Button um 32px nach links verschoben (freie Kalender-Icon-Zone)
- `ob_confirm_hint`-Banner in der Karte wenn Feld-Cycling aktiv

### Klick-Handler (Event-Delegation)
```typescript
// Alle advance:'click' Steps nutzen document-Level Delegation
// → Handler funktioniert auch wenn Element erst nach dem Effect im DOM erscheint
document.addEventListener('click', delegated, true)
```

### data-ob Attribute (Übersicht)
```
Layout:    nav-lager, nav-kalender, nav-home
Inventar:  btn-einlagern, inv-name, inv-amounts, inv-batch, btn-inv-save
Peptid:    btn-peptid-anlegen, pep-liquid, pep-expiry (+ data-ob-self Haltbarkeit),
           pep-dose, btn-pep-save, tab-peptide
Zyklus:    btn-zyklus-add, cycle-core (umschließt ALLE Felder), btn-cycle-save
Eskalation:btn-esc-add, esc-core, btn-esc-save
Kalender:  calendar-main
Home:      home-tiles
```

### z-Index-Stapel (onboardingLayers.ts)
```
Scrim:     10000
Nav:       10030
Modal:     10040
Ring:      10045  ← außerhalb #ob-scrim-root (eigener Stacking Context)
Panel:     10050
```

### Onboarding zurücksetzen (Browser-Konsole)
```js
localStorage.removeItem('_ob_done_' + userId)
localStorage.removeItem('tyd_lang_picked_' + userId)
location.reload()
```

---

## 8. Design-System

### Farben
- `slate-900` → `#07091a` · `slate-800` → `#0e1428`
- `sky-400` → `#00ccf5` (Neon-Cyan) · `sky-500` → `#00aad4`

### CSS-Architektur (index.css)
```
:root          → Design-Tokens
@layer base    → html/body overflow-x:hidden, overscroll-behavior-x:none
@layer components → .card, .btn-primary/secondary/danger, .input, .select, .label
@layer utilities → .glass, .glow-cyan-sm/md, .text-gradient-cyan
Onboarding-CSS → #ob-callout, .ob-highlight-ring, .ob-scrim-pane,
                 .ob-tap-cue, .ob-confirm-cue, .ob-callout-actions,
                 @keyframes ob-ring-pulse, ob-step-enter
```

### Wichtige CSS-Regeln
- **KEIN** `backdrop-filter` auf scrollbaren Containern (bricht overflow-y)
- `html, body, #root` haben `overflow-x: hidden` — kein horizontales Scrollen
- `min-h-dvh` statt `min-h-screen` (mobile Browser)
- iOS Safe-Area: `padding-bottom: env(safe-area-inset-bottom)` in Nav + Main

---

## 9. Bekannte Limitierungen

| Thema | Detail |
|---|---|
| **Injektionsstellen DB** | Aktuell Mock-Daten — Supabase-Tabelle `injection_sites` noch nicht erstellt |
| **Push-Notifications** | Web-Push via Vercel Cron (stündlich); zusätzlich lokale `setTimeout`-Notification beim Zyklus-Speichern |
| **FAQ aktualisieren** | `en.categories.ts` → `npm run faq:export` → `npm run faq:generate` |
| **Onboarding-Texte** | Via `scripts/update-ob-texts.cjs` oder direkt in `locales/*.json` |
| **IU-Einheit** | IU = mcg (keine Umrechnung) |
| **Offline** | Keine PWA-Offline-Unterstützung |
| **Registrierung** | Offen für alle (in Supabase einschränkbar) |
| **useEffect-Deps** | Lint-Warnungen in mehreren Dateien, kein Crash |
| **⚠️ Protokoll-Redesign nicht genehmigt** | Der neue Protokoll-Stand (Biohacking-Dashboard mit 2 Charts, KPI-Strip etc.) wurde technisch umgesetzt und deployed, aber dem User hat das Ergebnis nicht gefallen. Ggf. überarbeiten oder zurückrollen. |
| **Injektionsstellen DB** | Aktuell Mock-Daten — Supabase-Tabelle `injection_sites` noch nicht erstellt |

---

## 10. Peptipedia & Studies — Details

### Neue DB-Tabelle: `peptide_library`
Angelegt via SQL-Skripte (im Supabase SQL Editor ausführen):
- `supabase-peptide-library.sql` — Tabelle + 11 Peptide
- `supabase-peptide-library-v2.sql` — evidence_human/animal/clinical + evidence_score + research_gaps
- `supabase-peptide-library-v3.sql` — tags[] Column
- `supabase-admin-policies.sql` — RLS INSERT/UPDATE für eingeloggte User

```
peptide_library-Felder:
  id, slug, name, full_name, category, tldr, mechanism
  benefits (text[]), research_dosage, half_life, administration (text[])
  research_status ('preclinical'|'phase_1'|'phase_2'|'approved')
  side_effects (text[]), contraindications (text[])
  pubmed_query, tags (text[])
  evidence_human, evidence_animal ('none'|'limited'|'sparse'|'moderate'|'strong'|'extensive')
  evidence_clinical ('none'|'sparse'|'limited'|'moderate'|'extensive')
  evidence_score (int, 1–10)
  research_gaps (text[])
  sort_order (int)
```

**RLS:** Alle User lesen, eingeloggte User schreiben (für Admin-Panel).

### Admin-Panel (/lab/admin)
- Vercel Serverless Function: `api/peptide-ai.js` (plain JS, ES module)
- Anthropic API Key als `ANTHROPIC_API_KEY` in Vercel Environment Variables (Alt-Name `VITE_ANTHROPIC_KEY` wird noch als Fallback gelesen)
- Modell: `claude-haiku-4-5` (stand 2026 — frühere Claude-3-Modelle deprecated)
- Action `create`: Tippfehler korrigieren, vollständiges Profil generieren + tags
- Action `update`: bestehendes Profil verbessern + tags aktualisieren
- Name + Slug editierbar vor dem Speichern
- `package.json` hat `"type": "module"` → API-Funktionen müssen `export default` nutzen (KEIN `module.exports`)
- `"engines": { "node": "24.x" }` in package.json → globales `fetch` in Vercel verfügbar. Vercel hat Node 20 im Oktober 2026 abgeschaltet: Builds brachen nach Sekunden ab („Node.js Version 20.x is discontinued“).

### Studies (/lab) — PubMed-Integration
- `src/pages/lab/pubmed.ts` — eutils API (esearch, esummary, efetch), 429-Retry-Logik
- Vite Dev Proxy: `/ncbi` → `eutils.ncbi.nlm.nih.gov` (CORS-Workaround lokal)
- In Production: direkter Aufruf (kein Proxy)
- `LabLoader.tsx` — Full-Screen-Ladeanimation beim ersten Laden (faded sich aus)
- `src/pages/lab/` enthält: LabHero, ResearchSnapshot, StudyCard, StudySidebar, StudyFeed, StudyDetail, FilterSheet, PeptideCard, AdminPanel
- `src/services/peptideLibrary.ts` — Typen, Supabase-Queries, Display-Helpers

### Naming-Konventionen
- **"Studies"** = PubMed-Recherche-Modul (`tile_lab` in i18n → "Studies")
- **"Peptipedia"** = Evidenz-Datenbank (`tile_bibliothek` in i18n → "Peptipedia")

---

## 11. Häufige Fehler & Fixes

| Fehler | Ursache | Fix |
|---|---|---|
| Modal-Scrollen kaputt | `backdrop-filter` auf `.rounded-t-2xl` | Nicht hinzufügen |
| JSON-Fehler nach PowerShell | `ConvertTo-Json` escaped keine `\n` | Immer Node.js für JSON-Writes |
| Sprache zeigt Keys | i18n resources nicht in `{ translation: {} }` | `resources: { de: { translation: de } }` |
| LanguageGate zeigt 'en' auf DE-Gerät | `i18n.language` = `'de-DE'` → kein Match | `split('-')[0]` bereits implementiert |
| Ring unsichtbar | Ring in `#ob-scrim-root` (z-index gebunden) | Ring als SVG-Geschwister außerhalb des Scrim-Root rendern |
| ✓-Button blockiert | Click-Blocker fing `data-ob-confirm` ab | `node.closest('[data-ob-confirm]')` Exception |
| btn-zyklus-add nicht gefunden | Die Liste hat keinen Zyklus-Knopf mehr | Der Knopf steht nur noch im Zyklusverwalter (Vollbild → Plan) |
| Klick-Step geht nicht weiter | Handler zu früh attached (Element noch nicht im DOM) | Event-Delegation auf `document` statt direktes `addEventListener` |
| Karte überdeckt Eingabefeld | Immer `snap='top'` bei modalen Schritten | Jetzt dynamisch: `fieldTop < cardBottomWhenAtTop ? 'bottom' : 'top'` |
| Karte bleibt bei Resize | `targetRect=null` → kein State-Change → kein Recompute | `viewportKey` State, inkrementiert bei `resize` |
| Vercel schwarzer Screen / MIME-Fehler | `rewrites: [{ source: "/(.*)", destination: "/index.html" }]` fängt JS-Assets ab → Browser bekommt HTML statt JS | `routes` mit `{ "handle": "filesystem" }` zuerst, dann SPA-Fallback. Außerdem alten Service Worker in DevTools deregistrieren (cached bad response) |
| Weißer Bildschirm / „Failed to fetch dynamically imported module“ nach Deployment | Alte Seite lädt Programmteil, den der neue Service Worker gelöscht hat | `lazyPage` + `ReloadOnUpdate` (`src/lib/staleChunkReload.ts`) — neue Seiten nur über `lazyPage` einbinden |
| Push rejected | Remote hat neuere Commits | `git pull --rebase origin main` |
| App startet nicht (Windows) | PowerShell Execution Policy | `Set-ExecutionPolicy Bypass -Scope Process` |

---

## 12. Entwicklungs-Workflow

```bash
# Lokal starten
cd C:\Users\Devin\peptid-tracker
npm run dev          # http://localhost:5173

# Deployen
git add .
git commit -m "Beschreibung"
git push             # → Vercel deployed automatisch

# Locale-Keys in alle 14 Sprachen schreiben (Node-Skript)
node scripts/update-ob-texts.cjs

# Typecheck
npx tsc -b

# Onboarding zurücksetzen (Konsole)
localStorage.removeItem('_ob_done_' + userId)
localStorage.removeItem('tyd_lang_picked_' + userId)
location.reload()
```

---

*Zuletzt aktualisiert: 29. September 2026 — My Stack aufgeteilt, Sentry v11 mit Datenfilter, Gerätetests bei jedem Push, Absturz nach Deployment behoben (lazyPage/ReloadOnUpdate), Karussell spart Akku, Datumsanzeige je Sprache.*
