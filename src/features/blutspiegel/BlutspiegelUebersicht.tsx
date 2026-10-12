/**
 * Blutspiegel-Übersicht im Stil der Aktienliste: je Substanz eine Zeile mit
 * Name, Mini-Verlauf der letzten 24 h, aktuellem Spiegel und Veränderung.
 * Ein Tipp führt in die Detailansicht (/simulation/<eintrag>).
 */
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import type { EntryCurve, MissingEntry, ReadyEntry, UnsupportedEntry } from './entries'
import { useBlutspiegelData } from './useBlutspiegelData'
import { formatOffset, useBlutspiegelFormat } from './format'
import { levelAt, type LevelPoint } from './chart/stocksChartMath'
import { NoCurveRow } from './BlutspiegelView'
import { detailPfad } from './pfade'

const DAY = 24 * 3_600_000
// Dieselben Farben wie im Kopf der Detailansicht
const RISING = '#15803d'
const FALLING = '#be123c'

/** Veränderung über die letzten 24 h; beginnt der Verlauf später, zählt sein Anfang. */
function aenderung24h(points: LevelPoint[], now: number): number | null {
  if (points.length < 2) return null
  const ende = points[points.length - 1]
  const start = points[0].ts > now - DAY ? points[0].level : levelAt(points, now - DAY)
  return start == null ? null : ende.level - start
}

function Verlauf({ points, now, color }: { points: LevelPoint[]; now: number; color: string }) {
  const W = 72
  const H = 32
  const tag = points.filter(p => p.ts >= now - DAY)
  if (tag.length < 2) return <span aria-hidden="true" style={{ width: W, height: H, flexShrink: 0 }} />
  let min = Infinity
  let max = -Infinity
  for (const p of tag) { min = Math.min(min, p.level); max = Math.max(max, p.level) }
  const span = Math.max(1, max - min)
  const t0 = tag[0].ts
  const dt = Math.max(1, tag[tag.length - 1].ts - t0)
  const xy = tag.map(p => [((p.ts - t0) / dt) * W, H - 3 - ((p.level - min) / span) * (H - 6)] as const)
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
  const id = `bs-v-${color.replace('#', '')}`
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line}L${W},${H}L0,${H}Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Zeile({ entry, curve, now }: { entry: ReadyEntry; curve: EntryCurve | undefined; now: number }) {
  const f = useBlutspiegelFormat()
  const { t } = f
  const points = curve?.points ?? []
  const change = aenderung24h(points, now)
  const flach = change == null || Math.abs(change) < 0.05
  const farbe = flach ? 'var(--surface-raised)' : change! > 0 ? RISING : FALLING
  const linie = flach ? entry.accent : change! > 0 ? RISING : FALLING
  const naechste = entry.nextDoseAt != null ? formatOffset(entry.nextDoseAt - now, t) : null
  return (
    <li>
      <Link
        to={detailPfad(entry.key)}
        className="flex min-h-[68px] items-center gap-3 py-2.5"
        style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}
        data-bs-row={entry.key}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[17px] font-extrabold tracking-tight">{entry.name}</span>
          <span className="truncate text-[13px]" style={{ color: 'var(--text-muted)' }}>
            {entry.profile.name !== entry.name ? `${entry.profile.name} · ` : ''}
            {naechste ? t('pk_overview_next', { when: naechste }) : t('pk_overview_no_next')}
          </span>
        </span>
        <Verlauf points={points} now={now} color={linie} />
        <span className="flex w-[84px] shrink-0 flex-col items-end gap-1 tabular-nums">
          <span className="text-[17px] font-bold">{curve?.current != null ? `${f.pct(curve.current)} %` : '—'}</span>
          <span
            className="min-w-[62px] rounded-[7px] px-2 py-[3px] text-right text-[13px] font-bold"
            style={{ background: farbe, color: flach ? 'var(--text-muted)' : '#fff' }}
            data-bs-change
          >
            {change == null ? '—' : f.signed(change)}
          </span>
        </span>
      </Link>
    </li>
  )
}

export function BlutspiegelUebersicht() {
  const data = useBlutspiegelData()
  const f = useBlutspiegelFormat()
  const { t } = f
  const missing = data.entries.filter((e): e is MissingEntry | UnsupportedEntry => e.kind !== 'ready')

  if (data.error) return <p role="alert" className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('pk_data_load_error')}</p>
  if (data.loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center gap-2.5">
        <Loader2 size={18} color="var(--accent)" className="animate-spin" />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('pk_live_loading')}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {data.ready.length > 0 ? (
        <section aria-label={t('pk_overview_list')}>
          <p className="mb-1 text-[13px]" style={{ color: 'var(--text-muted)' }}>{t('pk_overview_hint')}</p>
          <ul style={{ borderTop: '1px solid var(--border)' }}>
            {data.ready.map(entry => (
              <Zeile key={entry.key} entry={entry} curve={data.curves.get(entry.key)} now={data.asOf} />
            ))}
          </ul>
        </section>
      ) : (
        <p className="py-6 text-center text-sm" style={{ color: 'var(--text-dim)' }}>{t('pk_no_ready_items')}</p>
      )}

      {missing.length > 0 && (
        <section>
          <h2 className="pb-1 text-[15px] font-extrabold" style={{ color: 'var(--text)' }}>{t('pk_incomplete_title')}</h2>
          {missing.map(entry => <NoCurveRow key={entry.key} entry={entry} />)}
        </section>
      )}
    </div>
  )
}
