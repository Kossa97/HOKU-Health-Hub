/**
 * Blutspiegel-Übersicht im Stil der Aktienliste: je Substanz eine Zeile mit
 * Name, Mini-Verlauf der letzten 24 h, aktuellem Spiegel und Veränderung.
 * Ein Tipp führt in die Detailansicht (/simulation/<eintrag>).
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plus } from 'lucide-react'
import { LiveStatus } from './LiveStatus'
import { behebbar, type EntryCurve, type ReadyEntry } from './entries'
import { useBlutspiegelData } from './useBlutspiegelData'
import { formatOffset, useBlutspiegelFormat } from './format'
import { aenderungSeit, type LevelPoint } from './chart/stocksChartMath'
import { NoCurveRow } from './BlutspiegelView'
import { MANUELL_PFAD, detailPfad } from './pfade'

const DAY = 24 * 3_600_000
/** Darunter gilt ein Spiegel als abgeklungen: „0,0 %“ mit „±0,0“ sagt nichts. */
const ABGEKLUNGEN_UNTER = 0.5
/** Kleinste Spanne der Mini-Kurve in Prozentpunkten — sonst wird Rauschen zur Zacke. */
const MIN_SPANNE = 2

function Verlauf({ points, now, color, ruhig }: { points: LevelPoint[]; now: number; color: string; ruhig: boolean }) {
  const W = 72
  const H = 32
  const tag = points.filter(p => p.ts >= now - DAY)
  if (tag.length < 2) return <span aria-hidden="true" style={{ width: W, height: H, flexShrink: 0 }} />
  let min = Infinity
  let max = -Infinity
  for (const p of tag) { min = Math.min(min, p.level); max = Math.max(max, p.level) }
  // Eigene Spanne je Zeile, wie in der Aktienliste: die Form zaehlt, nicht die Hoehe.
  const span = Math.max(MIN_SPANNE, max - min)
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
      {!ruhig && <path d={`${line}L${W},${H}L0,${H}Z`} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={ruhig ? 'var(--lg-text-3)' : color} strokeOpacity={ruhig ? 0.5 : 1} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Zeile({ entry, curve, now }: { entry: ReadyEntry; curve: EntryCurve | undefined; now: number }) {
  const f = useBlutspiegelFormat()
  const { t } = f
  const points = curve?.points ?? []
  const pausiert = curve?.interruptedAt != null
  const abgeklungen = !pausiert && curve?.current != null && curve.current < ABGEKLUNGEN_UNTER
  const change = pausiert || abgeklungen ? null : aenderungSeit(points, now - DAY)
  // Neutral: zwischen zwei Dosen faellt der Spiegel immer — das ist kein Warnsignal.
  const linie = entry.accent
  const naechste = entry.nextDoseAt != null ? formatOffset(entry.nextDoseAt - now, t) : null
  return (
    <li>
      <Link
        to={detailPfad(entry.key)}
        // Rueckmeldung beim Druecken, nicht erst beim Loslassen.
        className="flex min-h-[64px] items-center gap-3 px-4 py-2.5 transition-colors duration-100 active:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--lg-accent)]"
        style={{ color: 'var(--text)', WebkitTapHighlightColor: 'transparent' }}
        data-bs-row={entry.key}
        data-bs-decayed={abgeklungen || undefined}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[17px] font-semibold">{entry.name}</span>
          <span className="truncate text-[13px]" style={{ color: 'var(--lg-text-2)' }}>
            {pausiert ? t('pk_overview_paused') : naechste ? t('pk_overview_next', { when: naechste }) : t('pk_overview_no_next')}
          </span>
        </span>
        <Verlauf points={points} now={now} color={linie} ruhig={pausiert || abgeklungen} />
        {abgeklungen ? (
          <span className="flex w-[84px] shrink-0 justify-end whitespace-nowrap text-[13px] font-medium" style={{ color: 'var(--lg-text-3)' }}>
            {t('pk_overview_decayed')}
          </span>
        ) : (
          <span className="flex w-[84px] shrink-0 flex-col items-end gap-1 tabular-nums">
            <span className="text-[17px] font-semibold" style={pausiert ? { color: 'var(--lg-text-2)' } : undefined}>{curve?.current != null ? `${f.pct(curve.current)} %` : '—'}</span>
            <span
              className="min-w-[56px] rounded-[7px] px-1.5 py-[2px] text-right text-[13px] font-semibold"
              style={{ background: 'var(--lg-fill)', color: 'var(--lg-text-2)' }}
              data-bs-change
            >
              {change == null ? '—' : f.signed(change)}
            </span>
          </span>
        )}
      </Link>
    </li>
  )
}

/** Kopf wie die Aktienliste: Titel, „+“ für die eigene Simulation, Live-Stand. */
function Kopf({ asOf, refreshing, naechsterTakt }: { asOf: number; refreshing: boolean; naechsterTakt: number }) {
  const { t } = useBlutspiegelFormat()
  return (
    <header className="grid items-start gap-x-3" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
      <h1 className="lg-large-title min-w-0 truncate">{t('pk_title')}</h1>
      <Link
        to={MANUELL_PFAD}
        aria-label={t('pk_manual_open')}
        title={t('pk_manual_open')}
        className="lg-glass lg-icon-btn lg-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        data-bs-manual
      >
        <Plus size={22} />
      </Link>
      <p className="col-span-2 mt-1 max-w-[34ch] text-[15px] leading-snug" style={{ color: 'var(--lg-text-2)' }} data-bs-intro>
        {t('pk_overview_intro')}
      </p>
      <div className="col-span-2 mt-2">
        <LiveStatus asOf={asOf} refreshing={refreshing} naechsterTakt={naechsterTakt} />
      </div>
    </header>
  )
}

/** children: Fusszeile unter der Liste (Medizin-Hinweis, Haftung). */
export function BlutspiegelUebersicht({ children }: { children?: ReactNode }) {
  const data = useBlutspiegelData()
  const f = useBlutspiegelFormat()
  const { t } = f
  // Ohne PK-Profil gibt es nie eine Kurve und nichts zu tun — das bleibt weg.
  const missing = data.entries.filter(behebbar)
  const kopf = <Kopf asOf={data.asOf} refreshing={data.refreshing} naechsterTakt={data.naechsterTakt} />

  if (data.error) return <div className="flex flex-col gap-4">{kopf}<p role="alert" className="text-sm" style={{ color: 'var(--lg-text-2)' }}>{t('pk_data_load_error')}</p>{children}</div>
  if (data.loading) {
    return (
      <div className="flex flex-col gap-4">
        {kopf}
        <div className="flex min-h-[200px] items-center justify-center gap-2.5">
          <Loader2 size={18} color="var(--accent)" className="animate-spin" />
          <span className="text-sm" style={{ color: 'var(--lg-text-2)' }}>{t('pk_live_loading')}</span>
        </div>
        {children}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {kopf}
      {data.ready.length > 0 ? (
        <section aria-label={t('pk_overview_list')}>
          <ul className="lg-group lg-rows">
            {data.ready.map(entry => (
              <Zeile key={entry.key} entry={entry} curve={data.curves.get(entry.key)} now={data.asOf} />
            ))}
          </ul>
          <p className="mx-4 mt-2 text-[13px] leading-snug" style={{ color: 'var(--lg-text-3)' }}>{t('pk_overview_hint')}</p>
        </section>
      ) : (
        <p className="py-6 text-center text-sm" style={{ color: 'var(--lg-text-3)' }}>{t('pk_no_ready_items')}</p>
      )}

      {missing.length > 0 && (
        <section>
          <h2 className="lg-group-title">{t('pk_incomplete_title')}</h2>
          <div className="lg-group lg-rows">{missing.map(entry => <NoCurveRow key={entry.key} entry={entry} />)}</div>
        </section>
      )}
      {children}
    </div>
  )
}
