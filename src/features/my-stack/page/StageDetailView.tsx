import type { ReactNode } from 'react'
import type { SloshEngine } from '../../../components/sloshEngine'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Pencil, RefreshCw } from 'lucide-react'
import { SloshProvider } from '../../../components/SloshContext'
import { StageDetailSheet } from '../components/StageDetailSheet'
import { type BestandEditorArt } from '../components/Bestand'
import { anbruchArt, istLoesungsVial, vorratTeile } from '../lib/bestand'
import { StackStage } from '../components/StackStage'
import { denyProps } from '../../../lib/denyFeedback'
import { getStableStackItemColor } from '../lib/colors'
import { type Peptide, fuellstandFuer } from './model'
import { haltbarkeitFuer } from '../lib/listRow'
import { HaltbarkeitChip } from './HaltbarkeitChip'
import { neuAnbrechenLabel } from '../lib/bestandLabels'

/**
 * Das Vollbild hinter einem Objekt: Plan, Bestand, Angaben — geoeffnet per FLIP aus dem Karussell oder der Liste.
 */
export function StageDetailView({
  detailUrsprung,
  peptide: activePeptide,
  closeStageDetail,
  sloshEngine,
  openEditPeptide,
  removePeptide,
  setBestandEdit,
  eintragDetails,
  rekonstitutionWiederholen,
  timeZone,
}: {
  detailUrsprung: DOMRect | null
  /** Die Substanz in der Historie — aus dem Karussell oder der Liste. */
  peptide: Peptide | null
  closeStageDetail: () => void
  sloshEngine: SloshEngine
  openEditPeptide: (p: Peptide) => void
  removePeptide: (id: string) => void
  setBestandEdit: Dispatch<SetStateAction<{ peptideId: string; editor: BestandEditorArt; } | null>>
  eintragDetails: (eintrag: Peptide) => ReactNode
  /** Aeltere Eintraege ohne gefuehrten Bestand: das Anmischdatum neu setzen. */
  rekonstitutionWiederholen: (p: Peptide) => void
  timeZone: string
}) {
  const { t } = useTranslation()
  const haltbar = activePeptide ? haltbarkeitFuer(activePeptide, new Date(), timeZone) : null
  // Ist die Frist nach dem Rekonstituieren oder Oeffnen vorbei, ist der
  // Knopf darunter genau das, was hilft — dann alarmiert er. Ein
  // abgelaufenes Packungsdatum behebt ein neuer Behaelter nicht.
  const anmischenHilft = haltbar?.anbruchAbgelaufen === true
  // Dasselbe Symbol wie sonst; im Alarm blinkt es im Takt des Abzeichens,
  // und der Knopf pulsiert leicht mit (`.tyd-alarm-knopf` in index.css).
  const knopfSymbol = (alarm: boolean) => (
    <RefreshCw size={17} aria-hidden="true" className={alarm ? 'tyd-expired-icon shrink-0 text-[var(--lg-bad-text)]' : 'shrink-0 text-[var(--lg-text-2)]'} />
  )
  return (
    <>
      {detailUrsprung && activePeptide && (
        <StageDetailSheet
          originRect={detailUrsprung}
          onClose={closeStageDetail}
          onFlightChange={imFlug => sloshEngine.setEnabled(!imFlug)}
          title={activePeptide.name}
          topLeft={<HaltbarkeitChip tage={haltbar?.tage ?? null} substanzId={activePeptide.id} />}
          sideActions={(
            <>
              {/* Nur Symbole: was ein Stift und ein Papierkorb tun, liest
                  man ohne Text. Loeschen fragt ohnehin noch einmal nach. */}
              <button
                type="button"
                onClick={() => openEditPeptide(activePeptide)}
                aria-label={String(t('bearbeiten'))}
                title={String(t('bearbeiten'))}
                className="lg-glass lg-icon-btn lg-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <Pencil size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => removePeptide(activePeptide.id)}
                aria-label={String(t('loeschen'))}
                title={String(t('loeschen'))}
                className="lg-btn-danger lg-icon-btn lg-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
            </>
          )}
          belowTitle={(() => {
            // Ein neues Vial anmischen, einen neuen Pen oder eine neue Flasche
            // anbrechen: setzt Datum und Fluessigkeit neu und verwirft auf
            // Wunsch den Rest im alten. Nur mit Bestand und vollem Behaelter.
            const art = anbruchArt(activePeptide.dosage_form)
            // Aeltere Vials haengen noch am alten Inventar statt an einem
            // gefuehrten Bestand. Fuer sie bleibt der fruehere Knopf — er
            // stand bisher auf der Listenkarte, die es so nicht mehr gibt.
            if (art === 'vial' && !activePeptide.inventory?.enabled && activePeptide.inventory_item_id) {
              return (
                <button
                  type="button"
                  onClick={() => rekonstitutionWiederholen(activePeptide)}
                  data-anmischen-alarm={anmischenHilft || undefined}
                  className={`lg-btn lg-btn-glass lg-glass lg-btn-compact w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${anmischenHilft ? 'tyd-alarm-knopf' : ''}`}
                >
                  {knopfSymbol(anmischenHilft)}
                  {neuAnbrechenLabel(t, activePeptide.dosage_form, istLoesungsVial(activePeptide.dosage_form, activePeptide.category))}
                </button>
              )
            }
            if (!art || !activePeptide.inventory?.enabled) return null
            const nichtsZuOeffnen = vorratTeile(activePeptide.inventory).voll < 1
            return (
              <button
                type="button"
                onClick={() => {
                  if (!nichtsZuOeffnen) setBestandEdit({ peptideId: activePeptide.id, editor: 'open_new' })
                }}
                {...denyProps(nichtsZuOeffnen, String(t('my_stack_open_new_locked', {
                  defaultValue: 'Nichts Ungeöffnetes mehr im Bestand.',
                })))}
                data-anmischen-alarm={(anmischenHilft && !nichtsZuOeffnen) || undefined}
                className={`lg-btn lg-btn-glass lg-glass lg-btn-compact w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] aria-disabled:opacity-40 ${anmischenHilft && !nichtsZuOeffnen ? 'tyd-alarm-knopf' : ''}`}
              >
                {knopfSymbol(anmischenHilft && !nichtsZuOeffnen)}
                {neuAnbrechenLabel(t, activePeptide.dosage_form, istLoesungsVial(activePeptide.dosage_form, activePeptide.category))}
              </button>
            )
          })()}
          stage={(
            <SloshProvider engine={sloshEngine}>
              <div style={{ width: 'min(9rem, 38vw)' }}>
                <StackStage
                  item={{ ...activePeptide, color_hex: activePeptide.color_hex ?? getStableStackItemColor(activePeptide.id) }}
                  fillPct={Math.round(fuellstandFuer(activePeptide) ?? 100)}
                  isActive
                  size="carousel"
                />
              </div>
            </SloshProvider>
          )}
        >
          {eintragDetails(activePeptide)}
        </StageDetailSheet>
      )}
    </>
  )
}
