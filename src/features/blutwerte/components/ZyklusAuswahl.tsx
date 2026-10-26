import { useTranslation } from 'react-i18next'
import type { ZyklusZeile } from '../lib/zyklusZeilen'
import { formatDisplayDate } from '../lib/format'
import { MUTED, TEXT } from '../styles'

/**
 * Legende und Schalter der Zyklus-Balken im Verlauf: je Substanz ein Chip mit
 * Farbpunkt und Namen — Farbe ist nie das einzige Merkmal. Antippen blendet
 * ihre Balken ein oder wieder aus; anfangs ist keiner an. Mit `hinweis` pulst
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
        /* Ring in der Zyklusfarbe: blendet auf, weitet sich leicht und verklingt.
           Nur Deckkraft und Groesse (GPU). Eine Pause zwischen den Pulsen, damit
           er nicht draengelt. */
        @keyframes bw-chip-hinweis {
          0% { opacity: 0; transform: scale(0.96); }
          30% { opacity: 0.8; transform: scale(1); }
          75%, 100% { opacity: 0; transform: scale(1.1); }
        }
        .bw-chip-hinweis::after {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 9999px;
          border: 1.5px solid var(--bw-chip-farbe);
          box-shadow: 0 0 10px 1px color-mix(in srgb, var(--bw-chip-farbe) 55%, transparent);
          opacity: 0;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: no-preference) {
          .bw-chip-hinweis::after {
            animation: bw-chip-hinweis 2600ms cubic-bezier(0.23, 1, 0.32, 1) 700ms infinite;
          }
        }
        /* Bewegung reduziert: ruhiger, stehender Ring statt Puls */
        @media (prefers-reduced-motion: reduce) {
          .bw-chip-hinweis::after { opacity: 0.45; }
        }
      `}</style>
      <p className="text-[0.65rem] uppercase tracking-wide mb-2" style={{ color: MUTED }}>{t('bw_cycles_title')}</p>
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
                className={`${hinweis && index === 0 ? 'bw-chip-hinweis ' : ''}relative flex items-center gap-1.5 max-w-full rounded-full pl-2 pr-3 min-h-[32px] text-xs font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]`}
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
      <p data-cycle-note className="text-[0.7rem] mt-2 leading-snug" style={{ color: MUTED }}>
        {t('bw_cycles_hint')}
      </p>
    </div>
  )
}
