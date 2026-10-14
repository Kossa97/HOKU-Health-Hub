import { useTranslation } from 'react-i18next'
import type { ZyklusZeile } from '../lib/zyklusZeilen'
import { formatDisplayDate } from '../lib/format'
import { MUTED, TEXT } from '../styles'

/**
 * Legende und Schalter der Zyklus-Spuren im Verlauf: je Substanz ein Chip mit
 * Farbpunkt und Namen — Farbe ist nie das einzige Merkmal. Antippen hebt die
 * Zeitraeume im Diagramm hervor; mehrere gleichzeitig, erneutes Tippen nimmt
 * sie wieder heraus.
 */
export function ZyklusAuswahl({ zeilen, weitere, hervor, onToggle }: {
  zeilen: ZyklusZeile[]
  weitere: number
  hervor: ReadonlySet<string>
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
          const an = hervor.has(zeile.stackItemId)
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
                className="flex items-center gap-1.5 max-w-full rounded-full pl-2 pr-3 min-h-[32px] text-xs font-semibold transition-[background-color,border-color,transform] duration-150 active:scale-[0.97]"
                style={{
                  color: TEXT,
                  border: `1px solid ${an ? farbe : 'var(--border)'}`,
                  background: an ? `color-mix(in srgb, ${farbe} 16%, transparent)` : 'transparent',
                }}
              >
                <span aria-hidden className="shrink-0 w-2.5 h-2.5 rounded-full" style={{ background: farbe }} />
                <span className="truncate">{zeile.substanz}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {weitere > 0 && <p className="text-xs mt-2" style={{ color: MUTED }}>{t('bw_cycles_more', { count: weitere })}</p>}
      <p className="text-[0.7rem] mt-2 leading-snug" style={{ color: MUTED }}>{t('bw_cycles_hint')}</p>
    </div>
  )
}
