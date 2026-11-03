import { useState, type CSSProperties } from 'react'
import { Plus, Target } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DaySummary } from '../../../features/ernaehrung/components/DaySummary'
import { DEFAULT_GOALS, type Nutrients } from '../../../features/ernaehrung/lib/nutrition'
import { setOrbOrigin } from '../../../features/ernaehrung/lib/orbBridge'
import { useVorschauHoku } from '../MockupApp'
import { vorschauText } from '../texte'

/**
 * Kalorientracker wie in der App: die echte Tageskugel (`DaySummary`, eigene
 * Engine) mit Beispielmahlzeiten darunter. „Hinzufügen" trägt eine passende
 * Mahlzeit ein; die Punkte fliegen vom Knopf in die Kugel, wie in der App.
 */
interface Posten { name: string; menge: string; kcal: number; protein: number; carbs: number; fat: number }
type Mahl = 'mahlzeit_fruehstueck' | 'mahlzeit_mittag' | 'mahlzeit_abend'
const VORRAT: Record<Mahl, Posten[]> = {
  mahlzeit_fruehstueck: [
    { name: 'Skyr Natur', menge: '200 g', kcal: 126, protein: 22, carbs: 8, fat: 0.4 },
    { name: 'Haferflocken', menge: '60 g', kcal: 222, protein: 8, carbs: 36, fat: 4 },
    { name: 'Banane', menge: '1 Stück', kcal: 105, protein: 1, carbs: 27, fat: 0.4 },
  ],
  mahlzeit_mittag: [
    { name: 'Hähnchen mit Reis', menge: '350 g', kcal: 540, protein: 42, carbs: 60, fat: 12 },
    { name: 'Gemüsepfanne', menge: '250 g', kcal: 180, protein: 6, carbs: 18, fat: 9 },
  ],
  mahlzeit_abend: [
    { name: 'Lachs', menge: '150 g', kcal: 310, protein: 31, carbs: 0, fat: 20 },
    { name: 'Süßkartoffel', menge: '200 g', kcal: 172, protein: 3, carbs: 40, fat: 0.2 },
  ],
}
const leer: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: null, sugar: null, salt: null } as Nutrients
const panel: CSSProperties = { borderRadius: 'var(--r-xl)', position: 'relative', overflow: 'hidden' }

export function KalorienScreen() {
  const { i18n } = useTranslation()
  const hoku = useVorschauHoku()
  const lang = i18n.language?.startsWith('de') ? 'de' : 'en'
  const [eintraege, setEintraege] = useState<Record<Mahl, Posten[]>>({ mahlzeit_fruehstueck: [VORRAT.mahlzeit_fruehstueck[0]], mahlzeit_mittag: [], mahlzeit_abend: [] })
  const total = (Object.values(eintraege).flat()).reduce<Nutrients>((s, p) => ({ ...s, kcal: s.kcal + p.kcal, protein: s.protein + p.protein, carbs: s.carbs + p.carbs, fat: s.fat + p.fat }), leer)

  const hinzu = (mahl: Mahl, knopf: HTMLElement) => {
    const naechster = VORRAT[mahl][eintraege[mahl].length % VORRAT[mahl].length]
    const r = knopf.getBoundingClientRect()
    setOrbOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2, r: 16 })
    setEintraege(e => ({ ...e, [mahl]: [...e[mahl], naechster] }))
    const kcal = total.kcal + naechster.kcal
    const d = hoku.dot()
    if (d && d.modus() === 'home') d.sag(vorschauText(lang, kcal >= DEFAULT_GOALS.kcal ? 'kalorien_ziel' : 'kalorien_rein', { kcal: naechster.kcal }), 3000)
  }

  return (
    <>
      <DaySummary total={total} goals={DEFAULT_GOALS} date="2026-11-03" ready onOpenGoals={() => hoku.sag('ziele')} onClose={() => {}} />
      <div className="lg-surface lg-flat" style={{ ...panel, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--accent)', color: 'var(--accent-contrast)', flexShrink: 0 }}><Target size={20} /></span>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.4, color: 'var(--lg-text-2)' }}>{hoku.t('ziele_hinweis')}</p>
      </div>
      {(Object.keys(VORRAT) as Mahl[]).map(mahl => {
        const liste = eintraege[mahl]
        const kcal = liste.reduce((s, p) => s + p.kcal, 0)
        return (
          <section key={mahl} className="lg-surface lg-flat" style={{ ...panel, padding: '14px 16px 6px' }} aria-label={hoku.t(mahl)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{hoku.t(mahl)}</h2>
              {kcal > 0 && <span style={{ fontSize: 15, color: 'var(--lg-text-2)', fontVariantNumeric: 'tabular-nums' }}>{kcal} kcal</span>}
              <button type="button" className="lg-press" onClick={e => hinzu(mahl, e.currentTarget)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 40, padding: '0 6px', border: 0, background: 'none', font: 'inherit', fontSize: 16, fontWeight: 600, color: 'var(--accent)' }}>
                <Plus size={18} strokeWidth={2.4} /> {hoku.t('hinzufuegen')}
              </button>
            </div>
            {liste.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, borderTop: i ? '1px solid var(--lg-hair)' : undefined }}>
                <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: 'radial-gradient(circle at 40% 35%, #a6f36b 0 2px, transparent 3px), radial-gradient(circle at 65% 60%, #bf5af2 0 2px, transparent 3px), radial-gradient(circle at 30% 70%, #ff9f0a 0 2px, transparent 3px), radial-gradient(circle, rgba(255,255,255,0.25), rgba(255,255,255,0.05) 70%)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 17, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--lg-text-3)' }}>{p.menge} · {Math.round(p.protein)} {lang === 'de' ? 'E' : 'P'} · {Math.round(p.carbs)} {lang === 'de' ? 'K' : 'C'} · {Math.round(p.fat)} F</p>
                </div>
                <span style={{ fontSize: 17, color: 'var(--lg-text-2)', fontVariantNumeric: 'tabular-nums' }}>{p.kcal}</span>
              </div>
            ))}
          </section>
        )
      })}
    </>
  )
}
