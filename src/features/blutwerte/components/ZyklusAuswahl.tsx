import { useTranslation } from 'react-i18next'
import type { ZyklusZeile } from '../lib/zyklusZeilen'
import { formatDisplayDate } from '../lib/format'
import { MUTED, TEXT } from '../styles'

/**
 * Legende und Schalter der Zyklus-Balken im Verlauf: je Substanz ein Chip mit
 * Farbpunkt und Namen — Farbe ist nie das einzige Merkmal. Antippen blendet
 * ihre Balken aus oder wieder ein; anfangs sind alle an.
 */
export function ZyklusAuswahl({ zeilen, weitere, an: istAn, onToggle }: {
  zeilen: ZyklusZeile[]
  weitere: number
  an: (stackItemId: string) => boolean
  onToggle: (stackItemId: string) => void
}) {
  const { t } = useTranslation()
  if (zeilen.length === 0) return null

  const zeitraum = (von: string, bis: string | null) =>
    t('bw_cycles_period', { from: formatDisplayDate(von), to: bis ? formatDisplayDate(bis) : t('bw_cycles_running') })

  return (
    <div data-cycle-strip className="mt-3">
      <p className="text-[0.65rem] uppercase tracking-wide mb-2" style={{ color: MUTED }}>{t('bw_cycles_title')}</p>
      <ul className="flex flex-wrap gap-2">
        {zeilen.map(zeile => {
          const an = istAn(zeile.stackItemId)
          const farbe = `var(--cycle-${zeile.farbe + 1})`
          const zeitraeume = zeile.abschnitte.map(a => zeitraum(a.von, a.bis)).join(', ')
          return (
            <li key={zeile.stackItemId} data-cycle-row={zeile.substanz} className="min-w-0">
              <button
                type="button"
                aria-pressed={an}
                aria-label={`${zeile.substanz}: ${zeitraeume}`}
                onClick={() => onToggle(zeile.stackItemId)}
                title={zeitraeume}
                className="flex items-center gap-1.5 max-w-full rounded-full pl-2 pr-3 min-h-[32px] text-xs font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]"
                style={{
                  color: an ? TEXT : MUTED,
                  border: `1px solid ${an ? farbe : 'var(--border)'}`,
                  background: an ? `color-mix(in srgb, ${farbe} 16%, transparent)` : 'transparent',
                }}
              >
                {/* Aus: nur noch ein Ring statt des gefuellten Punkts */}
                <span aria-hidden className="shrink-0 w-2.5 h-2.5 rounded-full transition-colors duration-150" style={{ background: an ? farbe : 'transparent', boxShadow: `inset 0 0 0 1.5px ${farbe}` }} />
                <span className="truncate">{zeile.substanz}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <p data-cycle-note className="text-[0.7rem] mt-2 leading-snug" style={{ color: MUTED }}>
        {weitere > 0 && <>{t('bw_cycles_more', { count: weitere })} </>}
        {t('bw_cycles_hint')}
      </p>
    </div>
  )
}
