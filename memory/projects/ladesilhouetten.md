# Ladesilhouetten — Umriss-Abdruck

Stand: 2026-10-19.

## Entschieden

- **Die Silhouette zeigt, wie die Seite bei dieser Person aussieht** — nicht
  einen allgemeinen Umriss. Beispiel aus dem Wunsch: steht in My Stack ein Pen
  vorn, steht beim Laden ein Pen da, kein Vial.
- **System statt Pflege von Hand** (Bedingung des Nutzers für Start/Home): Hat
  eine Seite geladen, vermisst `useAbdruckNehmen` (Layout.tsx) ihren sichtbaren
  Teil und legt die Kästen ab (`components/ui/umrissAbdruck.ts`). Beim nächsten
  Laden zeichnet `SeitenSilhouette` diesen Abdruck. Neue Karten, andere
  Reihenfolge, eigene Daten — alles kommt von selbst an. Gilt für jede Seite im
  App-Gerüst, auch künftige.
- **Gespeichert wird nur Geometrie** (x, y, Breite, Höhe, Radius, Art), kein
  Text, kein Inhalt. Je Seite ein Eintrag `tyd_umriss:<pfad>` in localStorage,
  Kennungen im Pfad als `:id`. Beim Abmelden (jedes `SIGNED_OUT`) gelöscht.
- **Abgenommen wird in den ersten 8 s eines Besuchs**, jeweils nach 900 ms
  Ruhe im Seitenaufbau und nie, solange eine Silhouette darin steht — so gilt
  der fertig geladene Stand, nicht was die Person danach aufklappt oder filtert.
- **Handgezeichnete Umrisse bleiben als Ersatz**: erster Besuch auf dem Gerät,
  andere Fensterbreite (±24 px), kein Speicher.
- **Abschnitte, die mitten in der Seite laden** und für den ganzen Rest stehen
  (`<Silhouette abdruck>`): Kalender-Tag, Blutwerte, Fortschritt, Training.
  Sie zeigen den Seitenabdruck ab ihrer eigenen Stelle. Nicht dort, wo unter dem
  Lader schon echter Inhalt steht (Ernährung, Blutspiegel-Übersicht,
  Home-Zeile) — der käme doppelt.
- **Seiten können mitreden**: `data-umriss-form="<form>"` zeichnet den echten
  Umriss einer Bühnenform (alle zwölf My-Stack-Renderer tragen es),
  `data-umriss-aus` nimmt ein Element heraus.

## Offen

- Ein Ladefehler kann als Abdruck hängen bleiben, bis die Seite wieder einmal
  sauber lädt. Bei Bedarf: Fehlerzustände mit `data-umriss-aus` markieren oder
  ein eigenes Signal „nicht merken".
- Kein Abdruck für Seiten außerhalb des App-Gerüsts (Rechtstexte, geteilte
  Profile) — dort gibt es auch keine Silhouette.
