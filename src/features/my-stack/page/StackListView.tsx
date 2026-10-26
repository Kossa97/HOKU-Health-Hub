import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Package, Pencil, Trash2 } from 'lucide-react'
import type { SloshEngine } from '../../../components/sloshEngine'
import { SloshProvider } from '../../../components/SloshContext'
import { StackStage } from '../components/StackStage'
import { type LoadedStackItemIngredient } from '../services/stackItems'
import { isStageRenderable } from '../lib/dosageForms'
import { getStableStackItemColor } from '../lib/colors'
import { formatAmount, stockAmountLabel } from '../lib/bestandLabels'
import { GRUPPEN, gruppeVon, haltbarkeitFuer, istAktiv, type Gruppe, type Haltbarkeit } from '../lib/listRow'
import { HaltbarkeitChip } from './HaltbarkeitChip'
import { useWischZeile } from './useWischZeile'
import { useMinuteClock } from '../lib/useMinuteClock'
import type { Translate } from '../lib/planLabels'
import { type CycleTimeline } from '../../../lib/planTimeline'
import { type Peptide, fuellstandFuer } from './model'

/**
 * Listenansicht: je Substanz eine Zeile — fuer jede Darreichungsform gleich:
 * Objekt, Name, aktiv/inaktiv, Zusammensetzung, Haltbarkeit. Mehr nicht. Ein
 * Tipp oeffnet das Vollbild wie im Karussell; dort stehen Plan, Bestand,
 * Bearbeiten und Loeschen. Nach links wischen zeigt Bearbeiten und Loeschen
 * direkt an der Zeile.
 *
 * Gegliedert nach Dringlichkeit: was abgelaufen ist oder bald ablaeuft
 * zuerst, dann die aktiven, dann die inaktiven — in jeder Gruppe in der
 * gewaehlten Sortierung. Ueberschriften nur, wenn es mehr als eine Gruppe gibt.
 *
 * Steht auch unter dem Karussell: fuer die Substanzen ohne Buehnengrafik.
 */
export function StackListView({
  loading,
  listPeptides,
  sloshEngine,
  timelinesOf,
  timelineState,
  timeZone,
  animationEpoch,
  openDetail,
  openEdit,
  remove,
  aktivAlt,
  hervorgehobenId,
  hervorhebungGesehen,
}: {
  loading: boolean
  listPeptides: Peptide[]
  sloshEngine: SloshEngine
  timelinesOf: (stackItemId: string) => CycleTimeline[]
  /** Solange die Plaene laden, sagt eine Zeile nichts ueber den Plan — statt „Kein Plan". */
  timelineState: 'ready' | 'loading' | 'error'
  timeZone: string
  animationEpoch: number
  /** Oeffnet das Vollbild; `ursprung` ist das Element, aus dem es auffliegt. */
  openDetail: (p: Peptide, ursprung: HTMLElement) => void
  /** Wischaktionen; Loeschen fragt wie im Vollbild noch einmal nach. */
  openEdit: (p: Peptide) => void
  remove: (id: string) => void
  /**
   * Ohne Plan-Zeitleiste (alter Datenpfad): die Substanzen mit aktivem
   * Zyklus. Mit Zeitleiste null — dann entscheidet der Plan selbst, und
   * pausiert zaehlt als inaktiv.
   */
  aktivAlt: ReadonlySet<string> | null
  /** Eine eben gespeicherte Substanz: die Zeile rueckt ins Bild und leuchtet kurz. */
  hervorgehobenId: string | null
  hervorhebungGesehen: () => void
}) {
  const { t } = useTranslation()
  const tr = t as Translate
  const now = useMinuteClock()
  const listRef = useRef<HTMLUListElement | null>(null)
  // Hoechstens eine Zeile steht offen; ein Tipp irgendwo schliesst sie.
  const [offeneZeile, setOffeneZeile] = useState<string | null>(null)

  // Steht die Substanz gar nicht in der Liste (ein Vial unter dem
  // Karussell, ein anderer Reiter), gilt die Hervorhebung sofort als
  // gesehen — sonst leuchtete die Zeile Minuten spaeter beim Umschalten auf.
  const hervorgehobenSichtbar = hervorgehobenId !== null && listPeptides.some(p => p.id === hervorgehobenId)
  useEffect(() => {
    if (!hervorgehobenId) return
    const zeile = hervorgehobenSichtbar
      ? listRef.current?.querySelector<HTMLElement>(`[data-list-row="${CSS.escape(hervorgehobenId)}"]`)
      : null
    if (!zeile) {
      hervorhebungGesehen()
      return
    }
    zeile.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const timer = window.setTimeout(hervorhebungGesehen, 1800)
    return () => window.clearTimeout(timer)
  }, [hervorgehobenId, hervorgehobenSichtbar, hervorhebungGesehen])

  // Ein Tipp ausserhalb der offenen Zeile schliesst sie wieder.
  useEffect(() => {
    if (!offeneZeile) return
    const schliessen = (event: PointerEvent) => {
      const ziel = event.target as Element | null
      if (ziel?.closest?.(`[data-list-row="${CSS.escape(offeneZeile)}"]`)) return
      setOffeneZeile(null)
    }
    document.addEventListener('pointerdown', schliessen)
    return () => document.removeEventListener('pointerdown', schliessen)
  }, [offeneZeile])

  // Einmal je Minute bzw. Datenstand — nicht bei jedem Wischen neu.
  const zeilen = useMemo(() => {
    const aktivVon = (p: Peptide): boolean | null => {
      if (aktivAlt) return aktivAlt.has(p.id)
      if (timelineState !== 'ready') return null
      return istAktiv(timelinesOf(p.id), now, timeZone)
    }
    const alle = listPeptides.map(p => {
      const aktiv = aktivVon(p)
      const haltbar = haltbarkeitFuer(p, now, timeZone)
      return { p, aktiv, haltbar, gruppe: gruppeVon(aktiv, haltbar) }
    })
    return GRUPPEN.flatMap(gruppe => alle.filter(zeile => zeile.gruppe === gruppe))
  }, [listPeptides, aktivAlt, timelineState, timelinesOf, now, timeZone])
  // Ueberschriften nur, wenn es mehr als eine Gruppe gibt — und erst, wenn
  // der Status feststeht; vorher stuende „Aktiv" ueber Unbekanntem.
  const mitUeberschrift = zeilen.every(zeile => zeile.aktiv !== null)
    && new Set(zeilen.map(zeile => zeile.gruppe)).size > 1

  return (
    // Eine einzige Liste, die Ueberschriften als eigene Eintraege dazwischen:
    // wechselt eine Zeile die Gruppe (die Plaene sind geladen, eine Frist
    // rueckt naeher), wandert sie nur — sie wird nicht neu aufgebaut, und
    // ihr Objekt fuellt sich nicht noch einmal.
    <ul
      ref={listRef}
      data-stack-list
      // `pb-14`: Platz fuer den schwebenden „?"-Knopf ueber der Tabbar —
      // ohne ihn lag er auf der letzten Zeile, und ihr Pfeil war verdeckt.
      className={`stack-list flex flex-col pb-14 ${!loading && listPeptides.length > 0 ? '' : 'hidden'}`}
    >
      {/* Dieselbe Physik wie die Seite: die Oberflaeche atmet, schwappt aber
          nie — hier stoesst niemand etwas an. */}
      <SloshProvider engine={sloshEngine}>
        {zeilen.map(({ p, aktiv, haltbar, gruppe }, index) => {
          const ersteDerGruppe = index === 0 || zeilen[index - 1].gruppe !== gruppe
          const letzteDerGruppe = index === zeilen.length - 1 || zeilen[index + 1].gruppe !== gruppe
          // Ohne Ueberschriften ist die ganze Liste eine Gruppe — sonst
          // stuenden zwei gerundete Flaechen ohne Titel aneinander.
          const rundOben = mitUeberschrift ? ersteDerGruppe : index === 0
          const rundUnten = mitUeberschrift ? letzteDerGruppe : index === zeilen.length - 1
          return [
            mitUeberschrift && ersteDerGruppe && (
              <li key={`gruppe-${gruppe}`} role="presentation" className={index === 0 ? 'pt-1' : 'pt-7'}>
                <h3
                  data-list-group-title={gruppe}
                  className={`lg-group-title ${gruppe === 'achtung' ? '!text-[#ff6961]' : ''}`}
                >
                  {gruppenTitel(tr, gruppe)}
                </h3>
              </li>
            ),
            <StackListRow
              key={p.id}
              p={p}
              gruppe={gruppe}
              rundOben={rundOben}
              rundUnten={rundUnten}
              aktiv={aktiv}
              haltbar={haltbar}
              animationEpoch={animationEpoch}
              hervorgehoben={hervorgehobenId === p.id}
              offen={offeneZeile === p.id}
              onOffen={offen => setOffeneZeile(offen ? p.id : null)}
              onOpen={ursprung => openDetail(p, ursprung)}
              onEdit={() => { setOffeneZeile(null); openEdit(p) }}
              onRemove={() => { setOffeneZeile(null); remove(p.id) }}
            />,
          ]
        })}
      </SloshProvider>
    </ul>
  )
}

function gruppenTitel(t: Translate, gruppe: Gruppe): string {
  if (gruppe === 'achtung') return String(t('my_stack_list_group_attention'))
  return String(t(gruppe === 'aktiv' ? 'aktiv_badge' : 'inaktiv_badge'))
}

/**
 * Woraus die Substanz besteht, fuer jede Form gleich: Menge je Bezug
 * („5 mg / 1 Vial", „500 mg / 1 Tablette", „10 mg / 3 ml"). Eine Mischung
 * nennt jeden Wirkstoff mit Namen; ein einzelner Wirkstoff, der so heisst
 * wie der Eintrag, braucht seinen Namen nicht noch einmal.
 */
function zusammensetzungText(t: Translate, p: Peptide, language: string): string | null {
  const zutaten = p.ingredients as LoadedStackItemIngredient[]
  const teile = zutaten.map(zutat => {
    const name = zutat.custom_name || zutat.substance_catalog?.canonical_name || null
    const menge = zutat.amount_value != null && zutat.amount_unit
      ? [
        `${formatAmount(zutat.amount_value, language)} ${zutat.amount_unit}`,
        zutat.basis_value != null && zutat.basis_unit ? stockAmountLabel(t, zutat.basis_value, zutat.basis_unit, language) : null,
      ].filter(Boolean).join(' / ')
      : null
    const mitNamen = zutaten.length > 1 || (name !== null && name.toLowerCase() !== p.name.toLowerCase())
    return [mitNamen ? name : null, menge].filter(Boolean).join(' ')
  }).filter(Boolean)
  if (teile.length > 0) return teile.join(' · ')
  // Aeltere Eintraege kennen nur die Vial-Spalten.
  if (p.vial_amount_mg) return `${formatAmount(p.vial_amount_mg, language)} ${p.vial_amount_unit ?? 'mg'}`
  return null
}

/**
 * Passt das Objekt in die Zeile. Die Formen haben in der Mini-Groesse sehr
 * verschiedene Masse — ein Pen ist fast 100 px hoch, ein Pflaster 18 px —,
 * also wird gemessen und verkleinert, nie vergroessert. Direkt am Element
 * statt ueber den Zustand: das Messen loest kein zweites Rendern aus.
 */
function Eingepasst({ children }: { children: ReactNode }) {
  const boxRef = useRef<HTMLSpanElement | null>(null)
  const innenRef = useRef<HTMLSpanElement | null>(null)
  useLayoutEffect(() => {
    const box = boxRef.current
    const innen = innenRef.current
    if (!box || !innen) return
    const einpassen = () => {
      const breite = innen.offsetWidth
      const hoehe = innen.offsetHeight
      if (!breite || !hoehe) return
      const faktor = Math.min(1, box.clientWidth / breite, box.clientHeight / hoehe)
      innen.style.transform = faktor < 1 ? `scale(${faktor})` : ''
    }
    einpassen()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(einpassen)
    ro.observe(innen)
    return () => ro.disconnect()
  }, [])
  return (
    <span ref={boxRef} className="flex h-full w-full items-center justify-center">
      <span ref={innenRef} className="inline-flex shrink-0">{children}</span>
    </span>
  )
}

/**
 * Wie bei iOS: zuerst kommt das Symbol (blass und klein, dann ganz), die
 * Beschriftung erst, wenn sie Platz hat — nie abgeschnitten.
 */
const AKTION_SYMBOL: CSSProperties = {
  opacity: 'var(--wisch-fortschritt, 0)',
  transform: 'scale(calc(0.6 + 0.4 * var(--wisch-fortschritt, 0)))',
}
const AKTION_TEXT: CSSProperties = {
  opacity: 'clamp(0, calc((var(--wisch-fortschritt, 0) - 0.8) * 5), 1)',
}

function StackListRow({
  p,
  gruppe,
  rundOben,
  rundUnten,
  aktiv,
  haltbar,
  animationEpoch,
  hervorgehoben,
  offen,
  onOffen,
  onOpen,
  onEdit,
  onRemove,
}: {
  p: Peptide
  gruppe: Gruppe
  /** Erste bzw. letzte Zeile ihrer Flaeche: dort ist sie gerundet. */
  rundOben: boolean
  rundUnten: boolean
  /** null, solange die Plaene laden — dann sagt die Zeile nichts dazu. */
  aktiv: boolean | null
  haltbar: Haltbarkeit | null
  animationEpoch: number
  hervorgehoben: boolean
  /** Ob die Wischaktionen offen stehen. */
  offen: boolean
  onOffen: (offen: boolean) => void
  onOpen: (ursprung: HTMLElement) => void
  onEdit: () => void
  onRemove: () => void
}) {
  const { t, i18n } = useTranslation()
  const tr = t as Translate
  const language = i18n.resolvedLanguage ?? i18n.language
  const objektRef = useRef<HTMLSpanElement | null>(null)
  const { zeileRef, vorneRef, aktionenRef, klickVerschlucken } = useWischZeile({ offen, onOffen, onVoll: onRemove })

  const stageRenderable = isStageRenderable(p.dosage_form)
  const farbe = p.color_hex ?? getStableStackItemColor(p.id)
  const zusammensetzung = zusammensetzungText(tr, p, language)

  return (
    <li
      ref={zeileRef}
      data-list-row={p.id}
      data-list-group={gruppe}
      data-list-active={aktiv === null ? undefined : String(aktiv)}
      data-list-open={offen || undefined}
      // Gruppierte Liste wie in iOS: eine Flaeche je Gruppe, gerundet an
      // ihrer ersten und letzten Zeile, Trennlinien dazwischen (stack-glass.css).
      data-list-first={rundOben || undefined}
      data-list-last={rundUnten || undefined}
      data-list-highlight={hervorgehoben || undefined}
      className="stack-list-row relative touch-pan-y select-none overflow-hidden"
    >
      {/* Unter der Zeile: die beiden Aktionen. Ihre Breite folgt dem Finger
          (gesetzt in `useWischZeile`), Symbol und Text blenden mit dem
          Fortschritt auf. Ganz durchgewischt (`data-voll`) nimmt „Loeschen"
          die ganze Breite. Per Tastatur erreichbar nur, wenn die Zeile offen
          steht — sonst ist das Vollbild der Weg dorthin. */}
      <div
        ref={aktionenRef}
        data-list-actions
        aria-hidden={!offen || undefined}
        className="group/aktionen invisible absolute inset-y-0 right-0 flex w-0 overflow-hidden"
      >
        <button
          type="button"
          tabIndex={offen ? 0 : -1}
          onClick={() => { if (!klickVerschlucken()) onEdit() }}
          aria-label={String(t('bearbeiten'))}
          className="flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 overflow-hidden whitespace-nowrap bg-[#0a84ff] text-[12px] font-semibold text-white transition-[flex-grow] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white group-data-[voll]/aktionen:grow-0"
        >
          <span className="flex flex-col items-center gap-1">
            <Pencil size={17} aria-hidden="true" style={AKTION_SYMBOL} />
            <span style={AKTION_TEXT}>{t('bearbeiten')}</span>
          </span>
        </button>
        <button
          type="button"
          tabIndex={offen ? 0 : -1}
          onClick={() => { if (!klickVerschlucken()) onRemove() }}
          aria-label={String(t('loeschen'))}
          data-list-delete
          // Ganz durchgewischt wandert die Aufschrift an die linke Kante —
          // dorthin, wo der Finger ist.
          className="flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 group-data-[voll]/aktionen:items-start group-data-[voll]/aktionen:pl-7 overflow-hidden whitespace-nowrap bg-[#ff453a] text-[12px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
        >
          <span className="flex flex-col items-center gap-1">
            <Trash2 size={17} aria-hidden="true" style={AKTION_SYMBOL} />
            <span style={AKTION_TEXT}>{t('loeschen')}</span>
          </span>
        </button>
      </div>

      <button
        ref={vorneRef}
        type="button"
        aria-label={String(t('my_stack_list_open', { name: p.name }))}
        onClick={event => {
          if (klickVerschlucken()) return
          // Offen: ein Tipp schliesst nur — kein Vollbild aus Versehen.
          if (offen) { onOffen(false); return }
          onOpen(objektRef.current ?? event.currentTarget)
        }}
        // `select-none` und kein Callout: langes Halten beim Wischen markiert
        // nichts und oeffnet kein Menue.
        className="relative flex w-full min-w-0 touch-pan-y select-none items-center gap-3 bg-[var(--lg-surface-fill)] py-2.5 pl-3 pr-3 text-left [-webkit-touch-callout:none] active:bg-[#2c2c2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300"
      >
        {/* Feste Flaeche: das Objekt wird hineingepasst, nicht umgekehrt. */}
        <span ref={objektRef} data-list-object className="flex h-14 w-11 shrink-0">
          {stageRenderable ? (
            <Eingepasst>
              <StackStage
                key={animationEpoch}
                item={{ ...p, color_hex: farbe }}
                fillPct={fuellstandFuer(p) ?? 100}
                animateOnMount={true}
                isActive={false}
                size="mini"
                showLabel={false}
              />
            </Eingepasst>
          ) : (
            <span className="m-auto grid h-10 w-10 place-items-center rounded-xl bg-[var(--lg-fill)] text-[var(--lg-text-3)]">
              <Package size={18} aria-hidden="true" />
            </span>
          )}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[17px] font-semibold text-[var(--lg-text)]">{p.name}</span>
            {aktiv !== null && (
              <span
                data-list-status={aktiv ? 'aktiv' : 'inaktiv'}
                data-tone={aktiv ? 'good' : undefined}
                className="lg-tag ml-auto shrink-0"
              >
                {aktiv ? t('aktiv_badge') : t('inaktiv_badge')}
              </span>
            )}
          </span>
          {zusammensetzung && (
            <span className="line-clamp-2 text-[14px] text-[var(--lg-text-2)]">{zusammensetzung}</span>
          )}
          {/* Wie im Karussell: dasselbe Abzeichen, dieselbe Frist. */}
          <span className="mt-0.5 flex">
            <HaltbarkeitChip tage={haltbar?.tage ?? null} substanzId={p.id} />
          </span>
        </span>

        <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-[var(--lg-text-4)]" />
      </button>
    </li>
  )
}
