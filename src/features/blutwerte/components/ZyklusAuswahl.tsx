import { useTranslation } from 'react-i18next'
import type { ZyklusZeile } from '../lib/zyklusZeilen'
import { formatDisplayDate } from '../lib/format'
import { MUTED, TEXT } from '../styles'

/**
 * Legende und Schalter der Zyklus-Balken im Verlauf: je Substanz ein Chip mit
 * Farbpunkt und Namen — Farbe ist nie das einzige Merkmal. Antippen blendet
 * ihre Balken ein oder wieder aus; anfangs ist keiner an. Mit `hinweis` steht
 * ein Ring um den ersten Chip, bis irgendein Chip angetippt wurde.
 */
export function ZyklusAuswahl({ zeilen, an: istAn, hinweis, onToggle }: {
  zeilen: ZyklusZeile[]
  an: (stackItemId: string) => boolean
  hinweis: boolean
  onToggle: (stackItemId: string) => void
}) {
  const { t } = useTranslation()
  if (zeilen.length === 0) return null

  const zeitraum = (von: string, bis: string | null) =>
    t('bw_cycles_period', { from: formatDisplayDate(von), to: bis ? formatDisplayDate(bis) : t('bw_cycles_running') })

  return (
    <div data-cycle-strip className="mt-3">
      <style>{`
        /* Hinweis auf den ersten Chip: ein stehender Ring in seiner Farbe, kein Puls */
        .bw-chip-hinweis::after {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 11px;
          border: 1px solid var(--bw-chip-farbe);
          opacity: 0.45;
          pointer-events: none;
        }
      `}</style>
      <p className="text-[13px] font-medium mb-2" style={{ color: MUTED }}>{t('bw_cycles_title')}</p>
      <ul className="flex flex-wrap gap-2">
        {zeilen.map((zeile, index) => {
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
                data-cycle-hint={hinweis && index === 0 ? '' : undefined}
                className={`${hinweis && index === 0 ? 'bw-chip-hinweis ' : ''}relative flex items-center gap-2 max-w-full rounded-lg pl-2 pr-3 min-h-[32px] text-xs font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]`}
                style={{
                  ['--bw-chip-farbe' as string]: farbe,
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
      <p data-cycle-note className="text-xs mt-2 leading-snug" style={{ color: MUTED }}>
        {t('bw_cycles_hint')}
      </p>
    </div>
  )
}
