import { useState, type CSSProperties } from 'react'
import { Bell, Box, CalendarDays, Check, CheckCircle2, ChevronRight, FlaskConical, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useVorschauHoku } from '../MockupApp'

/**
 * Startseite wie in der App (pages/Home.tsx), mit Beispieldaten: Ring „Heute",
 * anstehende Einnahmen mit „Alle als eingenommen markieren", drei Kacheln.
 * Ein Tipp trägt ein; der Ring füllt sich, Hoku freut sich.
 */
const panel: CSSProperties = { borderRadius: 'var(--r-xl)', position: 'relative', overflow: 'hidden' }
const titel: CSSProperties = { marginTop: 2, fontSize: 34, lineHeight: '41px', fontWeight: 700, letterSpacing: '0.011em', color: 'var(--text)' }
const abschnitt: CSSProperties = { fontSize: 20, fontWeight: 700, letterSpacing: '0.019em', color: 'var(--text)' }
const kopf: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44, margin: '0 4px 6px' }

interface Einnahme { id: string; substanz: string; dosis: string; zeit: string; gruppe: 'morgens' | 'abends'; genommen: boolean }
const START: Einnahme[] = [
  { id: 'bpc', substanz: 'BPC-157', dosis: '250 mcg', zeit: '08:00', gruppe: 'morgens', genommen: false },
  { id: 'd3', substanz: 'Vitamin D3', dosis: '4000 IE', zeit: '08:00', gruppe: 'morgens', genommen: false },
  { id: 'mg', substanz: 'Magnesium', dosis: '400 mg', zeit: '21:00', gruppe: 'abends', genommen: false },
]

function Ring({ prozent, fertig }: { prozent: number; fertig: boolean }) {
  const p = Math.max(0, Math.min(100, prozent)) / 100
  const [von, bis] = fertig ? ['#1fae4b', '#a6f36b'] : ['#00a9d4', '#5ae0ff']
  const maske = 'radial-gradient(farthest-side, transparent calc(100% - 11px), #000 calc(100% - 10.5px))'
  return (
    <div style={{ position: 'relative', width: 76, height: 76, flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,204,245,0.12)', WebkitMaskImage: maske, maskImage: maske }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `conic-gradient(from -90deg, ${von}, ${bis} ${p * 360}deg, transparent ${p * 360}deg)`, WebkitMaskImage: maske, maskImage: maske, transition: 'background 600ms cubic-bezier(0.23, 1, 0.32, 1)' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
        {fertig ? <Check size={26} strokeWidth={3} /> : `${Math.round(p * 100)}%`}
      </div>
    </div>
  )
}

export function HeuteScreen() {
  const { t } = useTranslation()
  const hoku = useVorschauHoku()
  const [einnahmen, setEinnahmen] = useState(START)
  const geloggt = einnahmen.filter(e => e.genommen).length
  const prozent = Math.round((geloggt / einnahmen.length) * 100)
  const fertig = geloggt === einnahmen.length

  const alle = (gruppe: Einnahme['gruppe']) => {
    const neu = einnahmen.map(e => (e.gruppe === gruppe ? { ...e, genommen: true } : e))
    setEinnahmen(neu)
    if (neu.every(e => e.genommen)) hoku.freude('heute_alles'); else hoku.freude('heute_einzeln')
  }
  const einzeln = (id: string) => {
    const neu = einnahmen.map(e => (e.id === id ? { ...e, genommen: !e.genommen } : e))
    setEinnahmen(neu)
    if (neu.every(e => e.genommen)) hoku.freude('heute_alles')
    else if (neu.find(e => e.id === id)?.genommen) hoku.sag('heute_einzeln', 2600)
  }
  const gruppen = (['morgens', 'abends'] as const).map(g => ({ key: g, label: t(g === 'morgens' ? 'routine_group_morning' : 'routine_group_evening', { defaultValue: g === 'morgens' ? 'Morgens' : 'Abends' }), items: einnahmen.filter(e => e.gruppe === g) }))

  return (
    <>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, padding: '4px 4px 0' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--lg-text-2)' }}>{hoku.t('heute_datum')}</p>
          <h1 style={titel}>{hoku.t('heute_gruss')}</h1>
        </div>
        <button type="button" aria-label={String(t('tile_profil', { defaultValue: 'Profil' }))} className="lg-glass lg-press"
          style={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, color: 'var(--lg-text)' }}>
          <User size={20} />
        </button>
      </header>

      <section className="lg-surface lg-flat" style={{ ...panel, padding: 18, display: 'flex', alignItems: 'center', gap: 18 }}>
        <Ring prozent={prozent} fertig={fertig} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>{t('home_completion', { defaultValue: 'Heute erledigt' })}</p>
          <p style={{ marginTop: 3, fontSize: 15, lineHeight: 1.35, color: 'var(--lg-text-2)' }}>{`${geloggt}/${einnahmen.length} ${t('home_completion_unit', { defaultValue: 'Einnahmen geloggt' })}`}</p>
        </div>
      </section>

      <section>
        <div style={kopf}>
          <h2 style={abschnitt}>{t('home_upcoming_intakes', { defaultValue: 'Anstehende Einnahmen' })}</h2>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--lg-text-3)' }}>{t('home_due_in', { defaultValue: 'fällig in:' })}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {gruppen.map(g => {
            const offen = g.items.some(e => !e.genommen)
            return (
              <div key={g.key} className="lg-surface lg-flat" style={{ ...panel, padding: '12px 14px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--lg-text-2)' }}>{g.label}</p>
                  <button type="button" className="lg-press" disabled={!offen} onClick={() => alle(g.key)}
                    aria-label={`${t('routine_confirmation_confirm_all', { defaultValue: 'Alle als eingenommen markieren' })} – ${g.label}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 12px', borderRadius: 999, border: 0, font: 'inherit', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                      background: offen ? 'color-mix(in srgb, var(--lg-good) 14%, transparent)' : 'var(--lg-fill)', color: offen ? 'var(--lg-good-text)' : 'var(--lg-text-3)',
                      boxShadow: offen ? 'inset 0 0 0 1px color-mix(in srgb, var(--lg-good) 35%, transparent)' : undefined, transition: 'background 300ms, color 300ms',
                    }}>
                    <CheckCircle2 size={15} aria-hidden="true" /> {t('routine_confirmation_confirm_all', { defaultValue: 'Alle als eingenommen markieren' })}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {g.items.map(e => {
                    const faellig = !e.genommen && e.gruppe === 'morgens'
                    const c = e.genommen ? 'var(--lg-good-text)' : faellig ? 'var(--lg-warn)' : 'var(--accent)'
                    return (
                      <button key={e.id} type="button" className="lg-press" onClick={() => einzeln(e.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: 52, textAlign: 'left', padding: '0 2px', border: 0, background: 'none', font: 'inherit' }}>
                        <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', color: c, transition: 'background 300ms',
                          background: e.genommen ? 'color-mix(in srgb, var(--lg-good) 18%, transparent)' : faellig ? 'color-mix(in srgb, var(--lg-warn) 18%, transparent)' : 'var(--accent-weak)' }}>
                          {e.genommen ? <Check size={15} strokeWidth={3} /> : <Bell size={15} className={faellig ? 'pulse-soft' : undefined} />}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 17, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: e.genommen ? 'line-through' : undefined, opacity: e.genommen ? 0.6 : 1 }}>
                          {e.substanz} · {e.dosis}<span style={{ color: 'var(--lg-text-3)' }}>{` · ${t('home_at_time', { defaultValue: 'um' })} ${e.zeit}`}</span>
                        </span>
                        {e.genommen ? (
                          <span style={{ flexShrink: 0, fontSize: 15, fontWeight: 600, color: 'var(--lg-good-text)' }}>{t('taken', { defaultValue: 'Eingenommen' })}</span>
                        ) : faellig ? (
                          <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 600, color: c }}>
                            <span className="pulse-soft" style={{ width: 7, height: 7, borderRadius: '50%', background: c, display: 'inline-block' }} />
                            {t('home_due_label', { defaultValue: 'Jetzt fällig' })}
                          </span>
                        ) : (
                          <span style={{ flexShrink: 0, fontSize: 15, fontWeight: 600, color: 'var(--lg-text-2)', fontVariantNumeric: 'tabular-nums' }}>11h 20m</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <div style={kopf}>
          <h2 style={abschnitt}>{t('home_overview_title', { defaultValue: 'Heute im Blick' })}</h2>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 15, fontWeight: 600, color: 'var(--accent)' }}>{t('today', { defaultValue: 'Heute' })} <ChevronRight size={16} /></span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { Icon: CalendarDays, zahl: 2, text: t('stat_active_cycles', { defaultValue: 'Aktive Zyklen' }), farbe: 'var(--accent)' },
            { Icon: FlaskConical, zahl: 3, text: t('stat_substances', { defaultValue: 'Substanzen in My Stack' }), farbe: 'var(--cat-violet)' },
            { Icon: Box, zahl: 2, text: t('stat_vials_in_stock', { defaultValue: 'Vials im Lager' }), farbe: 'var(--cat-emerald)' },
          ].map(k => (
            <div key={k.text} className="lg-surface lg-flat" style={{ ...panel, padding: '14px 12px', minHeight: 120 }}>
              <k.Icon size={18} style={{ color: k.farbe }} />
              <p style={{ marginTop: 10, fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{k.zahl}</p>
              <p style={{ marginTop: 6, fontSize: 12, lineHeight: 1.3, color: 'var(--lg-text-2)' }}>{k.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
