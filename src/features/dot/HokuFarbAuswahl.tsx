/**
 * Profil: Hokus Farbe wählen (Nutzer 02.11.2026). „Passend zum Design“ ist der
 * Standard und nimmt die Farbe, die zum gewählten Erscheinungsbild gehört.
 */
import { useActiveLook } from '../../lib/look'
import { HOKU_FARBEN, STANDARD_JE_LOOK, muster, useHokuFarbWahl, type HokuFarbe, type HokuFarbWahl } from './lib/hokuFarbe'
import { useDotText, type DotTextKey } from './texte'

const name = (f: HokuFarbe) => `farbe_${f}` as DotTextKey

function Muster({ farbe }: { farbe: HokuFarbe }) {
  const [v, r, h] = muster(farbe)
  const rgb = (c: readonly number[]) => `rgb(${c[0]},${c[1]},${c[2]})`
  return (
    <span
      aria-hidden="true"
      style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: `radial-gradient(circle at 38% 34%, ${rgb(v)} 0%, ${rgb(r)} 48%, ${rgb(h)} 100%)`,
        boxShadow: `0 0 12px ${rgb(r)}55`,
      }}
    />
  )
}

export function HokuFarbAuswahl() {
  const { dt } = useDotText()
  const look = useActiveLook()
  const [wahl, setWahl] = useHokuFarbWahl()
  const standard = STANDARD_JE_LOOK[look]
  const knopf = (w: HokuFarbWahl, f: HokuFarbe, text: string) => {
    const an = wahl === w
    return (
      <button
        key={w}
        type="button"
        aria-pressed={an}
        onClick={() => setWahl(w)}
        data-hoku-farbe={w}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '8px 10px',
          borderRadius: 12, textAlign: 'left', font: 'inherit', fontSize: 14, color: 'var(--lg-text)',
          background: an ? 'var(--lg-fill-strong, rgba(255,255,255,0.12))' : 'transparent',
          border: `1px solid ${an ? 'var(--lg-text-2, rgba(255,255,255,0.6))' : 'var(--lg-separator, rgba(255,255,255,0.12))'}`,
          cursor: 'pointer',
        }}
      >
        <Muster farbe={f} />
        <span style={{ minWidth: 0 }}>{text}</span>
      </button>
    )
  }
  return (
    <div style={{ marginTop: 24 }} data-hoku-farbwahl>
      <p className="lg-group-title">{dt('farbe_titel')}</p>
      <div className="card">
        <div role="group" aria-label={dt('farbe_titel')} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {knopf('auto', standard, dt('farbe_auto_jetzt', { farbe: dt(name(standard)) }))}
          {HOKU_FARBEN.map(f => knopf(f, f, dt(name(f))))}
        </div>
        <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.45, color: 'var(--lg-text-3)' }}>{dt('farbe_hinweis')}</p>
      </div>
    </div>
  )
}
