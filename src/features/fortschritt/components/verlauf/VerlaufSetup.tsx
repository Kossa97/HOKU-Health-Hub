import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { CycleSubstance } from '../../types'
import { formatDaySafe } from '../../lib/dates'
import {
  partitionCyclesForDisplay,
  substanceCheckboxState,
  substanceDefaultMemberIds,
  type SubstanceCycleGroup,
  type VisibleChartIds,
} from '../../lib/chartVisibility'
import { panel } from '../../styles'

interface Props {
  groups: SubstanceCycleGroup[]
  visibleIds: VisibleChartIds
  onToggleGroup: (group: SubstanceCycleGroup) => void
  onToggleCycle: (id: string) => void
  /** Im Vollbild-Sheet ohne zusätzliche Panel-Umrandung */
  embedded?: boolean
}

function formatCycleLabel(cycle: CycleSubstance, t: TFunction): string {
  const start = formatDaySafe(cycle.startDate)
  const end = cycle.endDate ? formatDaySafe(cycle.endDate) : t('fortschritt_cycle_open')
  return `${start} – ${end}`
}

function CheckRow({
  color,
  checked,
  onToggle,
  title,
  subtitle,
  indent = 28,
}: {
  color: string
  checked: boolean
  onToggle: () => void
  title: string
  subtitle?: string
  indent?: number
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: `8px 10px 8px ${indent}px`,
        borderRadius: 10,
        cursor: 'pointer',
        background: checked ? `${color}0a` : 'transparent',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={{ accentColor: color, width: 16, height: 16, flexShrink: 0 }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'block',
          fontSize: '0.76rem',
          fontWeight: 700,
          color: checked ? 'var(--text-dim)' : 'var(--text-muted)',
        }}>
          {title}
        </span>
        {subtitle && (
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            {subtitle}
          </span>
        )}
      </span>
    </label>
  )
}

function CycleRow({
  cycle,
  color,
  checked,
  onToggle,
}: {
  cycle: CycleSubstance
  color: string
  checked: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  return (
    <CheckRow
      color={color}
      checked={checked}
      onToggle={onToggle}
      title={formatCycleLabel(cycle, t)}
      subtitle={cycle.active ? t('fortschritt_cycle_active') : t('fortschritt_cycle_ended')}
    />
  )
}

function CollapseHeader({
  label,
  count,
  selectedCount,
  open,
  onToggle,
  indent = 0,
  muted = false,
}: {
  label: string
  count?: number
  selectedCount?: number
  open: boolean
  onToggle: () => void
  indent?: number
  muted?: boolean
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        padding: `6px 10px 6px ${10 + indent}px`,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {open
        ? <ChevronDown size={14} color="var(--text-muted)" />
        : <ChevronRight size={14} color="var(--text-muted)" />}
      <span style={{
        fontSize: muted ? '0.68rem' : '0.74rem',
        fontWeight: muted ? 700 : 800,
        color: muted ? 'var(--text-muted)' : 'var(--text-dim)',
        flex: 1,
        textAlign: 'left',
      }}>
        {label}
        {count != null && count > 0 && (
          <span style={{ marginLeft: 6, opacity: 0.65 }}>({count})</span>
        )}
        {!open && selectedCount != null && selectedCount > 0 && (
          <span style={{ marginLeft: 6, color: 'var(--accent)', fontWeight: 800 }}>
            {t('fortschritt_shown_count', { n: selectedCount })}
          </span>
        )}
      </span>
    </button>
  )
}

function CycleSection({
  label,
  cycles,
  color,
  open,
  onToggle,
  visibleIds,
  onToggleCycle,
}: {
  label: string
  cycles: CycleSubstance[]
  color: string
  open: boolean
  onToggle: () => void
  visibleIds: VisibleChartIds
  onToggleCycle: (id: string) => void
}) {
  const selected = cycles.filter(c => visibleIds.has(c.id))
  const list = open ? cycles : selected

  return (
    <div>
      <CollapseHeader
        label={label}
        count={cycles.length}
        selectedCount={selected.length}
        open={open}
        onToggle={onToggle}
        indent={4}
        muted
      />
      {list.map(cycle => (
        <CycleRow
          key={cycle.id}
          cycle={cycle}
          color={color}
          checked={visibleIds.has(cycle.id)}
          onToggle={() => onToggleCycle(cycle.id)}
        />
      ))}
    </div>
  )
}

function SubstanceCheckbox({
  state,
  color,
  onToggle,
}: {
  state: 'all' | 'none' | 'partial'
  color: string
  onToggle: () => void
}) {
  const { t } = useTranslation()
  return (
    <input
      type="checkbox"
      checked={state === 'all'}
      ref={el => {
        if (el) el.indeterminate = state === 'partial'
      }}
      onChange={onToggle}
      aria-label={state === 'all' ? t('fortschritt_substance_hide') : t('fortschritt_substance_show')}
      style={{ accentColor: color, width: 18, height: 18, flexShrink: 0, cursor: 'pointer' }}
    />
  )
}

export function VerlaufSetup({
  groups,
  visibleIds,
  onToggleGroup,
  onToggleCycle,
  embedded = false,
}: Props) {
  const { t } = useTranslation()
  const [substancesPanelOpen, setSubstancesPanelOpen] = useState(false)
  const [openSubstances, setOpenSubstances] = useState<Set<string>>(() => new Set())
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set())

  const toggleSubstance = (key: string) => {
    setOpenSubstances(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const hasCycles = groups.some(g => g.cycles.length > 0 || g.ongoing)
  const summary = buildSubstancesSummary(groups, visibleIds, t)

  const wrapperStyle = embedded
    ? { display: 'flex', flexDirection: 'column' as const, gap: 18 }
    : { ...panel, padding: '16px 16px 14px' }

  return (
    <section style={wrapperStyle}>
      {hasCycles && (
        <div style={{ marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => setSubstancesPanelOpen(v => !v)}
            aria-expanded={substancesPanelOpen}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: 0,
              marginBottom: substancesPanelOpen ? 12 : 0,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {substancesPanelOpen
              ? <ChevronDown size={18} color="var(--text-dim)" />
              : <ChevronRight size={18} color="var(--text-dim)" />}
            <span style={{
              fontSize: '0.92rem',
              fontWeight: 800,
              color: 'var(--text-dim)',
              flex: 1,
            }}>
              {t('fortschritt_add_substances')}
            </span>
            {!substancesPanelOpen && (
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                {summary}
              </span>
            )}
          </button>

          {substancesPanelOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {groups.map(group => {
              const substanceOpen = openSubstances.has(group.key)
              const { active, inactive } = partitionCyclesForDisplay(group.cycles)
              const activeKey = `${group.key}:active`
              const inactiveKey = `${group.key}:inactive`
              const activeOpen = openSections.has(activeKey)
              const inactiveOpen = openSections.has(inactiveKey)
              const visibility = substanceCheckboxState(group, visibleIds)
              const counts = groupDefaultCounts(group, visibleIds)

              return (
                <div
                  key={group.key}
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${visibility === 'none' ? 'var(--border)' : `${group.color}33`}`,
                    overflow: 'hidden',
                    background: visibility === 'none' ? 'transparent' : `${group.color}06`,
                    opacity: visibility === 'none' ? 0.72 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                    }}
                  >
                    <SubstanceCheckbox
                      state={visibility}
                      color={group.color}
                      onToggle={() => onToggleGroup(group)}
                    />
                    <button
                      type="button"
                      aria-label={substanceOpen ? t('fortschritt_cycles_collapse') : t('fortschritt_cycles_expand')}
                      aria-expanded={substanceOpen}
                      onClick={() => toggleSubstance(group.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flex: 1,
                        minWidth: 0,
                        padding: 0,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {substanceOpen
                        ? <ChevronDown size={16} color={group.color} />
                        : <ChevronRight size={16} color={group.color} />}
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: group.color,
                        flexShrink: 0,
                      }} />
                      <span style={{
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        color: group.color,
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {group.name}
                      </span>
                    </button>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {counts.visible}/{counts.total}
                    </span>
                  </div>

                  {substanceOpen && (
                    <div style={{ paddingBottom: 6 }}>
                      {group.ongoing && (
                        <CheckRow
                          color={group.color}
                          checked={visibleIds.has(group.ongoing.id)}
                          onToggle={() => onToggleCycle(group.ongoing!.id)}
                          title={t('fortschritt_since', { date: formatDaySafe(group.ongoing.startDate) })}
                          subtitle={t('fortschritt_ongoing')}
                        />
                      )}

                      {active.length > 0 && (
                        <CycleSection
                          label={t('fortschritt_active_cycles')}
                          cycles={active}
                          color={group.color}
                          open={activeOpen}
                          onToggle={() => toggleSection(activeKey)}
                          visibleIds={visibleIds}
                          onToggleCycle={onToggleCycle}
                        />
                      )}

                      {inactive.length > 0 && (
                        <CycleSection
                          label={t('fortschritt_ended_cycles')}
                          cycles={inactive}
                          color={group.color}
                          open={inactiveOpen}
                          onToggle={() => toggleSection(inactiveKey)}
                          visibleIds={visibleIds}
                          onToggleCycle={onToggleCycle}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          )}
        </div>
      )}
    </section>
  )
}

function groupDefaultCounts(
  group: SubstanceCycleGroup,
  visibleIds: VisibleChartIds,
): { visible: number; total: number } {
  const ids = substanceDefaultMemberIds(group)
  const members = ids.length > 0 ? ids : [...group.cycles.map(c => c.id), ...(group.ongoing ? [group.ongoing.id] : [])]
  return {
    visible: members.filter(id => visibleIds.has(id)).length,
    total: members.length,
  }
}

function buildSubstancesSummary(groups: SubstanceCycleGroup[], visibleIds: VisibleChartIds, t: TFunction): string {
  const selected = groups.filter(g => substanceCheckboxState(g, visibleIds) !== 'none').length
  const activeCycles = groups.reduce((sum, g) => {
    const { active } = partitionCyclesForDisplay(g.cycles)
    return sum + active.filter(c => visibleIds.has(c.id)).length
  }, 0)
  const parts: string[] = []
  if (selected > 0) {
    parts.push(t(selected === 1 ? 'fortschritt_summary_substances_singular' : 'fortschritt_summary_substances_plural', { n: selected }))
  }
  if (activeCycles > 0) {
    parts.push(t(activeCycles === 1 ? 'fortschritt_summary_cycles_singular' : 'fortschritt_summary_cycles_plural', { n: activeCycles }))
  }
  return parts.length > 0 ? parts.join(' · ') : t('fortschritt_summary_none')
}
