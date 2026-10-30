import type { FaqCategory } from '../types'

/** German FAQ */
export const deCategories: FaqCategory[] = [
  {
    id: 'start',
    title: 'Erste Schritte & Navigation',
    items: [
      {
        q: 'Was ist HOKU: Health Hub?',
        a: 'HOKU: Health Hub ist eine private Dokumentations-App für Peptide, Zyklen, Dosen, Vorrat, Injektionsstellen, Blutwerte, Effekte und Reports. Die App ersetzt keine medizinische Beratung und ist für Recherche, Struktur und persönliche Dokumentation gedacht.',
      },
      {
        q: 'Wie ist die App aufgebaut?',
        a: [
          'Die wichtigsten Bereiche erreichst du über die untere Navigation und den Home-Bildschirm:',
          '- Home: Überblick, Schnellaktionen und Kacheln',
          '- Kalender: geplante und protokollierte Dosen',
          '- My Stack: Substanzen, Vials, Zyklen und Dosisanpassungen',
          '- Profil: Account, Sprache, Theme, Sharing und Benachrichtigungen',
        ],
      },
      {
        q: 'Was macht der Home-Bildschirm?',
        a: [
          'Home ist die Startzentrale der App.',
          '- Oben stehen Statuskarten wie aktive Zyklen, heutige Logs oder niedriger Vorrat',
          '- Schnellaktionen führen direkt zu Logging, Rechner, Fortschritt oder Simulation',
          '- Feature-Kacheln führen zu Kalender, My Stack, Rechner, Injektionen, Protokoll, Lab, Blutwerte, Health, Tagebuch, Erfahrungen, FAQ und Profil',
        ],
      },
      {
        q: 'Was bedeuten die Schnellaktionen auf Home?',
        a: [
          'Schnellaktionen springen direkt in typische Tagesaufgaben:',
          '- Heute loggen: öffnet den Kalender zum Bestätigen oder Eintragen von Dosen',
          '- Injektion loggen: öffnet die Injektionsstellen-Rotation',
          '- Dosis rechnen: öffnet den Rechner',
          '- Fortschritt: öffnet Gewicht, Fotos und Verlauf',
          '- Blutspiegel: öffnet die PK-Simulation',
        ],
      },
      {
        q: 'Wie suche ich nach Funktionen oder Einträgen?',
        a: 'Viele Bereiche haben eine eigene Suche. In My Stack öffnest du die Suche über die Lupe, tippst den Namen ein und schließt sie wieder über das X. Die FAQ-Suche durchsucht Fragen und Antworten.',
      },
      {
        q: 'Kann ich die App auf dem Handy wie eine native App nutzen?',
        a: [
          'Ja. Die App ist als PWA nutzbar.',
          '- iPhone/Safari: Teilen-Symbol, dann Zum Home-Bildschirm',
          '- Android/Chrome: Menü mit drei Punkten, dann App installieren oder Zum Startbildschirm',
          '- Danach startet sie ohne Browserleiste und fühlt sich wie eine App an',
        ],
      },
      {
        q: 'In welcher Reihenfolge sollte ich starten?',
        a: [
          'Empfohlener Ablauf:',
          '1. In My Stack eine neue Substanz anlegen',
          '2. Direkt danach einen Zyklus anlegen oder später über Neu/Zyklus hinzufügen',
          '3. Optional die Dosis im Rechner prüfen',
          '4. Im Kalender Dosen loggen und bestätigen',
          '5. In Injektionen, Tagebuch, Blutwerte und Protokoll ergänzend dokumentieren',
        ],
      },
      {
        q: 'Warum steht in der App häufig "Kein Medizinprodukt"?',
        a: 'Weil die App Daten dokumentiert und berechnet, aber keine Diagnose, Dosierungsempfehlung oder Therapieentscheidung trifft. Dosis, Substanz, Frequenz und Anwendung bleiben deine Verantwortung beziehungsweise gehören in fachliche Beratung.',
      },
    ],
  },
  {
    id: 'peptide',
    title: 'My Stack, Vials & Substanzen',
    items: [
      {
        q: 'Was ist My Stack?',
        a: 'My Stack ist der Bereich für deine Substanzen. Dort verwaltest du Vials, Rekonstitution, Haltbarkeit, aktive Zyklen, Dosisanpassungen, Notizen, Batch-Daten und Analyse-Dokumente.',
      },
      {
        q: 'Was ist der Unterschied zwischen Vials-Ansicht und Liste?',
        a: [
          'Die Vials-Ansicht ist die visuelle mobile Hauptansicht.',
          '- Vials: großes Karussell mit aktivem Vial, Haltbarkeit, Aktionen, Info und aktivem Zyklus',
          '- Liste: kompakte Kartenansicht mit mehreren Substanzen untereinander',
          '- Wechsel: über den Filter-/Ansicht-Button oben rechts',
        ],
      },
      {
        q: 'Wie bediene ich das Vial-Karussell?',
        a: [
          'Du kannst auf mehrere Arten wechseln:',
          '- Handy: horizontal wischen oder ein Vial antippen',
          '- Desktop: mit gedrückter Maus ziehen',
          '- Desktop: Mausrad nach unten wechselt weiter nach links im Karussell',
          '- Pfeile links und rechts wechseln zum vorherigen oder nächsten Vial',
        ],
      },
      {
        q: 'Was bedeutet die Prozentzahl unter dem aktiven Vial?',
        a: 'Sie zeigt den berechneten Füllstand des aktuell angezeigten Vials. Ganze Vials werden als 100 % angezeigt; angebrochene Vials werden als anteiliger Rest dargestellt.',
      },
      {
        q: 'Was bedeuten "Haltbar", "Aktiv" und "x / y" oben im Vial-Modus?',
        a: [
          '- Haltbar: zeigt Resttage bis zum berechneten Ablauf oder Nicht gesetzt',
          '- Aktiv: mindestens ein aktiver Zyklus existiert für diese Substanz',
          '- x / y: aktuelle Position im Karussell',
        ],
      },
      {
        q: 'Was macht der Button "Rekonst."?',
        a: 'Rekonst. startet den Rekonstitutions-Dialog. Wenn du bestätigst, werden Rekonstitutionsdatum und Bestand für die verbundene Substanz aktualisiert. Wenn kein Inventar verknüpft ist, ist der Button deaktiviert.',
      },
      {
        q: 'Was macht "Edit"?',
        a: 'Edit öffnet die Substanz zum Bearbeiten. Du kannst Name, Farbe, Wirkstoff pro Vial, Flüssigkeit, Rekonstitutionsdatum, Haltbarkeit, Vials, Applikationsart, Batch, Quelle, Dokument und Notizen ändern.',
      },
      {
        q: 'Was macht "Löschen"?',
        a: 'Löschen entfernt die Substanz nach Bestätigung. Nutze das nur, wenn du die Substanz wirklich nicht mehr in deinem Stack brauchst.',
      },
      {
        q: 'Was steht in der aufklappbaren "Info"-Leiste?',
        a: [
          'Info ist standardmäßig eingeklappt und zeigt nach dem Öffnen alle kompakten Substanzdaten:',
          '- Peptidname',
          '- Wirkstoff pro Vial',
          '- hinzugefügte Flüssigkeit',
          '- Rekonstitutionsdatum',
          '- Haltbarkeit',
          '- rohe Vials in Reserve',
          '- Applikationsart',
          '- Batch, Quelle, Analyse-Dokument und Notizen',
        ],
      },
      {
        q: 'Warum stehen Farbe und Füllstand nicht in der Info-Leiste?',
        a: 'Farbe und Füllstand sind bereits direkt am Vial sichtbar. Die Info-Leiste konzentriert sich auf Daten, die man sonst nicht auf einen Blick sieht.',
      },
      {
        q: 'Wie lege ich eine neue Substanz an?',
        a: [
          'Tippe in My Stack auf die Add-Vial-Kachel oder auf Neue Substanz.',
          '- Die Felder sind als Liste aufgebaut',
          '- Ein Tipp auf eine Zeile öffnet den passenden Editor',
          '- Auf dem Handy liegt der aktive Eingabebereich zentraler, damit er mit dem Daumen leichter erreichbar ist',
          '- Speichern legt die Substanz an',
        ],
      },
      {
        q: 'Welche Felder gehören zu "Neue Substanz"?',
        a: [
          'Wichtige Felder sind:',
          '- Peptidname',
          '- Farbe',
          '- Wirkstoff pro Vial',
          '- zugefügte Flüssigkeit',
          '- Datum Rekonstitution',
          '- Haltbarkeit nach Rekonstitution',
          '- vorrätige Vials',
          '- Applikationsart',
          '- Batch, Quelle, Analyse-Dokument und Notizen',
        ],
      },
      {
        q: 'Warum gibt es keine Standard-Dosis mehr bei einer Substanz?',
        a: 'Die App nutzt keine Standard-Dosis mehr auf Substanzebene. Entscheidend ist immer die Dosis im jeweiligen Zyklus und die aktive Dosisanpassung. Dadurch ist klar, welche Dosis für welchen Zeitraum gilt.',
      },
      {
        q: 'Was passiert nach dem Speichern einer neuen Substanz?',
        a: 'Nach dem Speichern kann die App dich fragen, ob du direkt einen Zyklus für diese Substanz anlegen möchtest. Du kannst sofort Zyklus anlegen wählen oder mit Später zurück in My Stack gehen.',
      },
      {
        q: 'Was ist die Add-Vial-Kachel im Karussell?',
        a: 'Die Add-Vial-Kachel ist der schnelle Einstieg für eine neue Substanz. Sie sitzt im Vial-Karussell wie ein eigener Platz und öffnet das Formular Neue Substanz.',
      },
    ],
  },
  {
    id: 'zyklen',
    title: 'Zyklen & aktive Dosis',
    items: [
      {
        q: 'Was ist ein Zyklus?',
        a: 'Ein Zyklus ist ein Einnahme- oder Dokumentationsplan für eine Substanz. Er enthält Name, Dosis, Einheit, Methode, Frequenz, Startdatum, optionales Enddatum, Einnahmezeiten und Reminder.',
      },
      {
        q: 'Wie lege ich einen Zyklus an?',
        a: [
          'Du kannst einen Zyklus an mehreren Stellen anlegen:',
          '- direkt nach dem Speichern einer neuen Substanz über Zyklus anlegen',
          '- im Vial-Modus über Neu oder Zyklus hinzufügen im Bereich Aktiver Zyklus',
          '- in der Listenansicht über Zyklus hinzufügen auf der Substanzkarte',
        ],
      },
      {
        q: 'Kann ich mehrere aktive Zyklen für dieselbe Substanz anlegen?',
        a: 'Ja. Die Sperre wurde entfernt. Du kannst mehrere Zyklen anlegen, auch wenn bereits ein aktiver Zyklus existiert. Alle aktiven Zyklen können im Kalender erscheinen.',
      },
      {
        q: 'Was zeigt der Bereich "Aktiver Zyklus" im Vial-Modus?',
        a: [
          'Der Bereich zeigt die wichtigsten aktuellen Zyklusdaten:',
          '- Zyklusname',
          '- Tag im Zyklus als x / Gesamtdauer oder x / Ende offen',
          '- aktuelle Dosis',
          '- Frequenz inklusive Morgens/Mittags/Abends, falls gewählt',
          '- Methode',
          '- Reminder',
          '- Fortschrittsbalken, wenn ein Enddatum existiert',
        ],
      },
      {
        q: 'Was bedeutet "Tag x / Ende offen"?',
        a: 'Der erste Wert ist der aktuelle Tag seit Zyklusstart. Ende offen bedeutet, dass der Zyklus kein Enddatum hat. Bei einem Enddatum steht dort zum Beispiel 17 / 42.',
      },
      {
        q: 'Wie wird die aktuelle Dosis berechnet?',
        a: 'Die aktuelle Dosis kommt aus dem aktiven Zyklus. Wenn eine Dosisanpassung für heute aktiv ist, gilt die dort definierte Ziel-Dosis. Eine frühere Standard-Dosis der Substanz spielt keine Rolle mehr.',
      },
      {
        q: 'Was bedeutet "Frequenz" im aktiven Zyklus?',
        a: 'Frequenz kombiniert den Rhythmus und, falls ausgewählt, die Tageszeit. Beispiel: Täglich · Morgens · Mittags · Abends oder Mo, Mi, Fr · Abends.',
      },
      {
        q: 'Welche Frequenzen kann ich im Zyklus wählen?',
        a: [
          'Mögliche Frequenzen sind:',
          '- Täglich',
          '- Jeden 2. Tag',
          '- 5 Tage an / 2 aus',
          '- Mo-Fr',
          '- Wöchentlich',
          '- Alle X Tage',
          '- Wochentage wählen',
        ],
      },
      {
        q: 'Was bedeutet 1x, 2x oder 3x täglich?',
        a: 'Damit legst du fest, wie viele Einnahmezeitpunkte pro Tag geplant sind. Für jeden Slot kannst du morgens, mittags, abends oder eine eigene Uhrzeit wählen.',
      },
      {
        q: 'Was macht der Button "Dosis loggen"?',
        a: 'Dosis loggen führt dich zum Kalender. Dort kannst du die für den Tag geplante Dosis speichern und anschließend als eingenommen oder nicht eingenommen markieren.',
      },
      {
        q: 'Was passiert, wenn ich einen Zyklus bearbeite und den Plan ändere?',
        a: 'Wenn du relevante Planwerte änderst, fragt die App, ob die Änderung erst ab heute oder rückwirkend für den gesamten Zyklus gelten soll.',
      },
      {
        q: 'Was bedeutet Aktiv/Inaktiv bei einem Zyklus?',
        a: 'Aktiv bedeutet, dass der Zyklus im Kalender und in der Planung berücksichtigt wird. Inaktiv pausiert den Zyklus, ohne ihn zu löschen.',
      },
    ],
  },
  {
    id: 'escalation',
    title: 'Dosisanpassungen',
    items: [
      {
        q: 'Was ist eine Dosisanpassung?',
        a: 'Eine Dosisanpassung ist eine geplante Ziel-Dosis innerhalb eines Zyklus. Sie kann die Dosis erhöhen, reduzieren oder auf einen bestimmten Wert setzen.',
      },
      {
        q: 'Wie füge ich eine Dosisanpassung hinzu?',
        a: [
          'Im aktiven Zyklus oder in der aufgeklappten Zyklusliste:',
          '1. Dosisanpassungen öffnen',
          '2. Dosisanpassung hinzufügen tippen',
          '3. Neue Ziel-Dosis und Einheit eintragen',
          '4. Startzeitpunkt wählen',
          '5. Optional Notiz ergänzen und speichern',
        ],
      },
      {
        q: 'Welche Startzeitpunkte gibt es?',
        a: [
          'Du kannst wählen:',
          '- festes Datum',
          '- nach X Tagen ab Zyklusstart',
          '- nach X Wochen ab Zyklusstart',
        ],
      },
      {
        q: 'Was bedeutet die Timeline mit den Punkten links?',
        a: [
          'Die Timeline zeigt Basisdosis und geplante Dosisanpassungen chronologisch.',
          '- Der aktuelle Punkt markiert die Dosis, die gerade gilt',
          '- Abgehakte Punkte liegen bereits in der Vergangenheit',
          '- Uhr-Symbole stehen für geplante zukünftige Stufen',
        ],
      },
      {
        q: 'Warum steht "Basis" in der Dosisanpassungs-Liste?',
        a: 'Basis ist die ursprüngliche Zyklusdosis. Sie bleibt sichtbar, damit du die aktuelle Dosis immer gegen den Startwert vergleichen kannst.',
      },
      {
        q: 'Was bedeutet "Aktuell" in der Dosisanpassung?',
        a: 'Aktuell markiert die Stufe, die am heutigen Tag gilt. Wenn keine spätere Anpassung aktiv ist, ist die Basis als aktuell markiert.',
      },
      {
        q: 'Was bedeutet "Keine Dosisanpassungen geplant"?',
        a: 'Für diesen Zyklus gibt es nur die Basisdosis. Du kannst darunter über Dosisanpassung hinzufügen eine neue Stufe anlegen.',
      },
      {
        q: 'Kann ich mehrere Dosisanpassungen haben?',
        a: 'Ja. Mehrere Stufen sind möglich. Die App sortiert sie nach Startzeitpunkt und berechnet daraus die heute wirksame Dosis.',
      },
      {
        q: 'Werden Dosisanpassungen im Kalender berücksichtigt?',
        a: 'Ja. Kalender und Tagespanel verwenden die effektive Dosis für den jeweiligen Tag. Wenn eine Anpassung aktiv ist, wird die angezeigte Dosis entsprechend angepasst.',
      },
    ],
  },
  {
    id: 'kalender',
    title: 'Kalender & Dosis-Logging',
    items: [
      {
        q: 'Was zeigt der Kalender?',
        a: [
          'Der Kalender zeigt geplante und protokollierte Einnahmen.',
          '- farbige Tage für aktive Zyklen',
          '- Markierungen für Logs',
          '- heutiger Tag',
          '- Hinweise auf aktive Dosisanpassungen',
        ],
      },
      {
        q: 'Wie wechsle ich den Monat?',
        a: 'Nutze die Pfeile links und rechts am Monatskopf oder wische horizontal über den Kalender.',
      },
      {
        q: 'Wie logge ich eine geplante Dosis?',
        a: [
          '1. Im Kalender den passenden Tag wählen',
          '2. Im Tagesbereich den geplanten Zyklus antippen',
          '3. Dosis, Methode und Uhrzeit prüfen',
          '4. Speichern',
          '5. Danach optional als eingenommen oder nicht eingenommen bestätigen',
        ],
      },
      {
        q: 'Was ist der Unterschied zwischen Loggen und Bestätigen?',
        a: 'Loggen erstellt den Dosiseintrag. Bestätigen markiert, ob die Dosis wirklich eingenommen wurde. Dadurch kann die App Adherence und Reports sauberer darstellen.',
      },
      {
        q: 'Was passiert bei "Eingenommen"?',
        a: 'Der Log wird als genommen markiert und in Auswertungen als erledigt gezählt.',
      },
      {
        q: 'Was passiert bei "Nicht eingenommen"?',
        a: 'Der Log wird als nicht genommen markiert. Danach können Snooze-Optionen erscheinen, damit du später erneut erinnert wirst.',
      },
      {
        q: 'Was ist Snooze?',
        a: 'Snooze ist eine nachträgliche Erinnerung für eine nicht eingenommene Dosis, zum Beispiel nach 15 Minuten, 30 Minuten, 1 Stunde oder 2 Stunden.',
      },
      {
        q: 'Warum sehe ich keinen geplanten Zyklus im Kalender?',
        a: [
          'Prüfe diese Punkte:',
          '- Zyklus ist aktiv',
          '- Start- und Enddatum umfassen den gewählten Tag',
          '- Frequenz passt zum Tag',
          '- du bist im richtigen Monat',
        ],
      },
      {
        q: 'Wird mein Vorrat beim Loggen reduziert?',
        a: 'Wenn die App die Dosis in Vial-Anteile umrechnen kann, kann der Bestand entsprechend reduziert werden. Dafür braucht sie Wirkstoff pro Vial, rekonstituierte Flüssigkeit und eine passende Einheit.',
      },
    ],
  },
  {
    id: 'erinnerung',
    title: 'Reminder, Push & Snooze',
    items: [
      {
        q: 'Welche Reminder kann ich im Zyklus wählen?',
        a: 'Du kannst 1 Tag vorher, 2 Stunden vorher und Bei Einnahme kombinieren. Die Auswahl ist mehrfach möglich.',
      },
      {
        q: 'Warum stehen Morgens, Mittags und Abends bei Frequenz?',
        a: 'Wenn du diese Einnahmezeiten im Zyklus wählst, werden sie in der aktiven Zykluskarte direkt bei Frequenz angezeigt. So ist auf einen Blick sichtbar, wann die Dosis geplant ist.',
      },
      {
        q: 'Was bedeutet "Bei Einnahme"?',
        a: 'Der Reminder ist zur geplanten Einnahmezeit fällig. Ohne Einnahmezeit kann die App keine genaue Tageszeit ableiten.',
      },
      {
        q: 'Muss ich Benachrichtigungen erlauben?',
        a: 'Ja, für echte Benachrichtigungen braucht die App die Browser- oder Systemberechtigung. Ohne Berechtigung bleiben die Daten gespeichert, aber es erscheint keine Benachrichtigung.',
      },
      {
        q: 'Warum bekomme ich keine Push-Mitteilung?',
        a: [
          'Mögliche Gründe:',
          '- Benachrichtigungen sind im Browser oder Betriebssystem blockiert',
          '- die PWA ist nicht korrekt installiert',
          '- der Reminder liegt in der Vergangenheit',
          '- der Zyklus ist inaktiv',
          '- die Push-Verbindung muss im Profil neu verbunden werden',
        ],
      },
      {
        q: 'Was macht "Neu verbinden" im Profil?',
        a: 'Neu verbinden setzt die Push-Verbindung neu auf. Das ist nützlich, wenn Benachrichtigungen nach Browser-, iOS- oder App-Änderungen nicht mehr ankommen.',
      },
      {
        q: 'Was macht "Test senden" im Profil?',
        a: 'Test senden prüft, ob Benachrichtigungen auf deinem aktuellen Gerät ankommen. Auf iPhone kann die Mitteilung je nach Zustand erst sichtbar werden, wenn die App geschlossen oder das Gerät gesperrt ist.',
      },
    ],
  },
  {
    id: 'rechner',
    title: 'Rechner',
    items: [
      {
        q: 'Wofür ist der Rechner da?',
        a: 'Der Rechner hilft, aus Vial-Menge, hinzugefügter Flüssigkeit, Ziel-Dosis und Spritzenskala das aufzuziehende Volumen beziehungsweise die Einheiten zu berechnen.',
      },
      {
        q: 'Welche Eingaben braucht der Rechner?',
        a: [
          '- Spritzengröße und Einheiten',
          '- Wirkstoff pro Vial',
          '- rekonstituierte Flüssigkeit',
          '- Ziel-Dosis und Einheit',
        ],
      },
      {
        q: 'Kann ich gespeicherte Substanzen im Rechner verwenden?',
        a: 'Ja. Wenn eine Substanz Wirkstoff pro Vial und Flüssigkeit gespeichert hat, kannst du sie im Rechner auswählen und die Werte automatisch übernehmen.',
      },
      {
        q: 'Was zeigt die große Zahl im Rechner?',
        a: 'Sie zeigt die berechneten Spritzeneinheiten, die du für die eingegebene Dosis aufziehen würdest.',
      },
      {
        q: 'Was bedeuten Konzentration, Gefüllt und Pro Vial?',
        a: [
          '- Konzentration: Wirkstoff pro mL nach Rekonstitution',
          '- Gefüllt: wie viel Prozent der Spritze die berechnete Dosis belegt',
          '- Pro Vial: ungefähre Anzahl Dosen aus einem Vial',
        ],
      },
      {
        q: 'Warum kann der Rechner keine medizinische Dosis empfehlen?',
        a: 'Der Rechner rechnet nur deine Eingaben um. Er entscheidet nicht, welche Dosis sinnvoll, sicher oder passend ist.',
      },
    ],
  },
  {
    id: 'injections',
    title: 'Injektionen & Rotation',
    items: [
      {
        q: 'Wofür ist der Bereich Injektionen da?',
        a: 'Der Injektionsbereich dokumentiert, welche Körperstelle du wann genutzt hast. So kannst du Stellen rotieren und Übernutzung vermeiden.',
      },
      {
        q: 'Was bedeuten die Farben der Injektionsstellen?',
        a: [
          '- Grün: frei beziehungsweise lange nicht genutzt',
          '- Gelb: kürzlich genutzt, vorsichtig planen',
          '- Rot: sehr kürzlich genutzt, besser ausweichen',
        ],
      },
      {
        q: 'Was macht "Empfohlen"?',
        a: 'Die App empfiehlt bevorzugt eine noch nie genutzte oder am längsten nicht genutzte Stelle.',
      },
      {
        q: 'Wie logge ich eine Injektionsstelle?',
        a: 'Tippe auf eine Stelle im Körperdiagramm, ergänze optional Notizen und speichere den Eintrag.',
      },
      {
        q: 'Kann ich zwischen Vorder- und Rückseite wechseln?',
        a: 'Ja. Der Bereich hat Vorder- und Rückansicht, damit Bauch, Oberschenkel, Deltoid und Gesäß getrennt dokumentiert werden können.',
      },
      {
        q: 'Kann ich einen Injektionslog löschen?',
        a: 'Ja. In der Historie kannst du Einträge entfernen, falls du dich vertippt hast.',
      },
    ],
  },
  {
    id: 'inventory',
    title: 'Lager, Vorrat & Rekonstitution',
    items: [
      {
        q: 'Was ist der Unterschied zwischen Lager und My Stack?',
        a: 'Das Lager beschreibt rohe beziehungsweise verfügbare Vials. My Stack beschreibt Substanzen, die du aktiv dokumentierst, rekonstituierst und mit Zyklen verbindest.',
      },
      {
        q: 'Was bedeutet "Rohe Vials in Reserve"?',
        a: 'Das ist der Bestand, der noch als Reserve im Lager geführt wird. Er erscheint in der Info-Leiste, wenn die Substanz mit einem Inventar-Eintrag verknüpft ist.',
      },
      {
        q: 'Was passiert beim Rekonstituieren?',
        a: 'Beim Rekonstituieren wird dokumentiert, dass ein Vial angesetzt wurde. Datum, Haltbarkeit und Vorrat können dadurch aktualisiert werden.',
      },
      {
        q: 'Was bedeutet Haltbarkeit nach Rekonstitution?',
        a: 'Die App berechnet aus Rekonstitutionsdatum und Haltbarkeit das Ablaufdatum. Die Anzeige wechselt je nach Restzeit farblich.',
      },
      {
        q: 'Was passiert, wenn die Haltbarkeit nicht gesetzt ist?',
        a: 'Dann zeigt die App Nicht gesetzt. Es wird kein verlässlicher Countdown berechnet.',
      },
      {
        q: 'Wofür sind Batch, Quelle und Analyse-Dokument?',
        a: 'Diese Felder dokumentieren Herkunft, Charge und Nachweise wie COA, Laborbericht oder Bild. Sie erscheinen in der Info-Leiste und im Detail-Sheet.',
      },
    ],
  },
  {
    id: 'reports',
    title: 'Protokoll, Fortschritt, Blutwerte & Health',
    items: [
      {
        q: 'Was macht der Bereich Protokoll?',
        a: 'Protokoll bündelt Daten aus Zyklen, Dosislogs, Gewicht, Blutwerten und Adherence zu Auswertungen und kann daraus einen PDF-Report erzeugen.',
      },
      {
        q: 'Was bedeutet "PDF generieren"?',
        a: 'Die App erstellt einen strukturierten Report für deine Dokumentation. Je nach Datenlage enthält er Zeitraum, aktive Zyklen, Charts, Blutwerte, Gewicht und Adherence.',
      },
      {
        q: 'Was ist der Share-Link im Protokoll?',
        a: 'Der Share-Link kopiert einen Link beziehungsweise eine Referenz, mit der du deinen Report oder die relevante Ansicht weiterverwenden kannst, sofern die App diese Daten bereitstellt.',
      },
      {
        q: 'Wofür sind Blutwerte?',
        a: 'Blutwerte dokumentieren Laborwerte mit Datum, Marker, Wert, Einheit und Notizen. Sie können später im Protokoll und in Verlaufsgrafiken auftauchen.',
      },
      {
        q: 'Wofür ist Fortschritt?',
        a: 'Fortschritt ist für Gewicht, Fotos und Verlauf gedacht. Er hilft, sichtbare und messbare Veränderungen über Zeit zu dokumentieren.',
      },
      {
        q: 'Was macht Health?',
        a: 'Health ist für Gesundheitsdaten und Integrationen vorgesehen. Verfügbarkeit und Umfang hängen vom Gerät, der Plattform und den Berechtigungen ab.',
      },
      {
        q: 'Warum sind manche Diagramme leer?',
        a: 'Diagramme brauchen passende Daten im gewählten Zeitraum. Wenn keine Logs, Blutwerte, Gewichtseinträge oder abgeschlossenen Zyklen vorhanden sind, bleibt die Auswertung leer.',
      },
    ],
  },
  {
    id: 'tagebuch',
    title: 'Tagebuch & Effekte',
    items: [
      {
        q: 'Wofür ist das Tagebuch?',
        a: 'Im Tagebuch dokumentierst du Wirkungen, Nebenwirkungen, Intensität, Zeitpunkt und Verlauf. Es hilft, Muster zwischen Substanz, Zyklus und Effekt zu erkennen.',
      },
      {
        q: 'Was ist der Unterschied zwischen Wirkung und Nebenwirkung?',
        a: 'Wirkung beschreibt einen gewünschten Effekt. Nebenwirkung beschreibt einen unerwünschten oder auffälligen Effekt.',
      },
      {
        q: 'Was bedeutet die Intensität?',
        a: 'Die Intensität bewertet, wie stark ein Effekt war. Sie ist eine subjektive Skala für deine spätere Auswertung.',
      },
      {
        q: 'Kann ich Einträge filtern?',
        a: 'Ja. Du kannst nach Typ, Peptid, Text, Datum oder Intensität suchen beziehungsweise sortieren, je nachdem welche Filter im Bereich aktiv sind.',
      },
      {
        q: 'Fließen Tagebuchdaten in Reports ein?',
        a: 'Ja, Tagebuchdaten können in Auswertungen und im Protokoll genutzt werden, wenn der Bereich entsprechende Daten findet.',
      },
    ],
  },
  {
    id: 'bewertungen',
    title: 'Erfahrungen & Research',
    items: [
      {
        q: 'Wofür sind Erfahrungen?',
        a: 'Erfahrungen sind persönliche, subjektive Notizen zu deinen Zyklen: wie es dir ging, mit Sternen, Wirkung, Verträglichkeit und Text. Sie sind keine Empfehlung und keine Aussage über Wirksamkeit oder Sicherheit einer Substanz.',
      },
      {
        q: 'Sind Erfahrungen öffentlich?',
        a: 'Nein, nicht automatisch. Sichtbar wird nur ein Eintrag, den du einzeln freigibst — und nur, wenn dein Profil öffentlich ist. Dosis, Zyklus und genaue Daten erscheinen nie.',
      },
      {
        q: 'Was ist The Lab?',
        a: 'The Lab ist der Research-Bereich für Studien, Suchergebnisse und Peptidinformationen. Er hilft beim Nachschlagen, ersetzt aber keine fachliche Bewertung.',
      },
      {
        q: 'Was ist die Bibliothek?',
        a: 'Die Bibliothek ist eine strukturierte Peptid-Übersicht mit Detailseiten. Sie dient als Nachschlagebereich innerhalb der App.',
      },
      {
        q: 'Kann ich Research-Inhalte direkt als Empfehlung verstehen?',
        a: 'Nein. Studien- und Bibliotheksinhalte sind Informationsmaterial und müssen fachlich eingeordnet werden.',
      },
    ],
  },
  {
    id: 'profil',
    title: 'Profil, Sprache, Theme & Teilen',
    items: [
      {
        q: 'Was kann ich im Profil einstellen?',
        a: 'Im Profil verwaltest du Accountdaten, Anzeigenamen, Benutzername, Sprache, Theme, Push-Status, öffentliches Profil und Freigaben.',
      },
      {
        q: 'Wofür ist der Benutzername?',
        a: 'Der Benutzername wird für deinen öffentlichen Profil-Link verwendet. Ohne Benutzername kann kein sauberer Share-Link erstellt werden.',
      },
      {
        q: 'Wie funktioniert das öffentliche Profil?',
        a: [
          'Du aktivierst zuerst Profil teilen.',
          'Sichtbar sind danach nur Name, Bio und die Erfahrungen, die du einzeln freigibst. Stack, Kalender und Tagebuch bleiben privat.',
          'Nicht freigegebene Bereiche bleiben privat.',
        ],
      },
      {
        q: 'Kann ich Teilen jederzeit ausschalten?',
        a: 'Ja. Wenn du Profil teilen deaktivierst und speicherst, ist der öffentliche Link nicht mehr sichtbar nutzbar.',
      },
      {
        q: 'Was macht der Kopieren-Button beim Profil-Link?',
        a: 'Er kopiert deinen öffentlichen Link in die Zwischenablage, damit du ihn teilen kannst.',
      },
      {
        q: 'Wie ändere ich Sprache oder Theme?',
        a: 'Im Profil kannst du Sprache und Darstellung umstellen. Das Theme kann je nach App-Stand System, Hell oder Dunkel verwenden.',
      },
      {
        q: 'Wie melde ich mich ab?',
        a: 'Im Profil gibt es den Abmelden-Button. Deine Daten bleiben serverseitig gespeichert und sind beim nächsten Login wieder verfügbar.',
      },
    ],
  },
  {
    id: 'technik',
    title: 'Technik, Datenschutz & Fehler',
    items: [
      {
        q: 'Wo werden meine Daten gespeichert?',
        a: 'Die App speichert Daten in Supabase. Zugriff ist nutzerbezogen abgesichert, sodass du nur deine eigenen Daten siehst.',
      },
      {
        q: 'Werden Daten gelöscht, wenn ich die App vom Handy entferne?',
        a: 'Nein. Die Daten liegen nicht nur lokal auf dem Gerät, sondern serverseitig. Nach erneutem Login sind sie wieder verfügbar.',
      },
      {
        q: 'Warum erscheint "Fehler beim Speichern"?',
        a: [
          'Typische Ursachen sind:',
          '- fehlende Pflichtfelder',
          '- keine Internetverbindung',
          '- abgelaufene Sitzung',
          '- fehlende Datenbanktabelle oder Storage-Konfiguration',
          '- blockierte Datei- oder Upload-Berechtigung',
        ],
      },
      {
        q: 'Warum kann ein Upload fehlschlagen?',
        a: 'Uploads brauchen eine stabile Verbindung und den passenden Storage-Bucket. Wenn der Bucket nicht eingerichtet ist oder die Datei blockiert wird, kann der Upload scheitern.',
      },
      {
        q: 'Warum sehe ich nach einem Update alte Daten oder altes Design?',
        a: 'Browser und PWA können alte Dateien zwischenspeichern. Lade die App neu, schließe sie komplett oder installiere die PWA neu, wenn ein Deployment noch nicht sichtbar ist.',
      },
      {
        q: 'Was bedeutet es, wenn ein Button deaktiviert ist?',
        a: 'Ein deaktivierter Button weist meist darauf hin, dass Daten fehlen oder die Aktion für diesen Eintrag nicht möglich ist, zum Beispiel Rekonst. ohne verknüpftes Inventar.',
      },
      {
        q: 'Warum können Zahlen leicht gerundet wirken?',
        a: 'Füllstand, Dosen, Einheiten und Reports werden teilweise gerundet, damit sie in der App lesbar bleiben. Für Entscheidungen solltest du immer die gespeicherten Rohdaten prüfen.',
      },
      {
        q: 'Ist die App offline nutzbar?',
        a: 'Die PWA kann Teile der App zwischenspeichern. Für Login, Speichern, Uploads, Sync, Push und aktuelle Daten wird aber eine Verbindung benötigt.',
      },
    ],
  },
]
