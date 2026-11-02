import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { GlassSegmented } from '../components/ui/GlassSegmented'
import { Sheet } from '../features/compliance/components/Sheet'
import { Zeitreise } from '../features/profil/components/Zeitreise'
import { Leiste } from '../features/profil/components/ProfilLeiste'
import { useEigenerFortschritt } from '../features/profil/hooks/useEigenerFortschritt'
import {
  PROGRESS_AREAS, allowedDirections, defaultDirection, type Direction, type ProgressValueResult,
} from '../features/profil/lib/progressScore'
import { areaName, baselineText, formatDay, formatPct, metricName, startToNow } from '../features/profil/lib/progressFormat'
import type { BadgeId } from '../features/profil/lib/badgeIds'

/**
 * Gesamtfortschritt im Detail (Teilprojekt 2b, `/profil/fortschritt`): oben
 * die Zeitreise, darunter je Bereich das Mittel und je Wert Start → jetzt,
 * Prozent und die Richtung (↓ runter / ↑ hoch / aus; Anteilswerte Zielbereich
 * / aus). Eine geänderte Richtung rechnet sofort neu. „Neuen Start setzen“
 * fragt nach; der alte Start bleibt und lässt sich wieder wählen.
 */

const Gruppe = ({ titel, rechts, children, ...data }: { titel: string; rechts?: ReactNode; children: ReactNode } & Record<`data-${string}`, string | boolean>) => (
  <section className="mt-5" {...data}>
    <div className="mb-1.5 flex items-baseline justify-between gap-3 px-4">
      <p className="lg-group-title !m-0 !p-0">{titel}</p>
      {rechts}
    </div>
    {children}
  </section>
)

export function ProfilFortschritt() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const locale = i18n?.language || 'de'
  const { fortschritt, busy, setDirection, setNewStart, restoreStart } = useEigenerFortschritt(user?.id)
  const [fragen, setFragen] = useState(false)

  if (fortschritt.status === 'laden') {
    return (
      <div data-progress-page>
        <Leiste titel={t('profil_feld_progress')} />
        <div className="h-[320px] animate-pulse rounded-[24px] bg-[var(--lg-surface-2)]" aria-busy="true" />
      </div>
    )
  }
  if (fortschritt.status === 'fehler') {
    return (
      <div data-progress-page>
        <Leiste titel={t('profil_feld_progress')} />
        <div className="card text-center" role="alert"><p className="text-[15px] text-[var(--lg-text-2)]">{t('pf_laden_fehler')}</p></div>
      </div>
    )
  }

  const { state, data } = fortschritt
  const { setup, result } = state
  const startOn = setup?.startOn ?? null
  const badges = (Object.entries(state.badges.earned) as [BadgeId, string][]).map(([id, on]) => ({ id, on }))

  const neuerStart = async () => {
    const ok = await setNewStart()
    if (ok) {
      setFragen(false)
      toast.success(t('pf_start_gesetzt'))
    }
  }

  return (
    <div data-progress-page>
      <Leiste titel={t('profil_feld_progress')} />

      <section className="card" aria-label={t('pf_zeitreise_titel')}>
        {startOn
          ? <Zeitreise history={state.history} since={startOn} badges={badges} />
          : <p className="text-[15px] text-[var(--lg-text-2)]" data-progress-empty>{t('pf_zu_wenig_text')}</p>}
      </section>

      {startOn && (
        <section className="card mt-3" data-progress-start>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] text-[var(--lg-text-2)]">{t('pf_start')}</span>
            <span className="text-right text-[15px] font-semibold tabular-nums text-[var(--lg-text)]" data-progress-start-day={startOn}>
              {formatDay(startOn, locale)}
            </span>
          </div>
          {setup?.implicit && <p className="mt-0.5 text-right text-[12.5px] text-[var(--lg-text-3)]">{t('pf_start_erste_messung')}</p>}
          {data.settings.previousStarts.slice(0, 3).map(day => (
            <div key={day} className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[14px] text-[var(--lg-text-3)]">{t('pf_vorheriger')}</span>
              <button
                type="button"
                className="lg-gray-btn !min-h-9 !px-3 !text-[13px]"
                disabled={busy}
                onClick={() => void restoreStart(day)}
                data-progress-restore={day}
              >
                {t('pf_wieder_nutzen', { datum: formatDay(day, locale) })}
              </button>
            </div>
          ))}
          <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-[var(--lg-separator)] pt-3">
            <span className="text-[15px] text-[var(--lg-text)]">{t('pf_gesamt_mittel')}</span>
            <span className="text-[17px] font-semibold tabular-nums text-[var(--lg-text)]" data-progress-detail-total>
              {result?.total == null ? '–' : formatPct(result.total, locale)}
            </span>
          </div>
        </section>
      )}

      {result && PROGRESS_AREAS.map(area => {
        const werte = result.values.filter(v => v.area === area)
        if (werte.length === 0) return null
        const mittel = result.areas[area]
        return (
          <Gruppe
            key={area}
            titel={areaName(area, t)}
            data-progress-detail-area={area}
            rechts={
              <span className="text-[13px] font-semibold tabular-nums text-[var(--lg-text-2)]" data-progress-area-mean>
                {mittel === null ? t('pf_zaehlt_nicht') : t('pf_mittel', { wert: formatPct(mittel, locale) })}
              </span>
            }
          >
            <ul className="card !py-1">
              {werte.map(v => (
                <WertZeile
                  key={v.id}
                  v={v}
                  standard={defaultDirection(v.id, data.goals)}
                  eigene={data.settings.directions[v.id] !== undefined}
                  exerciseNames={setup?.exerciseNames}
                  onDirection={d => setDirection(v.id, d)}
                />
              ))}
            </ul>
          </Gruppe>
        )
      })}

      {startOn && (
        <button type="button" className="lg-btn lg-btn-primary mt-5 w-full" onClick={() => setFragen(true)} data-progress-new-start>
          {t('pf_neuer_start')}
        </button>
      )}

      <section className="mt-5 px-1 text-[13.5px] leading-relaxed text-[var(--lg-text-2)]" data-progress-explain>
        <p className="font-semibold text-[var(--lg-text)]">{t('pf_erklaer_titel')}</p>
        <p className="mt-1">{t('pf_erklaer_1')}</p>
        <p className="mt-2 font-medium text-[var(--lg-text)]" data-progress-note>{t('pf_erklaer_2')}</p>
        <p className="mt-2">{t('pf_erklaer_3')}</p>
        <p className="mt-2">{t('pf_erklaer_4')}</p>
      </section>

      {fragen && startOn && (
        <Sheet labelledBy="pf-neuer-start-titel" busy={busy} onClose={() => setFragen(false)} data-progress-new-start-sheet>
          <h2 id="pf-neuer-start-titel" className="lg-title2 pb-2 pt-2">{t('pf_neuer_start_titel')}</h2>
          <p className="text-[15px] leading-snug text-[var(--lg-text-2)]">{t('pf_neuer_start_text', { datum: formatDay(startOn, locale) })}</p>
          <div className="mt-4 space-y-2">
            <button type="button" className="lg-btn lg-btn-primary w-full" disabled={busy} onClick={() => void neuerStart()} data-progress-new-start-ok>
              {t('pf_neuer_start_ok')}
            </button>
            <button type="button" className="lg-gray-btn w-full" disabled={busy} onClick={() => setFragen(false)}>{t('cancel')}</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

const RICHTUNG: Record<Direction, string> = { down: 'pf_richtung_down', up: 'pf_richtung_up', range: 'pf_richtung_range', off: 'pf_richtung_off' }

function WertZeile({ v, standard, eigene, exerciseNames, onDirection }: {
  v: ProgressValueResult
  standard: Direction
  eigene: boolean
  exerciseNames?: Record<string, string>
  onDirection: (d: Direction) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n?.language || 'de'
  const name = metricName(v.id, t, exerciseNames)
  const sammelt = baselineText(v.baseline, t)
  const verlauf = v.baseline.status === 'counts' ? startToNow(v, locale) : null
  const grund = eigene && v.direction !== standard ? t('pf_von_dir') : v.source === 'goals' ? t('pf_aus_zielen') : null
  const detail = [verlauf ?? sammelt, grund].filter(Boolean).join(' · ')
  const aus = v.change === null
  return (
    <li className="border-b border-[var(--lg-separator)] py-3 last:border-b-0" data-progress-metric={v.id}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[15.5px] ${aus ? 'text-[var(--lg-text-2)]' : 'text-[var(--lg-text)]'}`}>{name}</p>
          {detail && <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--lg-text-3)]" data-progress-metric-detail>{detail}</p>}
        </div>
        <span
          className={`shrink-0 text-[15.5px] tabular-nums ${aus ? 'text-[var(--lg-text-3)]' : 'font-semibold text-[var(--lg-text)]'}`}
          data-progress-metric-change
        >
          {v.change === null ? '–' : formatPct(v.change, locale)}
        </span>
      </div>
      <div className="mt-2" data-progress-direction={v.id}>
        <GlassSegmented
          material="fill"
          equal
          ariaLabel={t('pf_richtung_label', { wert: name })}
          value={v.direction}
          onChange={d => onDirection(d)}
          options={allowedDirections(v.id).map(d => ({ key: d, label: t(RICHTUNG[d]) }))}
        />
      </div>
    </li>
  )
}
