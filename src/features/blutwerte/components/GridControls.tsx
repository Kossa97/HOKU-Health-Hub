import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowUpDown, ChevronDown } from 'lucide-react'
import { AUFFAELLIG, type MarkerFilter, type SortMode } from '../lib/bloodwork'
import type { UnitSystem } from '../lib/unitConversion'
import { KATEGORIE_KEY } from '../lib/markerCatalog.en'
import type { KategorieFilter } from '../lib/markerCatalog'
import { KATEGORIEN, SONSTIGE } from '../lib/markerCatalog'
import { MUTED, RED, RED_WEAK, TEXT } from '../styles'

const PILL = { background: 'var(--surface-raised)', border: '1px solid var(--border)' } as const

const SORT_LABELS: Record<SortMode, string> = {
  kategorie: 'bw_sort_category',
  name: 'bw_sort_name',
  zuletzt: 'bw_sort_recent',
  status: 'bw_sort_status',
}

interface Props {
  kategorie: MarkerFilter
  /** Anzahl fuer den Chip „Auffällige“. */
  auffaellig: number
  sortMode: SortMode
  /** Einheitensystem fuer alle Marker (einzelne koennen abweichen). */
  unitSystem: UnitSystem
  /** Erst nach dem Laden der gespeicherten Wahl bedienbar. */
  unitsReady: boolean
  onUnitSystem: (system: UnitSystem) => void
  /** "Sonstige" nur anbieten, wenn Custom-Marker existieren. */
  showSonstige: boolean
  onKategorie: (kategorie: MarkerFilter) => void
  onSortMode: (mode: SortMode) => void
}

export function GridControls({ kategorie, auffaellig, sortMode, unitSystem, unitsReady, onUnitSystem, showSonstige, onKategorie, onSortMode }: Props) {
  const { t } = useTranslation()
  const chips: Array<{ key: MarkerFilter; label: string }> = [
    // Zuerst und vorausgewaehlt: was Aufmerksamkeit braucht.
    { key: AUFFAELLIG, label: t('bw_view_flagged') },
    { key: null, label: t('bw_all') },
    ...KATEGORIEN.map(k => ({ key: k as KategorieFilter, label: t(KATEGORIE_KEY[k]) })),
    ...(showSonstige ? [{ key: SONSTIGE as KategorieFilter, label: t(KATEGORIE_KEY[SONSTIGE]) }] : []),
  ]

  return (
    <div className="mb-2 space-y-2">
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        {chips.map(chip => {
          const active = kategorie === chip.key
          return (
            <button
              key={chip.key ?? 'alle'}
              onClick={() => onKategorie(chip.key)}
              aria-pressed={active}
              // Sichtbarer Text plus Anzahl: „Auffällige (2)“ — Sprachsteuerung findet ihn am Namen.
              aria-label={chip.key === AUFFAELLIG && auffaellig > 0 ? `${chip.label} (${auffaellig})` : undefined}
              className="inline-flex min-h-9 items-center gap-1.5 px-3.5 rounded-full text-sm whitespace-nowrap transition-colors"
              style={
                active
                  ? { background: 'var(--surface-raised)', color: TEXT, fontWeight: 800 }
                  : { color: 'var(--text-dim)', fontWeight: 600 }
              }
            >
              {chip.label}
              {chip.key === AUFFAELLIG && auffaellig > 0 && (
                <span
                  aria-hidden="true"
                  className="min-w-5 rounded-full px-1.5 text-xs font-bold leading-5 tabular-nums text-center"
                  style={{ background: RED_WEAK, color: RED }}
                  data-bw-flagged-count
                >
                  {auffaellig}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Eine ruhige Zeile: links Sortieren, rechts Einheiten — zwei gleich hohe
          Pillen ohne sichtbare Etiketten (Screenreader lesen sie trotzdem). */}
      <div className="flex items-center gap-2">
        {/* Sortieren greift nur im Raster, nicht in der Liste der Auffaelligen. */}
        {kategorie !== AUFFAELLIG && (
          <div className="relative flex h-8 min-w-0 items-center rounded-full" style={PILL}>
            <label className="sr-only" htmlFor="blutwerte-sort">{t('bw_sort')}</label>
            <ArrowUpDown size={13} aria-hidden="true" className="pointer-events-none absolute left-2.5" style={{ color: MUTED }} />
            <select
              id="blutwerte-sort"
              className="h-full min-w-0 cursor-pointer appearance-none truncate rounded-full bg-transparent pl-7 pr-7 text-xs font-semibold"
              style={{ color: TEXT, border: 'none', outline: 'none' }}
              value={sortMode}
              onChange={e => onSortMode(e.target.value as SortMode)}
            >
              {(Object.keys(SORT_LABELS) as SortMode[]).map(mode => (
                <option key={mode} value={mode}>{t(SORT_LABELS[mode])}</option>
              ))}
            </select>
            <ChevronDown size={13} aria-hidden="true" className="pointer-events-none absolute right-2.5" style={{ color: MUTED }} />
          </div>
        )}

        {/* Bei „Auffällige“ steht links, was die Liste zeigt — neben dem Schalter statt darueber.
            Zwei Zeilen à 16 px = Hoehe des Schalters; nur auf sehr schmalen Geraeten wird es hoeher. */}
        {kategorie === AUFFAELLIG && auffaellig > 0 && (
          <p className="flex min-h-8 min-w-0 flex-1 items-center gap-1.5 text-[11px] leading-4" style={{ color: MUTED }} data-bw-flagged-hint>
            <AlertTriangle size={14} className="shrink-0" style={{ color: RED }} aria-hidden="true" />
            {t('bw_flagged_hint')}
          </p>
        )}

        {/* Einheiten: konventionell (z.B. ng/dL) oder SI (z.B. nmol/L), fuer alle Marker. */}
        <div role="group" aria-label={t('bw_units')} className="ml-auto flex h-8 shrink-0 items-center rounded-full p-0.5" style={PILL}>
          {([['konventionell', t('bw_units_conventional')], ['si', t('bw_units_si')]] as [UnitSystem, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => onUnitSystem(key)}
              disabled={!unitsReady}
              aria-pressed={unitSystem === key}
              className="h-full rounded-full px-3 text-xs whitespace-nowrap transition-colors"
              style={unitSystem === key
                ? { background: 'var(--surface)', color: TEXT, fontWeight: 800, boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }
                : { color: MUTED, fontWeight: 600 }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
