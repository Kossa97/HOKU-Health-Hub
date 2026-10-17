import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { CycleSubstance } from '../../types'
import { formatDaySafe } from '../../lib/dates'
import type { SubstanceCycles } from '../../lib/cycleSubstances'

interface Props {
  substances: SubstanceCycles[]
  selected: ReadonlySet<string>
  /** Puls um den ersten Chip, bis irgendein Chip angetippt wurde */
  hint: boolean
  onToggle: (id: string) => void
}

/**
 * Wie in Blutwerte: je Substanz ein Chip mit Farbpunkt und Namen (Farbe ist nie
 * das einzige Merkmal). Antippen blendet ihre Zyklen als Balken hinter der
 * Kurve ein oder aus; anfangs ist keiner an.
 */
export function CycleChips({ substances, selected, hint, onToggle }: Props) {
  const { t } = useTranslation()
  if (substances.length === 0) return null

  const period = (cycle: CycleSubstance) => t('bw_cycles_period', {
    from: formatDaySafe(cycle.startDate, 'full'),
    to: cycle.endDate ? formatDaySafe(cycle.endDate, 'full') : t('bw_cycles_running'),
  })

  return (
    <div className="fg-cycles" data-cycle-strip>
      <p className="fg-eyebrow">{t('bw_cycles_title')}</p>
      <ul className="fg-chips">
        {substances.map((substance, index) => {
          const periods = substance.cycles.map(period).join(', ')
          return (
            <li key={substance.id} className="min-w-0">
              <button
                type="button"
                className="fg-chip"
                aria-pressed={selected.has(substance.id)}
                aria-label={`${substance.name}: ${periods}`}
                title={periods}
                data-hint={hint && index === 0}
                onClick={() => onToggle(substance.id)}
                style={{ '--cc': substance.color } as CSSProperties}
              >
                <span className="fg-chip-dot" aria-hidden />
                <span>{substance.name}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="fg-note">{t('bw_cycles_hint')}</p>
    </div>
  )
}
