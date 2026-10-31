import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { BodyMeasurementEntry } from '../types'
import { fieldLabel } from '../styles'
import { formatNumber } from '../lib/dates'
import {
  lastMeasurementUpTo,
  MEASUREMENT_SITES,
  parseCircumference,
  type MeasurementSite,
} from '../lib/measurements'

/** Getippter Text je Stelle; Zahlen entstehen erst beim Speichern. */
export type TypedMeasurements = Partial<Record<MeasurementSite, string>>

/** Nur wirklich Getipptes zählt; `invalid`, wenn ein getipptes Feld keine gültige Zahl ist. */
export function parseTypedMeasurements(
  typed: TypedMeasurements,
  sites: readonly MeasurementSite[],
): { values: Partial<Record<MeasurementSite, number>>; invalid: boolean } {
  const values: Partial<Record<MeasurementSite, number>> = {}
  let invalid = false
  for (const site of sites) {
    const text = typed[site]
    if (text === undefined || text.trim() === '') continue
    const value = parseCircumference(text)
    if (value === null) invalid = true
    else values[site] = value
  }
  return { values, invalid }
}

interface Props {
  sites: MeasurementSite[]
  entries: BodyMeasurementEntry[]
  date: string
  typed: TypedMeasurements
  onTyped: (site: MeasurementSite, text: string) => void
  /** `null`, solange die gespeicherte Wahl nicht geladen ist: dann ist die Auswahl gesperrt. */
  onSitesChange: ((sites: MeasurementSite[]) => void) | null
}

export function MeasurementSection({ sites, entries, date, typed, onTyped, onSitesChange }: Props) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(true)
  const [choosing, setChoosing] = useState(false)

  const toggleSite = (site: MeasurementSite) => {
    if (!onSitesChange) return
    const next = sites.includes(site) ? sites.filter(s => s !== site) : [...sites, site]
    onSitesChange(MEASUREMENT_SITES.filter(s => next.includes(s)))
  }

  return (
    <section style={{ marginTop: 12 }}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '10px 2px',
          background: 'none',
          border: 'none',
          color: 'var(--text)',
          fontSize: '0.95rem',
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        <span>{t('umfaenge_title')}</span>
        <ChevronDown
          size={18}
          aria-hidden
          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}
        />
      </button>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MEASUREMENT_SITES.filter(site => sites.includes(site)).map(site => {
            const text = typed[site] ?? ''
            // Schon gespeicherter Wert des gewählten Tages, sonst der letzte davor.
            const last = lastMeasurementUpTo(entries, site, date)
            const invalid = text.trim() !== '' && parseCircumference(text) === null
            return (
              <div key={site}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 14,
                  background: 'var(--surface-input)',
                  border: `1px solid ${invalid ? 'var(--danger, #ff5a5f)' : 'var(--border)'}`,
                }}>
                  <label htmlFor={`umfang-${site}`} style={{ ...fieldLabel, marginBottom: 0, flexShrink: 0 }}>
                    {t(`umfang_${site}`)}
                  </label>
                  <input
                    id={`umfang-${site}`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={text}
                    placeholder={last === null ? '' : formatNumber(last, 1)}
                    aria-invalid={invalid}
                    onChange={e => onTyped(site, e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text)',
                      fontSize: '1rem',
                      fontWeight: 800,
                      fontFamily: 'inherit',
                      textAlign: 'right',
                    }}
                  />
                  <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>cm</span>
                </div>
                {invalid && (
                  <p role="alert" style={{ margin: '4px 4px 0', fontSize: '0.78rem', color: 'var(--danger, #ff5a5f)' }}>
                    {t('umfaenge_invalid')}
                  </p>
                )}
              </div>
            )
          })}

          <button
            type="button"
            onClick={() => setChoosing(v => !v)}
            aria-expanded={choosing && onSitesChange !== null}
            disabled={onSitesChange === null}
            style={{
              alignSelf: 'flex-start',
              padding: '8px 14px',
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'var(--surface-input)',
              color: 'var(--text)',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {t('umfaenge_choose_sites')}
          </button>

          {choosing && onSitesChange && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {MEASUREMENT_SITES.map(site => (
                <label
                  key={site}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: 'var(--surface-input)',
                    color: 'var(--text)',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sites.includes(site)}
                    onChange={() => toggleSite(site)}
                  />
                  {t(`umfang_${site}`)}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
