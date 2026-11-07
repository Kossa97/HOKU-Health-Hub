/**
 * Blutspiegel-Übersicht im Stil der Aktienliste: je Substanz eine Zeile mit
 * Name, Mini-Verlauf der letzten 24 h, aktuellem Spiegel und Veränderung.
 * Ein Tipp führt in die Detailansicht (/simulation/<eintrag>).
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { KurvenUmriss, Silhouette } from '../../components/ui/Silhouette'
import { LiveStatus } from './LiveStatus'
import { behebbar, type EntryCurve, type ProduktGruppe } from './entries'
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

/** Eine Linie der Mini-Kurve; mehrere teilen sich die Achsen der Zeile. */
interface VerlaufLinie { key: string; points: LevelPoint[]; color: string }

function Verlauf({ linien, now, ruhig }: { linien: VerlaufLinie[]; now: number; ruhig: boolean }) {
  const W = 72
  const H = 32
  const tage = linien.map(linie => ({ ...linie, tag: linie.points.filter(p => p.ts >= now - DAY) })).filter(l => l.tag.length >= 2)
  if (!tage.length) return <span aria-hidden="true" style={{ width: W, height: H, flexShrink: 0 }} />
  // Gemeinsame Achsen: bei einem Kombipraeparat sieht man, welcher Wirkstoff gerade hoeher steht.
  let min = Infinity
  let max = -Infinity
  let t0 = Infinity
  let t1 = -Infinity
  for (const { tag } of tage) {
    for (const p of tag) { min = Math.min(min, p.level); max = Math.max(max, p.level) }
    t0 = Math.min(t0, tag[0].ts)
    t1 = Math.max(t1, tag[tag.length - 1].ts)
  }
  // Eigene Spanne je Zeile, wie in der Aktienliste: die Form zaehlt, nicht die Hoehe.
  const span = Math.max(MIN_SPANNE, max - min)
  const dt = Math.max(1, t1 - t0)
  const pfad = (tag: LevelPoint[]) => tag
    .map((p, i) => `${i ? 'L' : 'M'}${(((p.ts - t0) / dt) * W).toFixed(1)},${(H - 3 - ((p.level - min) / span) * (H - 6)).toFixed(1)}`)
    .join('')
  // Die Flaeche nur bei einer Linie — uebereinander wuerden Flaechen zu Matsch.
  const flaeche = tage.length === 1 && !ruhig
  const id = `bs-v-${tage[0].key.replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" style={{ flexShrink: 0 }}>
      {flaeche && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tage[0].color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={tage[0].color} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
      {flaeche && <path d={`${pfad(tage[0].tag)}L${W},${H}L0,${H}Z`} fill={`url(#${id})`} />}
      {tage.map(({ key, tag, color }) => (
        <path key={key} d={pfad(tag)} fill="none" stroke={ruhig ? 'var(--lg-text-3)' : color} strokeOpacity={ruhig ? 0.5 : 1} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      ))}
    </svg>
  )
}

function Zeile({ gruppe, curves, now }: { gruppe: ProduktGruppe; curves: Map<string, EntryCurve>; now: number }) {
  const f = useBlutspiegelFormat()
  const { t } = f
  const kombi = gruppe.wirkstoffe.length > 1
  const erster = gruppe.wirkstoffe[0]
  const curve = curves.get(erster.key)
  const points = curve?.points ?? []
  // Ein Zyklus: Pause und naechste Einnahme gelten fuer alle Wirkstoffe.
  const pausiert = curve?.interruptedAt != null
  const abgeklungen = !pausiert && gruppe.wirkstoffe.every(w => {
    const c = curves.get(w.key)?.current
    return c != null && c < ABGEKLUNGEN_UNTER
  })
  const change = pausiert || abgeklungen || kombi ? null : aenderungSeit(points, now - DAY)
  const naechste = erster.nextDoseAt != null ? formatOffset(erster.nextDoseAt - now, t) : null
  const linien = gruppe.wirkstoffe.map(w => ({ key: w.key, points: curves.get(w.key)?.points ?? [], color: w.accent }))
  return (
    <li>
      <Link
        to={detailPfad(gruppe.key)}
        // Rueckmeldung beim Druecken, nicht erst beim Loslassen.
        className="flex min-h-[64px] items-center gap-3 px-4 py-2.5 transition-colors duration-100 active:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--lg-accent)]"
        style={{ color: 'var(--text)', WebkitTapHighlightColor: 'transparent' }}
        data-bs-row={gruppe.key}
        data-bs-decayed={abgeklungen || undefined}
        data-bs-lines={linien.length}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[17px] font-semibold">{gruppe.name}</span>
          <span className="truncate text-[13px]" style={{ color: 'var(--lg-text-2)' }}>
            {pausiert ? t('pk_overview_paused') : naechste ? t('pk_overview_next', { when: naechste }) : t('pk_overview_no_next')}
          </span>
        </span>
        <Verlauf linien={linien} now={now} ruhig={pausiert || abgeklungen} />
        {abgeklungen ? (
          <span className="flex w-[84px] shrink-0 justify-end whitespace-nowrap text-[13px] font-medium" style={{ color: 'var(--lg-text-3)' }}>
            {t('pk_overview_decayed')}
          </span>
        ) : kombi ? (
          // Je Wirkstoff ein Wert mit Farbpunkt — die Farbe verbindet ihn mit seiner Linie.
          <span className="flex w-[84px] shrink-0 flex-col items-end gap-0.5 tabular-nums">
            {gruppe.wirkstoffe.map(w => {
              const wert = curves.get(w.key)?.current
              return (
                <span key={w.key} className="flex items-center gap-1.5 text-[14px] font-semibold" style={pausiert ? { color: 'var(--lg-text-2)' } : undefined} title={w.wirkstoff} data-bs-value={w.key}>
                  <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: w.accent }} />
                  <span className="sr-only">{w.wirkstoff}:</span>
                  {wert != null ? `${f.pct(wert)} %` : '—'}
                </span>
              )
            })}
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
        <Silhouette label={t('pk_live_loading')}><KurvenUmriss /></Silhouette>
        {children}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {kopf}
      {data.produkte.length > 0 ? (
        <section aria-label={t('pk_overview_list')}>
          <ul className="lg-group lg-rows">
            {data.produkte.map(gruppe => (
              <Zeile key={gruppe.key} gruppe={gruppe} curves={data.curves} now={data.asOf} />
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
