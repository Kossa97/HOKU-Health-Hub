import type { StageLightHandle } from '../stage/useStageLight'
import type { ReactNode } from 'react'
import type { SloshEngine } from '../../../components/sloshEngine'
import type { RefObject } from 'react'
import {
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
import { anbruchArt } from '../lib/bestand'
import { getStableStackItemColor } from '../lib/colors'
import { type Peptide, type Cycle, vialCarouselItemWidth, vialCarouselItemGap, fuellstandFuer } from './model'
import { AddStageTile } from './stackTiles'
import { VialPositionRow } from './VialPositionRow'

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
  const vialSnapClassName = isVialCarouselDragging ? 'snap-none' : 'snap-x snap-mandatory'
  /**
   * `snap-always`: ein Wisch geht genau einen Eintrag weit.
   *
   * Ohne das setzt der Browser den Schwung fort, bis die Reibung ihn
   * aufbraucht — ein kurzer Stups trug den Streifen ueber drei, vier Objekte,
   * weil der Schwung nur das Tempo kennt und nicht die Absicht.
   * `scroll-snap-stop: always` verbietet ihm, einen Standplatz zu
   * ueberfliegen. Wer weiter will, zieht weiter: beim Ziehen gilt die Regel
   * nicht, nur beim Ausrollen danach.
   */
  const vialItemSnapClassName = isVialCarouselDragging ? '' : 'snap-center snap-always'
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
                    <span className="lg-tag" data-tone={hasActive ? 'good' : undefined}>
                      {hasActive ? t('aktiv_badge') : t('inaktiv_badge')}
                    </span>
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
              className={`relative z-10 flex min-h-0 flex-1 ${vialSnapClassName} overflow-x-auto overflow-y-hidden overscroll-none touch-pan-x pb-2 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
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
                className={`${vialItemSnapClassName} flex h-full min-h-0 origin-bottom shrink-0 flex-col rounded-2xl px-2 py-2 ${
                  isVialCarouselDragging ? 'transition-none' : 'transition-all duration-300'
                } ${addTileActive ? 'scale-100' : 'scale-[0.88] opacity-65'}`}
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
              {stagePeptides.map((p, index) => {
                // Steht die Kachel in der Mitte, ist keine Substanz aktiv.
                const isActive = !addTileActive && p.id === activePeptide.id
                const peptideColor = p.color_hex ?? getStableStackItemColor(p.id)
                // Der Pegel aus dem Bestand — beim Vial wie bisher (ohne
                // Angaben „100 %"), bei Spray und Tropfflasche der geoeffnete
                // Behaelter, und nur mit gefuehrtem Bestand. Eine
                // verschlossene Ampulle stuende sonst ewig bei „100 %".
                const pegel = fuellstandFuer(p)
                const vialPct = Math.round(pegel ?? 100)
                const showsFillPct = pegel !== null || anbruchArt(p.dosage_form) === 'vial'

                return (
                  <div
                    key={p.id}
                    data-vial-index={index}
                    // `origin-bottom`: alle Objekte stehen auf DERSELBEN
                    // Standlinie. Ohne das skaliert jedes um seine eigene
                    // Mitte, also schrumpfen die Nachbarn nach oben UND
                    // unten weg und schweben ueber dem Boden. Beim
                    // Formular-Karussell war das laengst entschieden; hier
                    // fehlte es, und bei 70 % Breite faellt es auf.
                    className={`${vialItemSnapClassName} flex h-full min-h-0 origin-bottom shrink-0 flex-col rounded-2xl px-2 py-2 ${
                      isVialCarouselDragging ? 'transition-none' : 'transition-all duration-300'
                    } ${
                      isActive ? 'scale-100' : 'scale-[0.88] opacity-65 saturate-75'
                    }`}
                    style={{ width: vialCarouselItemWidth }}
                    aria-label={p.name}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleVialCarouselItemClick(index)}
                    onKeyDown={e => handleVialCarouselItemKeyDown(e, index)}
                  >
                    {/* Eingepasst statt fest bemessen: jede Form bringt
                        eigene Pixelmasse mit — ein Pen ist 589 px hoch,
                        eine Kapsel 364 px breit. `StageFit` misst und
                        skaliert, damit beide die Flaeche fuellen, ohne
                        dass in elf Dateien elf neue Zahlen stehen.

                        `size="large"` und nicht `carousel`: die Buehne ist
                        gross, also muss die GEZEICHNETE Vorlage gross
                        sein. Mit `carousel` (80–125 px) lag der Faktor bei
                        rund 3 — und eine CSS-Skalierung vergroessert nicht
                        die Zeichnung, sondern das fertige Bild: laufende
                        Animationen und SVG-Filter (`feGaussianBlur` in
                        Vial und Tube) legen die Form auf eine eigene
                        Ebene, die in ihrer Layoutgroesse gerastert und
                        danach hochgezogen wird. Dazu ist die kleine
                        Zeichnung fuer klein entworfen: 1-px-Linien werden
                        zu 3-px-Balken, der Schriftanteil ist zu fett. Mit
                        `large` liegt der Faktor zwischen 0,64 (Pen) und
                        1,3 (Vial) — meist also VERKLEINERN, und das ist
                        immer scharf. Die Groesse auf dem Schirm aendert
                        sich nicht: eingepasst wird in dieselbe Flaeche. */}
                    <StageFit
                      className="min-h-0 w-full flex-1"
                      maxScale={1.6}
                      targetHeightRatio={getDosageForm(p.dosage_form).stageHeightRatio ?? 1}
                    >
                      <StackStage
                        key={animationEpoch}
                        item={{ ...p, color_hex: peptideColor }}
                        fillPct={vialPct}
                        animateOnMount={true}
                        isActive={isActive}
                        size="large"
                        stageLightRef={handle => {
                          const handles = vialStageLightHandlesRef.current
                          if (handle) handles.set(index, handle)
                          else handles.delete(index)
                        }}
                      />
                    </StageFit>
                    {/* Die Zeile steht IMMER, auch wenn nichts darin steht.
                        Sonst waere jeder Eintrag ohne Fuellstand — ein
                        Spray, ein Pflaster — eine Zeile kuerzer als einer
                        mit, und die Positionsleiste darunter huepfte bei
                        jedem Wisch mit. Reserviert wird der Platz mit
                        einem geschuetzten Leerzeichen; fuer die Vorlesung
                        ist die leere Zeile ausgeblendet. */}
                    <p
                      className="mt-1 shrink-0 text-center text-[13px] font-semibold tabular-nums text-[var(--lg-text-3)]"
                      aria-hidden={isActive && showsFillPct ? undefined : true}
                    >
                      {isActive && showsFillPct ? `${Math.round(vialPct)}%` : '\u00a0'}
                    </p>
                  </div>
                )
              })}
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
