import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import type { CycleSubstance, OngoingSubstance } from '../../types'
import { MAX_VISIBLE_SUBSTANCES } from '../../constants'
import { formatSubstanceEnd, substanceDayCount } from '../../lib/substances'
import { panel, sectionLabel } from '../../styles'

interface Props {
  cycles: CycleSubstance[]
  ongoing: OngoingSubstance[]
  onSelect?: (id: string) => void
}

export function ActiveSubstancesSection({ cycles, ongoing, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false)
  const total = cycles.length + ongoing.length
  const allItems = [
    ...cycles.map(c => ({ kind: 'cycle' as const, item: c })),
    ...ongoing.map(o => ({ kind: 'ongoing' as const, item: o })),
  ]
  const visible = expanded ? allItems : allItems.slice(0, MAX_VISIBLE_SUBSTANCES)
  const showDivider = cycles.length > 0 && ongoing.length > 0

  if (total === 0) return null

  return (
    <section style={{ ...panel, padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={sectionLabel}>Aktive Substanzen</p>
        <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)' }}>{total}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map(({ kind, item }, index) => {
          if (kind === 'ongoing' && showDivider && index === cycles.length) {
            return (
              <div key={`div-${item.id}`}>
                <p style={{ ...sectionLabel, margin: '4px 0 10px' }}>dauerhaft</p>
                <SubstanceRow
                  name={item.name}
                  color={item.color}
                  filled={false}
                  detail={`seit ${substanceDayCount(item)} Tagen`}
                  onClick={() => onSelect?.(item.id)}
                />
              </div>
            )
          }

          if (kind === 'cycle') {
            const cycle = item
            return (
              <SubstanceRow
                key={cycle.id}
                name={cycle.name}
                color={cycle.color}
                filled
                detail={`Tag ${substanceDayCount(cycle)} · ${formatSubstanceEnd(cycle)}`}
                onClick={() => onSelect?.(cycle.id)}
              />
            )
          }

          return (
            <SubstanceRow
              key={item.id}
              name={item.name}
              color={item.color}
              filled={false}
              detail={`seit ${substanceDayCount(item)} Tagen`}
              onClick={() => onSelect?.(item.id)}
            />
          )
        })}
      </div>

      {allItems.length > MAX_VISIBLE_SUBSTANCES && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          style={{
            marginTop: 12,
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: 'var(--accent)',
            fontSize: '0.75rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {expanded ? 'Weniger anzeigen' : 'Alle anzeigen'}
        </button>
      )}
    </section>
  )
}

function SubstanceRow({
  name,
  color,
  filled,
  detail,
  onClick,
}: {
  name: string
  color: string
  filled: boolean
  detail: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        width: '100%',
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: filled ? color : 'transparent',
          border: `2px solid ${color}`,
          flexShrink: 0,
        }} />
        <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
      </div>
      <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)', flexShrink: 0 }}>
        {detail}
      </span>
    </button>
  )
}

export function formatRangeSubtitle(from: string, cycleCount: number, ongoingCount: number): string {
  const fromLabel = format(parseISO(`${from}T00:00:00`), 'd. MMM')
  const parts: string[] = [`Seit ${fromLabel}`]
  if (cycleCount > 0) parts.push(`${cycleCount} ${cycleCount === 1 ? 'Zyklus' : 'Zyklen'}`)
  if (ongoingCount > 0) parts.push(`${ongoingCount} dauerhaft`)
  return parts.join(' · ')
}
