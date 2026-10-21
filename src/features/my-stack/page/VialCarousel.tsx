import type { StageLightHandle } from '../stage/useStageLight'
import type { ReactNode } from 'react'
import type { SloshEngine } from '../../../components/sloshEngine'
import type { RefObject } from 'react'
import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type UIEvent as ReactUIEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SloshProvider } from '../../../components/SloshContext'
import { HaltbarkeitChip } from './HaltbarkeitChip'
import { haltbarkeitFuer } from '../lib/listRow'
import { StageFit } from '../components/StageFit'
import { StackStage } from '../components/StackStage'
import { getDosageForm } from '../lib/dosageForms'
import { getStableStackItemColor } from '../lib/colors'
import { type Peptide, type Cycle, vialCarouselItemWidth, vialCarouselItemGap, fuellstandFuer, zeigtPegel } from './model'
import { AddStageTile } from './stackTiles'
import { VialPositionRow } from './VialPositionRow'

/**
 * Einrasten und Uebergang eines Platzes im Streifen (Neu-Kachel und Objekte).
 *
 * `snap-always`: ein Wisch geht genau einen Eintrag weit. Ohne das setzt
 * der Browser den Schwung fort, bis die Reibung ihn aufbraucht — ein kurzer
 * Stups trug den Streifen ueber drei, vier Objekte, weil der Schwung nur das
 * Tempo kennt und nicht die Absicht. Wer weiter will, zieht weiter: beim
 * Ziehen gilt die Regel nicht, nur beim Ausrollen danach. Waehrend die Maus den
 * Streifen zieht (`data-dragging` am Streifen), gilt weder Einrasten noch
 * Uebergang. Das steht im CSS und nicht als Prop: sonst renderte jeder
 * Druck und jedes Loslassen alle Objekte samt Zeichnung neu.
 */
const PLATZ_BEWEGUNG = 'snap-center snap-always transition-all duration-300 group-data-[dragging]:[scroll-snap-align:none] group-data-[dragging]:[scroll-snap-stop:normal] group-data-[dragging]:transition-none'

/**
 * Die Buehne: Reiter, Kopfzeile mit Haltbarkeit und Status, das Karussell mit Neu-Kachel und Objekten, darunter die Positionszeile.
 */
export function VialCarousel({
  loading,
  viewMode,
  activePeptide,
  timeZone,
  reiterLeiste,
  selectPeptideOffset,
  addTileActive,
  cyclesOf,
  activeIndex,
  stagePeptides,
  sloshEngine,
  vialCarouselRef,
  handleVialCarouselScroll,
  handleVialCarouselPointerDown,
  handleVialCarouselPointerMove,
  handleVialCarouselPointerUp,
  handleVialCarouselWheel,
  isVialCarouselDragging,
  vialSuppressClickRef,
  handleNewPeptide,
  selectAddTile,
  handleVialCarouselItemClick,
  handleVialCarouselItemKeyDown,
  animationEpoch,
  vialStageLightHandlesRef,
  selectPeptideIndex,
}: {
  loading: boolean
  viewMode: "vials" | "list"
  activePeptide: Peptide | null
  timeZone: string
  reiterLeiste: ReactNode
  selectPeptideOffset: (offset: number) => void
  addTileActive: boolean
  cyclesOf: (pid: string) => Cycle[]
  activeIndex: number
  stagePeptides: Peptide[]
  sloshEngine: SloshEngine
  vialCarouselRef: RefObject<HTMLDivElement | null>
  handleVialCarouselScroll: (e: ReactUIEvent<HTMLDivElement>) => void
  handleVialCarouselPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
  handleVialCarouselPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void
  handleVialCarouselPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void
  handleVialCarouselWheel: (e: ReactWheelEvent<HTMLDivElement>) => void
  isVialCarouselDragging: boolean
  vialSuppressClickRef: RefObject<boolean>
  handleNewPeptide: () => void
  selectAddTile: () => void
  handleVialCarouselItemClick: (index: number) => void
  handleVialCarouselItemKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>, index: number) => void
  animationEpoch: number
  vialStageLightHandlesRef: RefObject<Map<number, StageLightHandle>>
  selectPeptideIndex: (index: number) => void
}) {
  const { t } = useTranslation()
  // Die Seite baut ihre Handler bei jedem Rendern neu. Damit die Eintraege
  // trotzdem stabil bleiben (memo), reichen wir feste Funktionen durch, die
  // immer den neuesten Handler aufrufen.
  const handlersRef = useRef({ handleVialCarouselItemClick, handleVialCarouselItemKeyDown })
  useLayoutEffect(() => {
    handlersRef.current = { handleVialCarouselItemClick, handleVialCarouselItemKeyDown }
  })
  const onItemClick = useCallback((index: number) => handlersRef.current.handleVialCarouselItemClick(index), [])
  const onItemKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>, index: number) => handlersRef.current.handleVialCarouselItemKeyDown(e, index),
    [],
  )
  const vialSnapClassName = isVialCarouselDragging ? 'snap-none' : 'snap-x snap-mandatory'
  return (
    <>
      {!loading && viewMode === 'vials' && activePeptide && (
        <div data-my-stack-carousel className="flex h-full min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col pt-1">
            {reiterLeiste}

            <div className="mb-1 flex shrink-0 items-center justify-between gap-2 px-1">
              <button
                type="button"
                onClick={() => selectPeptideOffset(-1)}
                className="stack-head-btn lg-glass lg-icon-btn shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                aria-label="Vorheriges Peptid"
              >
                <ChevronLeft size={18} />
              </button>
              {addTileActive ? (
                <span className="lg-tag" data-tone="accent">
                  {t('neues_peptid_title')}
                </span>
              ) : (() => {
                // Dieselbe Frist wie in der Liste: nach dem Anmischen oder
                // Oeffnen, sonst das Datum auf der Packung — die fruehere.
                const days = haltbarkeitFuer(activePeptide, new Date(), timeZone)?.tage ?? null
                const hasActive = cyclesOf(activePeptide.id).some(c => c.active)

                return (
                  <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5">
                    <HaltbarkeitChip tage={days} substanzId={activePeptide.id} variante="wechsel" />
                    {/* Aktiv: duenner gruener Rand wie beim Abgelaufen-Abzeichen,
                        dazu ein pulsierender Punkt — die Substanz laeuft. */}
                    {hasActive ? (
                      <span data-active-badge className="inline-flex min-h-[26px] items-center gap-2 whitespace-nowrap rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2.5 text-[13px] font-semibold leading-none text-emerald-300">
                        <span aria-hidden="true" className="tyd-active-dot" />
                        {t('aktiv_badge')}
                      </span>
                    ) : (
                      <span className="lg-tag">{t('inaktiv_badge')}</span>
                    )}
                  </div>
                )
              })()}
              <button
                type="button"
                onClick={() => selectPeptideOffset(1)}
                className="stack-head-btn lg-glass lg-icon-btn shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                aria-label="Nächstes Peptid"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="relative -mx-3 flex min-h-0 flex-1 flex-col">
              {/* Der breite, weichgezeichnete Spot ueber der ganzen
                  Flaeche liess das Objekt in Dunst schweben. Was „steht
                  auf etwas" macht, ist ein SCHMALER Schatten direkt unter
                  ihm — und ein Licht, das nur die Mitte trifft, nicht die
                  ganze Bahn. */}
              <div
                data-vial-detail="carousel-spotlight"
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-1/4 top-6 bottom-14 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.16),rgba(34,211,238,0.05)_46%,transparent_74%)] blur-2xl"
              />
              <div
                data-vial-detail="carousel-contact-shadow"
                aria-hidden="true"
                className="pointer-events-none absolute bottom-[3.25rem] left-1/2 h-3 w-[38%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.55),transparent_70%)] blur-[6px]"
              />
            <SloshProvider engine={sloshEngine}>
            <div
              data-vial-carousel-strip
              ref={vialCarouselRef}
              onScroll={handleVialCarouselScroll}
              onPointerDown={handleVialCarouselPointerDown}
              onPointerMove={handleVialCarouselPointerMove}
              onPointerUp={handleVialCarouselPointerUp}
              onPointerCancel={handleVialCarouselPointerUp}
              onWheel={handleVialCarouselWheel}
              data-dragging={isVialCarouselDragging || undefined}
              className={`group relative z-10 flex min-h-0 flex-1 ${vialSnapClassName} overflow-x-auto overflow-y-hidden overscroll-none touch-pan-x pb-2 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                isVialCarouselDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
              style={{
                gap: vialCarouselItemGap,
                // Die Vollbildbuehne besitzt nur die waagerechte Geste.
                // Vertikales Wischen darf weder die Seite verschieben
                // noch auf iOS den Gummiband-Effekt ausloesen.
                touchAction: 'pan-x',
                // Die Buehne beherrscht den Bildschirm; die Nachbarn lugen
                // nur noch herein. Damit man trotzdem weiss, wie viele es
                // sind, stehen die Punkte darunter — sie sind hier keine
                // Zierde, sondern der Ersatz fuer das, was die Breite
                // verdeckt.
                paddingInline: `calc((100% - ${vialCarouselItemWidth}) / 2)`,
                // Acht Pixel Schlupf, und zwar mit Absicht: ohne sie waere
                // das Fangfenster (Streifenbreite minus diesem Rand) genau
                // so breit wie ein Eintrag. Bei Gleichstand faellt das
                // Einrasten laut Spezifikation von „mittig" auf „an die
                // Kante" zurueck, und ein halbes Pixel Rundung entscheidet,
                // welche der beiden Regeln gerade gilt. Genau so sah der
                // Sprung aus, der nach dem Wischen kam: 25 bis 33 px
                // daneben, und beim naechsten Anlass zurueck.
                scrollPaddingInline: `calc((100% - ${vialCarouselItemWidth}) / 2 - 8px)`,
              }}
            >
              <div
                data-vial-add
                data-vial-add-slot
                // Wie ein Nachbar-Objekt gedimmt, nicht staerker: der Rand
                // der Karte soll links hereinlugen und zeigen, dass dort
                // noch etwas steht.
                className={`${PLATZ_BEWEGUNG} flex h-full min-h-0 origin-bottom shrink-0 flex-col rounded-2xl px-2 py-2 ${addTileActive ? 'scale-100' : 'scale-[0.88] opacity-65'}`}
                style={{ width: vialCarouselItemWidth }}
              >
                <AddStageTile
                  active={addTileActive}
                  title={String(t('neues_peptid_title'))}
                  hint={String(t('my_stack_add_tile_hint', { defaultValue: 'Peptid, Medikament, Hormon, Supplement …' }))}
                  onClick={() => {
                    if (vialSuppressClickRef.current) return
                    // Erst holen, dann tippen — wie bei den Objekten.
                    if (addTileActive) handleNewPeptide()
                    else selectAddTile()
                  }}
                />
              </div>
              {stagePeptides.map((p, index) => (
                <CarouselItem
                  key={p.id}
                  peptide={p}
                  index={index}
                  isActive={!addTileActive && p.id === activePeptide.id}
                  animationEpoch={animationEpoch}
                  onItemClick={onItemClick}
                  onItemKeyDown={onItemKeyDown}
                  vialStageLightHandlesRef={vialStageLightHandlesRef}
                />
              ))}
            </div>
            </SloshProvider>
            </div>

            <VialPositionRow
              stagePeptides={stagePeptides}
              activeIndex={activeIndex}
              addTileActive={addTileActive}
              selectAddTile={selectAddTile}
              selectPeptideIndex={selectPeptideIndex}
            />

          </div>
        </div>
      )}
    </>
  )
}

/**
 * Ein Objekt im Karussell. `memo`: wechselt beim Wischen die aktive Substanz,
 * rendern nur die zwei Eintraege neu, deren `isActive` sich aendert — nicht
 * alle Vials samt Zeichnung. Vorher entstand bei jedem Rendern ein neues
 * `item`-Objekt und eine neue Ref-Funktion, und jedes Vial baute sich mitten
 * im Wisch neu auf.
 */
const CarouselItem = memo(function CarouselItem({
  peptide: p,
  index,
  isActive,
  animationEpoch,
  onItemClick,
  onItemKeyDown,
  vialStageLightHandlesRef,
}: {
  peptide: Peptide
  index: number
  isActive: boolean
  animationEpoch: number
  onItemClick: (index: number) => void
  onItemKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>, index: number) => void
  vialStageLightHandlesRef: RefObject<Map<number, StageLightHandle>>
}) {
  const peptideColor = p.color_hex ?? getStableStackItemColor(p.id)
  const item = useMemo(() => ({ ...p, color_hex: peptideColor }), [p, peptideColor])
  // Der Pegel aus dem Bestand — beim Vial wie bisher (ohne Angaben „100 %"),
  // bei Spray und Tropfflasche der geoeffnete Behaelter, und nur mit
  // gefuehrtem Bestand. Eine verschlossene Ampulle stuende sonst ewig bei
  // „100 %".
  const pegel = fuellstandFuer(p)
  const vialPct = Math.round(pegel ?? 100)
  const showsFillPct = zeigtPegel(p)
  const stageLightRef = useCallback((handle: StageLightHandle | null) => {
    const handles = vialStageLightHandlesRef.current
    if (handle) handles.set(index, handle)
    else handles.delete(index)
  }, [vialStageLightHandlesRef, index])

  return (
    <div
      data-vial-index={index}
      // `origin-bottom`: alle Objekte stehen auf DERSELBEN Standlinie. Ohne
      // das skaliert jedes um seine eigene Mitte, also schrumpfen die
      // Nachbarn nach oben UND unten weg und schweben ueber dem Boden.
      className={`${PLATZ_BEWEGUNG} flex h-full min-h-0 origin-bottom shrink-0 flex-col rounded-2xl px-2 py-2 ${
        isActive ? 'scale-100' : 'scale-[0.88] opacity-65 saturate-75'
      }`}
      style={{ width: vialCarouselItemWidth }}
      aria-label={p.name}
      role="button"
      tabIndex={0}
      onClick={() => onItemClick(index)}
      onKeyDown={e => onItemKeyDown(e, index)}
    >
      {/* Eingepasst statt fest bemessen: jede Form bringt eigene Pixelmasse
          mit. `size="large"`: die Buehne ist gross, also muss die
          GEZEICHNETE Vorlage gross sein — meist wird dann verkleinert, und
          das ist immer scharf. */}
      <StageFit
        className="min-h-0 w-full flex-1"
        maxScale={1.6}
        targetHeightRatio={getDosageForm(p.dosage_form).stageHeightRatio ?? 1}
      >
        <StackStage
          key={animationEpoch}
          item={item}
          fillPct={vialPct}
          animateOnMount={true}
          isActive={isActive}
          size="large"
          stageLightRef={stageLightRef}
        />
      </StageFit>
      {/* Die Zeile steht IMMER, auch wenn nichts darin steht — sonst huepfte
          die Positionsleiste darunter bei jedem Wisch mit. */}
      <p
        className="mt-1 shrink-0 text-center text-[13px] font-semibold tabular-nums text-[var(--lg-text-3)]"
        aria-hidden={isActive && showsFillPct ? undefined : true}
      >
        {isActive && showsFillPct ? `${Math.round(vialPct)}%` : '\u00a0'}
      </p>
    </div>
  )
})
