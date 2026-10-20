import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { DosePlanActions } from './page/DosePlanActions'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}))

describe('My Stack dose-plan actions', () => {
  test.each(['with_amount', 'complete'] as const)('renders permanent and titration actions for %s', trackingLevel => {
    const markup = renderToStaticMarkup(createElement(DosePlanActions, {
      trackingLevel,
      onPermanent: () => undefined,
      onTitration: () => undefined,
    }))

    expect(markup).toContain('Neue Standarddosis ab …')
    expect(markup).toContain('Titrationsschritt hinzufügen')
  })

  test('renders no quantity-planning actions for intake-only tracking', () => {
    const markup = renderToStaticMarkup(createElement(DosePlanActions, {
      trackingLevel: 'intake_only',
      onPermanent: () => undefined,
      onTitration: () => undefined,
    }))

    expect(markup).toBe('')
  })
})

// Die Seite ist in `page/` aufgeteilt — gelesen wird alles, was dazugehoert.
const pageParts = () => readdirSync(new URL('./page/', import.meta.url))
  .filter(name => /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name))
  .sort()
  .map(name => readFileSync(new URL(`./page/${name}`, import.meta.url), 'utf8'))

describe('My Stack page vial view', () => {
  const source = () => [
    readFileSync(new URL('./MyStackPage.tsx', import.meta.url), 'utf8'),
    ...pageParts(),
    readFileSync(new URL('./components/StackArchive.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('./services/stackItems.ts', import.meta.url), 'utf8'),
    readFileSync(new URL('./extensions/peptide/VialRenderer.tsx', import.meta.url), 'utf8'),
  ].join('\n')

  test('defaults My Stack to the vial carousel view with a persisted toggle', () => {
    const text = source()

    expect(text).toContain("tyd_peptide_view")
    expect(text).toContain("'vials'")
    expect(text).toContain("'list'")
    expect(text).toContain('setViewMode')
  })

  test('uses the reusable vial visual for the My Stack carousel', () => {
    const text = source()

    expect(text).toContain('PeptideVialVisual')
    expect(text).toContain('activePeptideId')
    expect(text).toContain('animateOnMount')
  })

  test('updates the active vial from carousel scroll position instead of direct vial taps', () => {
    const text = source()

    expect(text).toContain('vialCarouselRef')
    expect(text).toContain('handleVialCarouselScroll')
    expect(text).toContain('data-vial-index')
    expect(text).toContain('scrollIntoView')
    expect(text).not.toContain('onClick={() => setActivePeptideId(p.id)}')
  })

  test('stellt die Bühne groß und alle Objekte auf eine Standlinie', () => {
    // Die Mitte beherrscht den Bildschirm (70 % statt 25 %), die Nachbarn
    // lugen herein — zurückgesetzt über Größe, Deckkraft und Sättigung, aber
    // nicht so weit, dass man nicht mehr erkennt, WAS dort steht (vorher 0,82
    // / 45 % / 50 %). `origin-bottom` ist dabei das Entscheidende: ohne das
    // skaliert jedes Objekt um seine eigene Mitte, die Nachbarn schrumpfen
    // nach oben UND unten weg und schweben über dem Boden.
    const text = source()

    expect(text).toContain('min(17rem, 70vw)')
    expect(text).toContain('snap-center')
    expect(text).toContain('origin-bottom')
    expect(text).toContain("isActive ? 'scale-100' : 'scale-[0.88] opacity-65 saturate-75'")
  })

  test('lässt einen Wisch genau einen Eintrag weit gehen', () => {
    // Ohne `scroll-snap-stop: always` setzt der Browser den Schwung fort, bis
    // die Reibung ihn aufbraucht — ein kurzer Stups trug den Streifen über
    // drei, vier Objekte, weil der Schwung nur das Tempo kennt und nicht die
    // Absicht. Im Browser nachgemessen (402x844, echter Wischgestus): mit
    // `always` sind 40 px in 30 ms ein Schritt und 90 px in 40 ms auch einer,
    // während ein gezogener Wisch über 300 px weiterhin zwei geht.
    const text = source()

    expect(text).toContain('snap-always')
    expect(text).toContain('snap-x snap-mandatory')
  })

  test('gibt dem Fangfenster Schlupf, damit es breiter ist als ein Eintrag', () => {
    // Ohne die acht Pixel ist das Fangfenster (Streifenbreite minus diesem
    // Rand) exakt so breit wie ein Eintrag — im Browser nachgemessen: 240
    // gegen 240. Bei Gleichstand fällt das Einrasten laut Spezifikation von
    // „mittig" auf „an die Kante" zurück, und ein halbes Pixel Rundung
    // entscheidet, welche Regel gerade gilt. Genau so sah der Sprung nach dem
    // Wischen aus: 25 bis 33 px daneben, und beim nächsten Anlass zurück.
    const text = source()

    expect(text).toContain('paddingInline: `calc((100% - ${vialCarouselItemWidth}) / 2)`')
    expect(text).toContain('scrollPaddingInline: `calc((100% - ${vialCarouselItemWidth}) / 2 - 8px)`')
  })

  test('gibt einen haptischen Klick je Eintrag, den das Karussell passiert', () => {
    // An einer Stelle und nirgends sonst: jede Auswahl — Wisch, Punkt, Pfeil,
    // Rad — läuft über dieses Rollen, also fühlt sich auch jede gleich an.
    const text = source()

    expect(text).toContain("import { hapticTick } from '../../lib/haptics'")
    const scrollHandler = text.slice(text.indexOf('const handleVialCarouselScroll'), text.indexOf('const scrollToClosestVial'))
    expect(scrollHandler).toContain('void hapticTick()')
    expect(text.match(/void hapticTick\(\)/g)).toHaveLength(1)
  })

  test('sucht die Angaben nach Darreichungsform aus', () => {
    // Bei einem Pflaster standen dort drei Kacheln „Nicht gesetzt" —
    // Flüssigkeit, Angemischt am, Haltbar danach —, weil ein Pflaster nichts
    // davon kennt. Das sieht nicht nach „noch nicht ausgefüllt" aus, sondern
    // nach kaputt. Was vorkommt, entscheidet jetzt `detailAbschnitte` aus dem,
    // was die Form ohnehin über sich sagt.
    const text = source()

    expect(text).toContain('detailAbschnitte, LEER_AUSBLENDEN, wirkstoffBezug,')
    expect(text).toContain('detailAbschnitte(form).map(abschnitt => (')
    expect(text).toContain('data-stack-detail={abschnitt.id}')
    expect(text).toContain('data-stack-detail-field={feld}')
    // Und die Stärke heißt, wie die Form sie misst — „pro Vial" stimmt beim
    // Vial und sonst nirgends.
    expect(text).toContain('}[wirkstoffBezug(form)]')
  })

  test('setzt Bearbeiten und Löschen als Symbole neben das Objekt', () => {
    // Keine eigene „Verwalten"-Leiste mehr unten: die Knöpfe stehen oben
    // neben der Grafik, Bearbeiten und Löschen nur als Symbol mit Namen fuer
    // Screenreader. Das aeltere Vial-Tracking-Formular bleibt entfernt.
    const text = source()
    const aktionen = text.slice(text.indexOf('sideActions={('), text.indexOf('belowTitle={('))

    expect(text).not.toContain('data-stack-detail="verwalten"')
    expect(aktionen).toContain("aria-label={String(t('bearbeiten'))}")
    expect(aktionen).toContain("aria-label={String(t('loeschen'))}")
    expect(aktionen).toContain('<Pencil size={17} aria-hidden="true" />')
    expect(aktionen).toContain('<Trash2 size={17} aria-hidden="true" />')
    expect(text).not.toContain('> Vial-Tracking')
    // Das Löschen nach dem Bearbeiten.
    expect(aktionen.indexOf("t('loeschen')")).toBeGreaterThan(aktionen.indexOf("t('bearbeiten')"))
  })

  test('liest die Angaben durch die Leseschicht, nicht aus den Altspalten', () => {
    // Das Vollbild las `vial_amount_mg`, `batch_number`, `inventory_items` —
    // also genau die Spalten, die NUR die Tracking-Details schreiben. Ein
    // Eintrag aus dem Assistenten zeigte deshalb ueberall „Nicht gesetzt",
    // obwohl seine Angaben in `stack_item_ingredients` und
    // `stack_item_inventory` standen.
    const text = source()
    const vollbild = text.slice(
      text.indexOf('const eintragDetails'),
      text.indexOf('\n  return (', text.indexOf('const eintragDetails')),
    )

    expect(text).toContain("import { produktAngaben, type Angabe, type Zutat } from './lib/produktAngaben'")
    expect(vollbild).toContain('const angaben = produktAngaben({')
    expect(vollbild).toContain('vorratsposten: invItem')
    expect(vollbild).toContain("zyklusMethode: activeCycle?.method ?? null")

    // Keine Altspalte mehr direkt im Vollbild — sie stehen jetzt alle in
    // `produktAngaben.ts`, wo auch ihr Ersatz steht. Gemeint ist der CODE:
    // im Kommentar darueber steht `vial_amount_mg` als Begruendung.
    const code = vollbild.split('\n').filter(z => !/^\s*(\/\/|\*|\/\*)/.test(z)).join('\n')
    for (const spalte of [
      'activePeptide.vial_amount_mg', 'activePeptide.reconstitution_ml',
      'activePeptide.reconstitution_date', 'activePeptide.expiry_days',
      'activePeptide.batch_number', 'activePeptide.batch_source',
      'activePeptide.batch_file_url', 'activePeptide.default_method',
    ]) {
      expect(code, spalte).not.toContain(spalte)
    }
  })

  test('mischt ein neues Vial in der Bestand-Ansicht an, nicht im Vollbild', () => {
    // „Erneut anmischen" stand im Vollbild und war ohne Lagerposten
    // ausgegraut. Jetzt heißt es „Neues Vial anmischen" und steht im
    // Bestand, neben Rest, Flüssigkeit und Haltbarkeit.
    const text = source()

    expect(text).not.toContain('> Erneut anmischen')
    expect(text).toContain('<BestandCard')
    expect(text).not.toContain('rekonstitutieren')
  })

  test('nennt die Methode überall gleich', () => {
    // In der Info hieß dasselbe Feld „Applikationsart", im Zyklusfeld darüber
    // „Methode" — beide zeigen `default_method` beziehungsweise `method`.
    const text = source()

    // Nur im Wortlaut der Oberfläche, nicht in Kommentaren — dort steht der
    // alte Name als Begründung.
    expect(text).not.toContain("label: 'Applikationsart'")
    expect(text).toContain("applikation: String(t('methode')),")
  })

  test('setzt das Objekt mit einem Kontaktschatten auf den Boden', () => {
    // Der breite, weichgezeichnete Spot ließ es in Dunst schweben. Was
    // „steht auf etwas" macht, ist ein schmaler Schatten direkt darunter.
    const text = source()

    expect(text).toContain('data-vial-detail="carousel-contact-shadow"')
  })

  test('zeigt an, wo im Karussell man steht', () => {
    // Bei 70 % Breite sind die Nachbarn nur noch angeschnitten — ohne diese
    // Zeile weiß niemand, ob nach dem dritten Wisch noch fünf kommen.
    const text = source()

    expect(text).toContain('data-vial-position')
    expect(text).toContain('data-vial-dot={index}')
    // Ab acht Einträgen eine Leiste: fünfzehn Punkte zählt niemand mehr.
    expect(text).toContain('stagePeptides.length <= 7')
  })

  test('hält die Positionsleiste sichtbar über der Navigation', () => {
    const text = source()

    expect(text).toContain('data-vial-position className="mb-2 mt-1')
  })

  test('hält die Positionszeile gleich hoch — Punkte, Leiste oder nichts', () => {
    // Die Buehne darueber fuellt den Rest. War die Zeile mal 10 px (Punkte),
    // mal 4 px (Leiste), mal gar nicht da (ein Eintrag), wuchs und schrumpfte
    // das Vial beim Wechsel der Kategorie.
    const text = source()

    expect(text).toContain('data-vial-position className="mb-2 mt-1 flex h-2.5 shrink-0')
  })

  test('gibt jeder Darreichungsform denselben Karussellplatz und Abstand', () => {
    const text = source()

    expect(text).toContain("const vialCarouselItemWidth = 'min(17rem, 70vw)'")
    expect(text).toContain("const vialCarouselItemGap = '0.75rem'")
    expect(text).toContain("gap: vialCarouselItemGap")
    expect(text).toContain("style={{ width: vialCarouselItemWidth }}")
  })

  test('aligns the Neue Substanz tile with the vial carousel axis', () => {
    const text = source()

    expect(text).toContain('data-vial-add-slot')
    // Dieselbe Höhe wie die Standplätze der Objekte, damit die Kachel auf
    // derselben Linie steht statt daneben zu schweben.
    // Der Platz der Kachel ist gebaut wie der eines Objekts: volle Höhe,
    // unten ausgerichtet, dieselbe Zeile für den Füllstand darunter.
    expect(text).toMatch(/data-vial-add-slot[\s\S]{0,400}flex h-full min-h-0 origin-bottom shrink-0 flex-col/)

    expect(text).toContain('flex items-center')
  })

  test('keeps Neue Substanz illuminated while its carousel tile is active', () => {
    const text = source()

    expect(text).toContain('<AddStageTile')
    expect(text).toContain('active={addTileActive}')
    // Steht die Kachel in der Mitte, ist keine Substanz zugleich aktiv.
    expect(text).toContain('isActive={!addTileActive && p.id === activePeptide.id}')
  })

  test('shows the fill percentage directly under the active vial in My Stack', () => {
    const text = source()

    // still under the active item — but only for forms whose fill level says
    // something, so a sealed ampoule does not read "100 %" forever
    expect(text).toContain('mt-1 shrink-0 text-center')
    expect(text).toContain('{isActive && showsFillPct ? `${Math.round(vialPct)}%`')
  })

  test('hält die Zeile unter dem Objekt frei, auch wenn nichts darin steht', () => {
    // Ein Spray hat keinen Füllstand, ein Vial schon. Stand die Zeile nur dort,
    // wo etwas darin steht, war jeder Eintrag ohne sie eine Zeile kürzer — und
    // die Positionsleiste darunter hüpfte bei jedem Wisch mit. Reserviert wird
    // der Platz mit einem geschützten Leerzeichen.
    const text = source()

    expect(text).toContain("{isActive && showsFillPct ? `${Math.round(vialPct)}%` : '\\u00a0'}")
    expect(text).toContain('aria-hidden={isActive && showsFillPct ? undefined : true}')
    // Die alte Fassung ließ die Zeile ganz weg.
    expect(text).not.toContain('{isActive && showsFillPct && (')
  })

  test('shrinks the vial carousel and removes its surrounding frame so it can bleed edge-to-edge', () => {
    const text = source()

    expect(text).toContain('size="carousel"')
    // the outer wrapper no longer draws a bordered/tinted card around the carousel
    expect(text).not.toContain('overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40 px-2 py-5 sm:px-5')
    // the carousel row cancels the page's own horizontal padding to reach full viewport width
    expect(text).toContain('className="relative -mx-3 flex min-h-0 flex-1 flex-col"')
  })

  test('ordnet das Vollbild von „was ist das" nach „was ändere ich"', () => {
    // Vorher standen die vier Verwaltungsknöpfe ganz oben — mitsamt dem
    // Löschen, direkt unter dem Daumen, bevor man gesehen hat, was man vor
    // sich hat. Jetzt in dieser Reihenfolge: Substanz, dann der
    // formabhängige Produktabschnitt (Rekonstitution oder Bestand), dann
    // der Zyklus als Knopf, und erst zuletzt, was man am Eintrag ändert.
    const text = source()
    const platz = (s: string) => text.indexOf(s)

    // Substanz und Produkt kommen aus derselben Schleife — ihre Reihenfolge
    // untereinander liegt in `detailAbschnitte`, hier zählt, dass die
    // Schleife vor dem Zyklus steht.
    expect(platz('detailAbschnitte(form).map')).toBeGreaterThan(-1)
    expect(platz('detailAbschnitte(form).map')).toBeLessThan(platz('data-stack-detail="zyklus"'))
  })

  test('versteckt im Vollbild nichts mehr hinter einem Klappknopf', () => {
    // Wer das Vollbild öffnet, will die Angaben sehen. Der „Info"-Knopf davor
    // war eine Hürde ohne Gegenwert.
    const text = source()

    expect(text).not.toContain('vialCyclesOpen')
    expect(text).not.toContain('vialDetailsOpen')
    expect(text).not.toContain('<span>Info</span>')
  })

  test('zeigt den aktiven Zyklus als einen ruhigen Einstieg', () => {
    // Alle Einzelheiten und Aktionen gehoeren in den Zyklusverwalter. In der
    // Uebersicht bleibt nur der Name mit einem eindeutigen Weg hinein.
    const text = source()
    // Bis zum Ende genau dieses Blocks — nicht bis zum Ende aller Dateien.
    const start = text.indexOf('data-stack-detail="zyklus"')
    expect(start).toBeGreaterThan(-1)
    const knopf = text.slice(start, text.indexOf('</div>}', start))

    expect(knopf).toContain("{activeCycle.name} {t('zyklus')}")
    expect(knopf).toContain('data-active-cycle-indicator')
    expect(knopf).not.toContain('activeQuantity')
    expect(knopf).not.toContain('activeFrequency')
    expect(knopf).not.toContain('toggleCycleActive(activeCycle)')
    expect(knopf).toContain('setCycleManagerPeptide(eintrag)')

    // Zwei Leerzustände, je nachdem ob es überhaupt Zyklen gibt.
    expect(knopf).toContain("t('kein_aktiver_zyklus')")
    expect(knopf).toContain("t('noch_kein_zyklus_desc')")
    expect(knopf).toContain('openNewCycle(eintrag)')

    // Und das ausgebreitete Cockpit ist weg, nicht bloss versteckt.
    expect(text).not.toContain("t('aktiver_zyklus')")
    expect(text).not.toContain('setCycleManagerPeptide(p)')
  })

  test('supports desktop drag, wheel navigation, and vial clicks in the carousel', () => {
    const text = source()

    expect(text).toContain('handleVialCarouselPointerDown')
    expect(text).toContain('handleVialCarouselPointerMove')
    expect(text).toContain('handleVialCarouselPointerUp')
    expect(text).toContain('handleVialCarouselWheel')
    expect(text).toContain('scrollToClosestVial')
    expect(text).toContain('pushVialSlosh')
    expect(text).toContain('vialLastScrollLeftRef')
    expect(text).toContain("const vialSnapClassName = isVialCarouselDragging ? 'snap-none' : 'snap-x snap-mandatory'")
    // Waehrend des Ziehens kein Einrasten am Platz — per CSS am Streifen,
    // damit Druck und Loslassen nicht alle Objekte neu rendern.
    expect(text).toContain('data-dragging={isVialCarouselDragging || undefined}')
    expect(text).toContain('snap-center snap-always transition-all duration-300 group-data-[dragging]:[scroll-snap-align:none] group-data-[dragging]:[scroll-snap-stop:normal] group-data-[dragging]:transition-none')
    expect(text).toContain('onPointerDown={handleVialCarouselPointerDown}')
    expect(text).toContain('onPointerMove={handleVialCarouselPointerMove}')
    expect(text).toContain('onPointerUp={handleVialCarouselPointerUp}')
    expect(text).toContain('onPointerCancel={handleVialCarouselPointerUp}')
    expect(text).toContain('onWheel={handleVialCarouselWheel}')
    expect(text).toContain('selectPeptideOffset(e.deltaY > 0 ? 1 : -1)')
    expect(text).toContain('handleVialCarouselItemClick(index)')
    expect(text).toContain("isVialCarouselDragging ? 'cursor-grabbing' : 'cursor-grab'")
    expect(text).not.toContain('setPointerCapture(e.pointerId)\n    e.preventDefault()')
    const pointerMove = text.slice(
      text.indexOf('const handleVialCarouselPointerMove'),
      text.indexOf('const handleVialCarouselPointerUp'),
    )
    expect(pointerMove).not.toContain('e.preventDefault()')
    expect(text).toContain("touchAction: 'pan-x'")
    expect(text).not.toContain("touchAction: 'pan-x pan-y'")
  })

  test('keeps programmatic vial selection stable while smooth-scrolling to the target', () => {
    const text = source()
    // Plaetze statt Indizes: -1 ist die „Neu"-Kachel, 0 … n-1 die Substanzen.
    const selectHandler = text.slice(text.indexOf('const selectSlot'), text.indexOf('const getClosestSlot'))
    const scrollHandler = text.slice(text.indexOf('const handleVialCarouselScroll'), text.indexOf('const scrollToClosestVial'))
    const offsetHandler = text.slice(text.indexOf('const selectPeptideOffset'), text.indexOf('const handleVialCarouselPointerDown'))

    expect(text).toContain('vialTargetIndexRef')
    expect(selectHandler).toContain('vialTargetIndexRef.current = slot')
    expect(selectHandler).not.toContain('setActivePeptideId(next.id)')
    expect(scrollHandler).toContain('if (target === closestSlot) vialTargetIndexRef.current = null')
    // Waehrend der Fahrt gilt das Ziel — auch fuer die Kachel.
    expect(scrollHandler).toContain('target !== null && target !== closestSlot ? target === ADD_SLOT')
    expect(offsetHandler).toContain('vialTargetIndexRef.current ?? currentSlot')
  })

  test('drives the carousel liquid with the shared spring physics engine', () => {
    const text = source()

    // The page owns one engine and shares it with the vials via the provider.
    expect(text).toContain('useSloshEngine')
    expect(text).toContain('<SloshProvider engine={sloshEngine}>')
    // Interaction velocity is fed into the engine as a slosh impulse.
    expect(text).toContain('sloshEngine.pushImpulse(velocity)')
    expect(text).toContain('fillPct={vialPct}')
    // The old per-render slosh state / keyframe epoch wiring is gone.
    expect(text).not.toContain('setVialSlosh')
    expect(text).not.toContain('vialSloshEpoch')
    expect(text).not.toContain('vialSloshSettleRef')
    expect(text).not.toContain('slosh={vialSlosh}')
    expect(text).not.toContain('sloshEpoch={vialSloshEpoch}')
  })
  test('drives the carousel spotlight and vial highlights from scroll focus', () => {
    const text = source()

    expect(text).toContain('updateVialFocus')
    expect(text).toContain('data-vial-detail="carousel-spotlight"')
    // Zwischen den beiden Extremen: bei 0,78 sah keines der Objekte nach
    // Hauptdarsteller aus, bei 1,35 lagen die Nachbarn fast im Dunkeln.
    expect(text).toContain('1 - Math.abs(normalized) * 1.05')
    expect(text).toContain('Math.max(0.25,')
  })

  test('pushes scroll focus through imperative stage-light handles instead of React state', () => {
    const text = source()

    expect(text).toContain('vialStageLightHandlesRef')
    expect(text).toContain('setStageLight')
    expect(text).toContain('stageLightRef={stageLightRef}')
    expect(text).toContain('const stageLightRef = useCallback((handle: StageLightHandle | null) =>')
    // the old per-scroll-frame state update must stay gone — it re-rendered
    // the whole page on every swipe frame
    expect(text).not.toContain('vialFocusByIndex')
    expect(text).not.toContain('setVialFocusByIndex')
  })

  test('batches carousel spotlight updates so liquid slosh frames stay smooth', () => {
    const text = source()
    const scrollHandler = text.slice(text.indexOf('const handleVialCarouselScroll'), text.indexOf('const scrollToClosestVial'))

    expect(text).toContain('vialFocusFrameRef')
    expect(text).toContain('scheduleVialFocusUpdate')
    expect(scrollHandler).toContain('scheduleVialFocusUpdate()')
    expect(scrollHandler).not.toContain('updateVialFocus()')
  })

  test('zeigt die Angaben als eine gruppierte Liste, nicht als drei Fassungen derselben Daten', () => {
    // Die Angaben stehen in nach Form ausgesuchten Abschnitten; die drei
    // Fassungen derselben Daten (zwei davon `hidden`) sind weg, ebenso die
    // Kachel „Peptidname" — der Name steht auf dem Objekt darüber.
    const text = source()

    expect(text).toContain('className="lg-kv"')
    expect(text).toContain("'my_stack_stock_use_within_vial'")
    expect(text).toContain("'my_stack_stock_mixed_on'")
    expect(text).toContain("'my_stack_stock_document'")
    expect(text).not.toContain('Peptidname')
    expect(text).not.toContain('Rohe Vials in Reserve')
    expect(text).not.toContain('compactInfoRows')
    expect(text).not.toContain('moreInfoRows')
    expect(text).not.toContain('Nächste Dosis')
    expect(text).not.toContain('Zeit offen')
    const mojibakeSeparator = String.fromCharCode(0xc3, 0x201a, 0xc2, 0xb7)
    expect(text).not.toContain(`labels.join('${mojibakeSeparator}')`)
    expect(text).not.toContain("{ label: 'Farbe'")
    expect(text).not.toContain("{ label: 'Füllstand'")
    expect(text).not.toContain('Standard-Dosis')
    expect(text).not.toContain('standard_dosis_label')
    expect(text).not.toContain('Mehr Optionen')
    expect(text).not.toContain('<h3 className="truncate text-xl font-bold text-white">{p.name}</h3>')
  })

  test('behält Planstufen und Dosisanpassungen im Zyklusverwalter', () => {
    // Beides stand auf der Vollbildseite. Seit der Zyklus dort nur noch ein
    // Knopf ist, müssen sie im Verwalter stehen — nicht im Papierkorb.
    // „Stufe zurücknehmen" hängt am RPC `remove_plan_segment`; es ist eine
    // Funktion, keine tote Zeile.
    const text = source()
    // Der Verwalter steht seit der Aufteilung in einer eigenen Datei — nur
    // sie zaehlt, sonst faenden die Pruefungen dieselben Zeilen in der Liste.
    const verwalter = readFileSync(new URL('./page/LegacyCycleManager.tsx', import.meta.url), 'utf8')

    expect(text).toContain('const planStufenListe = (c: Cycle) => {')
    expect(verwalter).toContain('{planStufenListe(c)}')
    expect(verwalter).toContain('plannedQuantityRows(c)')
    expect(text).toContain('const escalationTargetQuantity = (c: Cycle, e: Escalation) => {')
    expect(verwalter).toContain('doseAdjustmentIcon(c, e)')
  })

  test('keeps the header to search, menu and add, with the archive once inside the menu', () => {
    const header = readFileSync(new URL('./page/MyStackHeader.tsx', import.meta.url), 'utf8')
    const text = source()
    const searchIndex = header.indexOf('aria-label={searchOpen ?')
    const menuIndex = header.indexOf("aria-label={t('my_stack_more_options')}")
    const archiveIndex = header.indexOf("aria-label={t('archiv')}")
    const addIndex = header.indexOf('data-my-stack-add')
    const editIndex = text.indexOf('onClick={() => openEditPeptide(activePeptide)}')
    const deleteIndex = text.indexOf('onClick={() => removePeptide(activePeptide.id)}', editIndex)

    expect(searchIndex).toBeGreaterThan(-1)
    expect(menuIndex).toBeGreaterThan(searchIndex)
    expect(archiveIndex).toBeGreaterThan(menuIndex)
    expect(addIndex).toBeGreaterThan(archiveIndex)
    // Archiv genau einmal, und nur im Menue
    expect(header.split("aria-label={t('archiv')}")).toHaveLength(2)
    expect(header.slice(menuIndex, addIndex)).toContain('{filterOpen && (')
    expect(header.slice(archiveIndex - 400, archiveIndex)).toContain('setArchiveViewOpen(true)')
    expect(header).not.toMatch(/>\s*(Ansicht|Vials|Liste)\s*</)
    expect(editIndex).toBeGreaterThan(-1)
    expect(deleteIndex).toBeGreaterThan(editIndex)
    expect(text.slice(editIndex, deleteIndex)).not.toContain("aria-label={t('archiv')}")
  })

  test('persists and localizes the archive timestamp', () => {
    const text = source()
    const service = readFileSync(new URL('./services/stackItems.ts', import.meta.url), 'utf8')
    const sql = readFileSync(new URL('../../../supabase-archive.sql', import.meta.url), 'utf8')
    const localeNames = [
      'ar', 'de', 'en', 'es', 'fr', 'hi', 'id',
      'it', 'ja', 'ko', 'pt', 'ru', 'tr', 'zh',
    ]

    expect(text).toContain('archived_at: string | null')
    expect(service).toContain('archived: true')
    expect(service).toContain('archived: false')
    expect(text).toContain(".sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? ''))")
    expect(sql).toContain('archived_at timestamptz')

    for (const localeName of localeNames) {
      const locale = JSON.parse(readFileSync(
        new URL(`../../i18n/locales/${localeName}.json`, import.meta.url),
        'utf8',
      )) as Record<string, string>

      expect(locale.archiviert_am).toContain('{{date}}')
    }
  })

  test('renders the archive as a full-screen vial list', () => {
    const text = source()

    expect(text).toContain('data-archive-fullscreen')
    expect(text).toContain('data-archive-row')
    expect(text).toContain('lg-backdrop fixed inset-0 z-50 flex min-h-dvh flex-col')
    expect(text).toContain('fillPct={0}')
    expect(text).toContain("color_hex: '#64748b'")
    expect(text).toContain('animateOnMount={false}')
    expect(text).toContain('isActive={false}')
    expect(text).toContain('size="compact"')
    expect(text).toContain("t('archiviert_am'")
    // Die Knoepfe der Zeile: 44 px rund (lg-icon-btn).
    expect(text).toContain('lg-icon-btn lg-press')
    expect(text).toContain('const language = i18n.resolvedLanguage ?? i18n.language')
    expect(text).toContain('formatInstantDay(p.archived_at, language)')
  })
  test('schreibt Daten in der Sprache der Oberflaeche, nie fest deutsch', () => {
    // „TT.MM.JJJJ" stand an vierzehn Stellen fest im Code — auch in der
    // englischen Oberflaeche. Tage laufen ueber formatLocalDay.
    const text = source()
    expect(text).not.toContain("'dd.MM.yyyy'")
    expect(text).toContain('formatLocalDay(')
  })
  test('opens complete archived substance information in a nested full-screen view', () => {
    const text = source()

    expect(text).toContain('archiveInfoPeptide')
    expect(text).toContain('data-archive-info-button={p.id}')
    expect(text).toContain('setArchiveInfoPeptide(p)')
    expect(text).toContain('data-archive-info-detail={p.id}')
    expect(text).toContain('className="lg-backdrop fixed inset-0 z-[60] flex min-h-dvh flex-col"')
    expect(text).toContain('p.vial_amount_mg')
    expect(text).toContain('p.reconstitution_ml')
    expect(text).toContain('p.syringe_type')
    expect(text).toContain('p.reconstitution_date')
    expect(text).toContain('p.expiry_days')
    expect(text).toContain('p.vials_in_stock')
    expect(text).toContain('p.batch_number')
    expect(text).toContain('p.batch_source')
    expect(text).toContain('p.batch_file_url')
    expect(text).toContain('p.notes')
    expect(text).toContain("t('keine_zyklen')")
    expect(text).toContain('c.start_date')
    expect(text).toContain('c.end_date')
    expect(text).toContain('currentQuantityLabel(c)')
    expect(text).toContain('c.frequency')
    expect(text).toContain('c.method')
  })

  test('keeps archived cycles collapsed by default and sorts newest first', () => {
    const text = source()
    const archiveDetail = text.slice(text.indexOf('{archiveInfoPeptide'), text.indexOf('{/* ══ ZYKLUS-FORMULAR'))

    expect(text).toContain('archiveCyclesOpen')
    expect(text).toContain('setArchiveCyclesOpen(false)')
    expect(archiveDetail).toContain('.filter(c => c.stack_item_id === p.id)')
    expect(archiveDetail).toContain('.sort((a, b) => b.created_at.localeCompare(a.created_at))')
    expect(archiveDetail).toContain('aria-expanded={archiveCyclesOpen}')
    expect(archiveDetail).toContain('aria-controls="archive-cycle-list"')
    expect(archiveDetail).toContain('onClick={() => setArchiveCyclesOpen(open => !open)}')
    expect(archiveDetail).toContain('{archiveCyclesOpen && (')
    expect(archiveDetail).toContain('id="archive-cycle-list"')
  })

  test('contains archive detail focus and restores it to the originating info button', () => {
    const text = source()

    expect(text).toContain("document.querySelector<HTMLElement>('[data-archive-info-detail]')")
    expect(text).toContain('const focusScope = nestedDialog ?? archiveInfoDialog ?? dialog')
    expect(text).toContain('role="dialog"')
    expect(text).toContain('aria-labelledby="archive-info-title"')
    expect(text).toContain('id="archive-info-title"')
    expect(text).toContain('ref={archiveInfoBackButtonRef}')
    expect(text).toContain('setArchiveInfoPeptide(null)')
    expect(text).toContain('document.querySelector<HTMLButtonElement>(`[data-archive-info-button="${peptideId}"]`)?.focus()')
    expect(text).toContain('document.querySelector<HTMLButtonElement>(`[data-archive-info-button="${p.id}"]`)?.focus()')
  })

  test('stops the archive flow when the peptide write fails', () => {
    const text = source()
    const archiveHandler = text.slice(text.indexOf('const archivePeptide'), text.indexOf('const hardDeletePeptide'))

    expect(archiveHandler).toContain('await archiveStackItem')
    expect(archiveHandler).toContain('if (!FEATURES.planTimelineV2)')
    expect(archiveHandler).toContain('if (error) throw error')
    expect(archiveHandler.indexOf('await archiveStackItem')).toBeLessThan(archiveHandler.indexOf("from('cycles').update"))
    const failureHandler = archiveHandler.slice(archiveHandler.indexOf('catch'), archiveHandler.indexOf('toast.success'))
    expect(failureHandler).toContain('toast.error')
    expect(failureHandler).toContain('return')
  })

  test('keeps archive-origin deletion separate from archiving again', () => {
    const text = source()

    expect(text).toContain('deletePromptFromArchive')
    expect(text).toContain('!deletePromptFromArchive && (')
    expect(text).toContain('setDeletePromptFromArchive(true); setDeletePromptPeptide(p)')
    expect(text).toContain('await archiveStackItem(supabase as never, p.id)')
  })

  test('exposes and contains the full-screen archive as an accessible dialog', () => {
    const text = source()

    expect(text).toContain('ref={archiveDialogRef}')
    expect(text).toContain('role="dialog"')
    expect(text).toContain('aria-modal="true"')
    expect(text).toContain('aria-labelledby={labelledBy}')
    expect(text).toContain('labelledBy="archive-title"')
    expect(text).toContain('id="archive-title"')
    expect(text).toContain('ref={archiveCloseButtonRef}')
    expect(text).toContain("if (e.key === 'Escape')")
    expect(text).toContain("if (e.key !== 'Tab') return")
    expect(text).toContain("document.querySelector<HTMLElement>('[data-archive-delete-confirmation]')")
    expect(text).toContain('const focusScope = nestedDialog ?? archiveInfoDialog ?? dialog')
    expect(text).toContain('if (!focusScope?.contains(document.activeElement))')
    expect(text).toContain('setDeletePromptPeptide(null); window.requestAnimationFrame(() => archiveCloseButtonRef.current?.focus())')
    expect(text).toContain('previouslyFocused?.focus()')
  })

  test('offers a mobile cycle manager from the vial cockpit', () => {
    const text = source()

    expect(text).toContain('cycleManagerPeptide')
    expect(text).toContain('setCycleManagerPeptide(eintrag)')
    expect(text).not.toContain("t('neu')")
    expect(text).toContain("t('zyklen_verwalten')")
    expect(text).toContain('toggleManagerCard(c.id)')
    expect(text).toContain('cyclesOf(cycleManagerPeptide.id)')
    expect(text).toContain('openEditCycle(cycleManagerPeptide, c.id)')
    expect(text).toContain('toggleCycleActive(c)')
    expect(text).toContain('removeCycle(c.id)')
    expect(text).toContain('openNewEsc(c)')
    expect(text).toContain('openEditEsc(c, e)')
    expect(text).toContain('removeEsc(e.id)')
    expect(text).toContain('escalationsOf(c.id)')
  })

  test('öffnet das Vollbild erst beim Tippen auf die Mitte', () => {
    // Erst wischen, dann tippen: ein Tipp auf einen Nachbarn holt ihn nur in
    // die Mitte. Sonst kostete ein Fehltipp beim Wischen einen ganzen
    // Bildschirmwechsel statt eines Schritts.
    const text = source()
    const start = text.indexOf('const handleVialCarouselItemClick =')
    const handler = text.slice(start, text.indexOf('\n  }', start))

    // `currentSlot`, nicht `activeIndex`: steht die „Neu"-Kachel in der
    // Mitte, ist auch die erste Substanz nur ein Nachbar.
    expect(handler).toContain('if (index !== currentSlot)')
    expect(handler).toContain('selectPeptideIndex(index)')
    expect(handler).toContain('oeffneVollbild(peptide, objekt)')
    expect(text).toContain('setDetailUrsprung(ursprung.getBoundingClientRect())')
  })

  test('legt die Flüssigkeitsphysik für den Flug still', () => {
    // Ein schwappendes Vial mitten im Flug wirkt falsch.
    const text = source()

    expect(text).toContain('onFlightChange={imFlug => sloshEngine.setEnabled(!imFlug)}')
  })

  test('lässt unter dem Karussell nichts als Bühne, Name und eine Zeile', () => {
    // Zyklus, Bestand, Info-Klappe und die Knopfreihe standen alle unter dem
    // Objekt — der Bildschirm war voll, bevor man irgendetwas angetippt
    // hatte. Jetzt liegen sie im Vollbild, das der Tipp öffnet.
    const text = source()

    expect(text).toContain('const eintragDetails = (eintrag: Peptide) => (')
    // Aufgerufen wird die Funktion genau einmal: im Vollbild.
    expect(text.split('eintragDetails(activePeptide)').length - 1).toBe(1)
    const sheet = text.slice(text.indexOf('<StageDetailSheet'), text.indexOf('</StageDetailSheet>'))
    expect(sheet).toContain('{eintragDetails(activePeptide)}')
  })

  test('passt das Objekt in die Fläche ein, statt es fest zu bemessen', () => {
    // Jede Form bringt eigene Pixelmaße mit: ein Pen ist bei Karussellgröße
    // 237 px hoch, eine Kapsel 92 px breit. Ein gemeinsamer Faktor gäbe es
    // nicht — derselbe, der die Kapsel füllt, schöbe den Pen über den Rand.
    const text = source()

    expect(text).toContain('className="min-h-0 w-full flex-1"')
    expect(text).toContain('targetHeightRatio={getDosageForm(p.dosage_form).stageHeightRatio ?? 1}')
  })

  test('gibt der Bühne den verbleibenden Flex-Raum statt einer geratenen Bildschirmhöhe', () => {
    // Die Seite besitzt den Viewport; Kopf, Reiter und Status sind feste
    // Zeilen, waehrend die Buehne den Rest als Flex-Flaeche bekommt. Dadurch
    // gibt es weder eine gepflegte Pixel-Summe noch vertikalen Seitenscroll.
    const text = source()

    expect(text).toContain('data-my-stack-page')
    expect(text).toContain('className={`flex h-full min-h-0 flex-col overflow-hidden')
    expect(text).toContain('data-my-stack-carousel className="flex h-full min-h-0 flex-1 flex-col"')
    expect(text).toContain('className="flex min-h-0 flex-1 flex-col pt-1"')
    expect(text).not.toContain('--buehne-hoehe')
    expect(text).not.toContain('208px')
    expect(text).not.toContain('h-[46vh]')
    expect(text).not.toContain('max-h-[26rem]')
  })

  test('gibt der Buehne die grosse Vorlage, nicht die Karussellgroesse', () => {
    // Eine CSS-Skalierung vergroessert das fertige Bild, nicht die Zeichnung:
    // Vial und Tube tragen `feGaussianBlur`, mehrere Formen laufende
    // Animationen — beides legt die Form auf eine eigene Ebene, die in ihrer
    // Layoutgroesse gerastert und danach hochgezogen wird. Mit `carousel`
    // (80–125 px) lag der Faktor bei rund 3. Mit `large` (109–589 px) liegt er
    // zwischen 0,64 und 1,3, also meist beim Verkleinern — das ist scharf.
    const text = source()
    const buehne = text.slice(text.indexOf('<StageFit'), text.indexOf('</StageFit>'))

    expect(buehne).toContain('size="large"')
    expect(buehne).not.toContain('size="carousel"')
  })

  test('zeigt alle sieben Reiter, auch die leeren, an festem Platz', () => {
    // Ein leerer Reiter „Medikamente" sagt, dass die App das auch kann. In
    // Produktion sind drei der sechs Kategorien gar nicht belegt — versteckt
    // entdeckte sie niemand. Und der Platz bleibt fest, sonst springt
    // „Medikamente" beim ersten Medikament von hinten nach vorn.
    const text = source()

    expect(text).toContain('STACK_TABS.map(reiter =>')
    expect(text).toContain('data-stack-tab={reiter.key}')
    expect(text).toContain('data-stack-tab-count={anzahl}')
    // Gezählt wird über den ganzen Stack, nicht über die gefilterte Liste —
    // sonst stünde in jedem Reiter außer dem offenen eine 0.
    expect(text).toContain('tabCounts(peptides)')
  })

  test('bietet im Reiter nur Sortierungen an, die er beantworten kann', () => {
    // Füllstand, Rekonstitution und Bestand lesen Vial-Felder. In einem
    // Reiter aus Kapseln bewegt sich nichts, und die App wirkt kaputt.
    const text = source()

    expect(text).toContain("moeglicheSortierungen.has(group.needs)")
    // Und wer nach Füllstand sortiert und dann den Reiter wechselt, landet
    // nicht auf einem Wert, den das Menü gar nicht mehr führt.
    expect(text).toContain('wirksameSortierung')
  })

  test('setzt beim Reiterwechsel ohne Effekt zurück', () => {
    // Welcher Eintrag auf der Bühne steht, fällt aus `Math.max(0, findIndex)`
    // von selbst auf den ersten des Reiters. Ein Effekt, der dasselbe noch
    // einmal per setState nachzieht, wäre eine zweite Wahrheit.
    const text = source()
    const start = text.indexOf('const reiterWechseln =')
    expect(start).toBeGreaterThan(-1)
    const handler = text.slice(start, text.indexOf('\n  }', start))

    expect(handler).toContain('setActiveTab(key)')
    expect(handler).not.toContain('setActivePeptideId')
  })

  test('schreibt einen Plan nur über den RPC, nie an ihm vorbei', () => {
    // Das eigene Zyklusformular schrieb direkt in `cycles` — ohne die
    // Prüfungen des RPC und mit einer zweiten, engeren Segmentlogik. Es kannte
    // `slot_doses`, `slot_days` und `interval_unit` nicht: ein `update` ließ
    // sie stehen, während es `intake_time` überschrieb, und die Listen liefen
    // auseinander. Dieser Test hält fest, dass es diesen Weg nicht mehr gibt.
    const text = source()

    for (const weg of ['nextScheduleHistory', 'schedKey', 'formSchedFields', 'setShowCycleForm', 'emptyCycleForm']) {
      expect(text, weg).not.toContain(weg)
    }
    // Was direkt an `cycles` geht, betrifft nur den Lebenszyklus — nie den Plan.
    for (const planfeld of ['intake_time', 'slot_doses', 'slot_days', 'schedule_history:']) {
      const schreibend = text
        .split('\n')
        .filter(zeile => zeile.includes('.update(') || zeile.includes('.insert('))
        .join('\n')
      expect(schreibend, planfeld).not.toContain(planfeld)
    }
  })

  test('führt beide Zyklus-Wege durch den Assistenten', () => {
    const text = source()
    const abschnitt = (name: string) => {
      const start = text.indexOf(`const ${name} = (`)
      expect(start, name).toBeGreaterThan(-1)
      return text.slice(start, text.indexOf('\n  }', start))
    }

    // „Plan ändern" nimmt den bestehenden Plan mit …
    expect(abschnitt('openPlanWizard')).toContain("setWizardIntent('plan')")
    expect(abschnitt('openPlanWizard')).toContain('setWizardNeuerZyklus(false)')
    expect(abschnitt('openPlanWizard')).toContain('setWizardCycleId(legacyCycleId)')
    expect(abschnitt('openEditCycle')).toContain('openPlanWizard(p, null, cycleId)')
    // … ein zweiter Zyklus nicht: ohne `p_plan.id` legt der RPC einen neuen an.
    expect(abschnitt('openNewCycle')).toContain("setWizardIntent('plan')")
    expect(abschnitt('openNewCycle')).toContain('setWizardNeuerZyklus(true)')
    expect(abschnitt('openNewCycle')).toContain('setWizardCycleId(null)')
    expect(text).not.toContain('activePlanFor')
    expect(text).toContain('cycles.find(cycle => cycle.id === wizardCycleId && cycle.stack_item_id === editingPeptideId)')
  })

  test('centers Neue Substanz field editors for mobile thumb reach', () => {
    const text = readFileSync(new URL('./components/StackItemWizard.tsx', import.meta.url), 'utf8')

    expect(text).toContain('items-end justify-center')
    expect(text).toContain('sm:items-center')
    expect(text).toContain('h-[100dvh] max-h-[100dvh]')
  })

  test('assigns a random palette color when creating a peptide', () => {
    const text = source()

    expect(text).toContain('getRandomStackItemColor')
    expect(text).toContain('setWizardInitialColor(getRandomStackItemColor())')
    expect(text).toContain('initialColorHex={wizardInitialColor}')
  })
})

describe('My Stack modular integration', () => {
  // Die Seite samt ihrer ausgelagerten Teile in page/.
  const source = () => [
    readFileSync(new URL('./MyStackPage.tsx', import.meta.url), 'utf8'),
    ...pageParts(),
  ].join('\n')
  const componentSource = (name: string) => readFileSync(
    new URL(`./components/${name}.tsx`, import.meta.url),
    'utf8',
  )

  test('uses stack item services rather than the legacy peptide table', () => {
    const text = source()
    expect(text).toContain('loadStackItems')
    expect(text).toContain('saveStackItem')
    expect(text).toContain('archiveStackItem')
    expect(text).toContain('restoreStackItem')
    expect(text).toContain('reconstituteStackItem')
    expect(text).not.toContain("from('stack_items')")
    expect(text).toContain('deleteStackItem')
    expect(text).not.toContain("from('peptides')")
    expect(text).not.toContain(".eq('peptide_id'")
    expect(text).not.toContain('peptide_id: cycleForPeptide.id')
    expect(text).not.toContain('peptide_id: cycle.stack_item_id')
    expect(text).not.toContain('function asScheduleCycle')
    expect(text).not.toContain('peptide_id: row.stack_item_id')
  })

  test('uses the neutral scheduling contract across home, calendar, insights, and vial stock', () => {
    const task10Sources = [
      readFileSync(new URL('../../pages/Home.tsx', import.meta.url), 'utf8'),
      readFileSync(new URL('../../pages/Dashboard.tsx', import.meta.url), 'utf8'),
      readFileSync(new URL('../../lib/insights.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('./extensions/peptide/vialStock.ts', import.meta.url), 'utf8'),
    ].join('\n')

    expect(task10Sources).not.toContain("from('peptides')")
    expect(task10Sources).not.toContain('peptides(name)')
    expect(task10Sources).not.toContain('peptide_id')
    expect(task10Sources).toContain("from('stack_items')")
    expect(task10Sources).toContain('stack_items(display_name)')
    expect(task10Sources).toContain('stack_item_id')
    expect(task10Sources).not.toContain('stack_item_id?:')
    expect(task10Sources).not.toContain('stack_items?:')
  })
  test('uses the feature components as real JSX boundaries', () => {
    const text = source()
    expect(text).toContain('<StackItemWizard')
    expect(text).toContain('<StackStage')
    expect(text).toContain('<StackArchive')
    expect(text).not.toContain('const myStackComponents')
    // `StackItemDetails` ist weg: es zeigte Name, Zutaten und Notizen ein
    // zweites Mal ueber dem Feldraster, aus dem neuen Modell, waehrend das
    // Raster dieselben Angaben aus den Altspalten las. Was dort einzigartig
    // war — Kategorie und Marke —, steht jetzt im Raster.
    expect(text).not.toContain('StackItemDetails')

    for (const name of ['StackArchive']) {
      const component = componentSource(name)
      expect(component).not.toContain('children: ReactNode')
      expect(component).not.toContain('return <>{children}</>')
    }
  })

  test('loads through the stack item contracts', () => {
    const text = source()
    expect(text).toContain('loadStackItems(stackDataClient as never, false)')
    expect(text).toContain('loadStackItems(supabase as never, true)')
    expect(text).toContain('onOpenExisting={openExistingStackItem}')
  })

  test('uses /my-stack as the primary route and redirects /peptide with replacement', () => {
    const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8')
    expect(app).toContain("import('./features/my-stack/MyStackPage')")
    expect(app).toContain('<Route path="my-stack" element={<LazyPage><MyStackPage /></LazyPage>} />')
    expect(app).toContain('<Route path="peptide" element={<Navigate to="/my-stack" replace />} />')
  })

  test('uses only neutral My Stack links and active-route naming in navigation', () => {
    const layout = readFileSync(new URL('../../components/Layout.tsx', import.meta.url), 'utf8')
    const tabModel = readFileSync(new URL('../../components/navigation/tabModel.ts', import.meta.url), 'utf8')
    const home = readFileSync(new URL('../../pages/Home.tsx', import.meta.url), 'utf8')

    expect(layout).toContain("path: '/my-stack#new-substance'")
    expect(tabModel).toContain("{ id: 'my-stack', route: '/my-stack'")
    expect(layout).not.toContain('/peptide')
    expect(tabModel).not.toContain("route: '/peptide'")
    expect(home).toContain("path: '/my-stack'")
    expect(home).not.toContain("path: '/peptide'")
  })

  test('removes the temporary Peptide compatibility files and source references', () => {
    expect(existsSync(new URL('../../pages/Peptide.tsx', import.meta.url))).toBe(false)
    expect(existsSync(new URL('../../pages/Peptide.test.ts', import.meta.url))).toBe(false)

    const sourceRoot = fileURLToPath(new URL('../../', import.meta.url))
    const sourceFiles: string[] = []
    const visit = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) visit(path)
        else if (
          ['.ts', '.tsx'].includes(extname(entry.name))
          && !entry.name.endsWith('.test.ts')
          && !entry.name.endsWith('.test.tsx')
        ) sourceFiles.push(path)
      }
    }
    visit(sourceRoot)

    const references = sourceFiles.filter(path =>
      /(?:from|import\()\s*\(?['"][^'"]*pages\/Peptide(?:\.tsx)?['"]/.test(readFileSync(path, 'utf8')),
    )
    expect(references).toEqual([])

    const legacyRouteReferences = sourceFiles.filter(path => !path.endsWith('App.tsx')).flatMap(path => {
      const matches = [...readFileSync(path, 'utf8').matchAll(/['"]\/peptide(?:[^'"]*)['"]/g)]
      return matches.map(match => `${path}:${match[0]}`)
    })
    expect(legacyRouteReferences).toEqual([])
  })
  test('keeps non-renderable dosage forms out of the graphical vial carousel', () => {
    const text = source()
    expect(text).toContain('const stagePeptides = displayPeptides.filter(p => isStageRenderable(p.dosage_form))')
    expect(text).toContain('stagePeptides.map((p, index) =>')
    expect(text).toContain("const listPeptides = viewMode === 'list'")
    expect(text).toContain('listPeptides.map(p =>')
    expect(text).toContain('const stageRenderable = isStageRenderable(p.dosage_form)')
  })

  test('has one way to edit an entry: the wizard, not the old vial-tracking form', () => {
    const text = source()
    expect(text).not.toContain('VialTrackingEditor')
    expect(text).not.toContain('openTrackingDetails')
    expect(text).not.toContain('saveVialTracking')
  })

  test('uses persisted item colors before the stable palette fallback', () => {
    const text = source()
    expect(text.match(/p\.color_hex \?\? getStableStackItemColor\(p\.id\)/g)).toHaveLength(2)
  })

  test('migrates active and archived local colors once, then reloads persisted active rows', () => {
    const text = source()
    const loader = text.slice(text.indexOf('const loadPeptides'), text.indexOf('const loadArchived'))

    expect(loader).toContain('if (!isLocalColorMigrationComplete(localStorage))')
    expect(loader).toContain('loadStackItems(stackDataClient as never, true)')
    expect(loader).toContain('migrateLocalColors(stackDataClient as never, [...data, ...archived], localStorage)')
    expect(loader.match(/loadStackItems\(stackDataClient as never, false\)/g)).toHaveLength(2)
  })

  test('opens duplicate matches reliably in the textual list', () => {
    const text = source()
    const handler = text.slice(text.indexOf('const openExistingStackItem'), text.indexOf('const removePeptide'))
    expect(handler).toContain("setViewMode('list')")
    expect(handler).toContain('setHervorgehobenId(item.id)')
  })
})
