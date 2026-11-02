/**
 * Profilkarte „Gesamtfortschritt“ (Teilprojekt 2b, Variante 1): große
 * Leitzahl mit Vorzeichen, darunter die fünf Bereiche als Balken um eine
 * Nulllinie — rechts besser, links schlechter, die Skala wächst mit. Kein
 * Ring: der Wert kann über 100 % gehen und negativ sein.
 *
 * Eigene Sicht (`values` gesetzt): Bereichszeile antippen klappt ihre Werte
 * auf, Werte ohne Baseline „wartet“; die Karte selbst öffnet Zeitreise und
 * Aufschlüsselung. Fremde Sicht: nur Gesamt und Bereiche, nichts aufklappbar.
 */
import { useState, type MouseEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { PROGRESS_AREAS, type ProgressArea, type ProgressValueResult } from '../lib/progressScore'
import { AREA_COLOR, areaName, barScale, formatDay, formatPct, metricName, startToNow } from '../lib/progressFormat'

export interface FortschrittZusammenfassung {
  total: number | null
  areas: Partial<Record<ProgressArea, number | null>>
  since: string | null
}

export function FortschrittKarte({ summary, values, exerciseNames, chip, onOpen }: {
  summary: FortschrittZusammenfassung
  /** Nur eigene Sicht: Einzelwerte zum Aufklappen. */
  values?: readonly ProgressValueResult[]
  exerciseNames?: Record<string, string>
  chip?: ReactNode
  onOpen?: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n?.language || 'de'
  const [offen, setOffen] = useState<ProgressArea | null>(null)
  const own = values !== undefined
  const withValue = PROGRESS_AREAS.filter(a => summary.areas[a] != null)
  // Eigene Sicht: auch Bereiche, die noch sammeln („wartet“); fremde nur Bereiche mit Zahl
  const rows = own ? PROGRESS_AREAS.filter(a => summary.areas[a] != null || values.some(v => v.area === a)) : withValue
  const scale = barScale(withValue.map(a => summary.areas[a] as number))
  const zero = (-scale.lo / (scale.hi - scale.lo)) * 100
  const at = (v: number) => ((v - scale.lo) / (scale.hi - scale.lo)) * 100

  const kartenKlick = (event: MouseEvent) => {
    if (!onOpen || (event.target as HTMLElement).closest('button, a')) return
    onOpen()
  }

  return (
    <section
      className={`card mb-3 min-w-0 ${onOpen ? 'cursor-pointer' : ''}`}
      data-progress-card
      aria-labelledby="profil-karte-fortschritt"
      onClick={kartenKlick}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <h2 id="profil-karte-fortschritt" className="min-w-0 truncate text-[17px] font-semibold text-[var(--lg-text)]">{t('profil_feld_progress')}</h2>
        {chip}
      </div>

      {summary.total === null ? (
        <div data-progress-empty>
          <p className="text-[22px] font-semibold leading-tight text-[var(--lg-text)]">{t('pf_zu_wenig')}</p>
          <p className="mt-1 text-[13px] leading-snug text-[var(--lg-text-3)]">{t('pf_zu_wenig_text')}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2.5">
            <span className="text-[44px] font-semibold leading-none tracking-tight tabular-nums text-[var(--lg-text)]" data-progress-total>
              {formatPct(summary.total, locale)}
            </span>
            <span className="text-[14px] text-[var(--lg-text-2)]">{t(summary.total < 0 ? 'pf_negativ' : 'pf_positiv')}</span>
          </div>
          <p className="mt-1.5 text-[13px] text-[var(--lg-text-3)]" data-progress-since>
            {summary.since ? t('pf_seit_mittel', { datum: formatDay(summary.since, locale), n: withValue.length }) : null}
          </p>
        </>
      )}

      {rows.length > 0 && (
        <ul className="mt-3.5 flex flex-col" data-progress-areas>
          {rows.map(area => {
            const v = summary.areas[area] ?? null
            const zeile = (
              <>
                <span className="flex min-w-0 items-center gap-2 text-[14px] text-[var(--lg-text)]">
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: AREA_COLOR[area] }} />
                  <span className="min-w-0 leading-tight">{areaName(area, t)}</span>
                </span>
                <span className="relative h-2.5" aria-hidden="true">
                  <span className="absolute inset-y-[-3px] w-px bg-[var(--lg-text-4)]" style={{ left: `${zero}%` }} />
                  {v !== null && (
                    <span
                      className="absolute inset-y-0 rounded-[4px]"
                      style={{
                        left: `${Math.min(at(v), zero)}%`,
                        width: `${Math.max(Math.abs(at(v) - zero), 0.8)}%`,
                        background: AREA_COLOR[area],
                      }}
                    />
                  )}
                </span>
                <span className="text-right text-[14px] font-semibold tabular-nums text-[var(--lg-text)]" data-progress-area-value>
                  {v === null ? <span className="font-normal text-[var(--lg-text-3)]">{t('pf_wartet')}</span> : formatPct(v, locale)}
                </span>
              </>
            )
            const grid = 'grid min-h-11 w-full grid-cols-[minmax(0,36%)_1fr_68px] items-center gap-2.5 text-left'
            return (
              <li key={area} data-progress-area={area}>
                {own ? (
                  <button
                    type="button"
                    className={grid}
                    aria-expanded={offen === area}
                    aria-label={`${areaName(area, t)}: ${v === null ? t('pf_wartet') : formatPct(v, locale)} — ${t('pf_bereich_aufklappen')}`}
                    onClick={() => setOffen(o => (o === area ? null : area))}
                    data-progress-area-toggle={area}
                  >
                    {zeile}
                  </button>
                ) : (
                  <div className={grid}>{zeile}</div>
                )}
                {own && offen === area && (
                  <WerteListe values={values.filter(x => x.area === area)} exerciseNames={exerciseNames} />
                )}
              </li>
            )
          })}
        </ul>
      )}

      {withValue.length > 0 && (
        <div className="grid grid-cols-[minmax(0,36%)_1fr_68px] gap-2.5" aria-hidden="true">
          <span />
          <span className="relative h-4 text-[10.5px] tabular-nums text-[var(--lg-text-3)]">
            {/* Linke Marke nur bei echten Rückschritten und mit Platz, sonst stößt sie an die 0 */}
            {[...(scale.lo < 0 && zero >= 16 && withValue.some(a => (summary.areas[a] as number) < 0) ? [scale.lo] : []), 0, scale.hi / 2, scale.hi].map(x => (
              <span key={x} className="absolute -translate-x-1/2" style={{ left: `${at(x)}%` }}>
                {x === 0 ? '0' : formatPct(x, locale, 0).replace(' %', '')}
              </span>
            ))}
          </span>
          <span />
        </div>
      )}

      <p className="mt-2 text-[12.5px] leading-snug text-[var(--lg-text-3)]">
        {t('pf_skala_hinweis')}{own ? ` ${t('pf_tippe_bereich')}` : ''}
      </p>

      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="mt-2 -mb-1 inline-flex min-h-11 items-center gap-0.5 text-[14px] font-semibold text-[var(--lg-accent-text)]"
          data-progress-open
        >
          {t('pf_oeffnen')} <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}
    </section>
  )
}

/** Werte eines Bereichs: Start → jetzt und Prozent; ohne Baseline „wartet“, ausgeschlossene „aus“. */
function WerteListe({ values, exerciseNames }: { values: readonly ProgressValueResult[]; exerciseNames?: Record<string, string> }) {
  const { t, i18n } = useTranslation()
  const locale = i18n?.language || 'de'
  return (
    <ul className="mb-2 ml-1 flex flex-col gap-1 border-l border-[var(--lg-separator)] py-1 pl-3" data-progress-values>
      {values.map(v => {
        const wert = v.baseline.status === 'collecting'
          ? t('pf_wartet')
          : v.direction === 'off' ? t('pf_richtung_off') : v.change === null ? '–' : formatPct(v.change, locale)
        const verlauf = v.baseline.status === 'counts' ? startToNow(v, locale) : null
        return (
          <li key={v.id} className="flex items-baseline justify-between gap-3 text-[13px]" data-progress-value={v.id}>
            <span className="min-w-0 text-[var(--lg-text-2)]">
              {metricName(v.id, t, exerciseNames, locale)}
              {verlauf && <span className="text-[var(--lg-text-3)]"> {verlauf}</span>}
            </span>
            <span className={`shrink-0 tabular-nums ${v.change === null ? 'text-[var(--lg-text-3)]' : 'font-semibold text-[var(--lg-text)]'}`}>{wert}</span>
          </li>
        )
      })}
    </ul>
  )
}
