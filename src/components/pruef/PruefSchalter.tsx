/**
 * Prüfschalter im Profil, nur in Vorschau-Versionen (PRUEF_SICHTBAR). Jeder
 * Wechsel lädt die App neu, weil die Schalter beim Start greifen.
 * Absichtlich ohne Übersetzung: Werkzeug zum Eingrenzen, kein Teil der App.
 */
import { useState } from 'react'
import { PRUEF_SCHALTER, PRUEF_SICHTBAR, lesePruef, speicherePruef, type Pruef } from '../../lib/pruef'

export function PruefSchalter() {
  const [an] = useState(lesePruef)
  if (!PRUEF_SICHTBAR) return null
  const wechsle = (id: Pruef) => {
    const neu = new Set(an)
    if (neu.has(id)) neu.delete(id); else neu.add(id)
    speicherePruef(neu)
    location.reload()
  }
  return (
    <div className="card mb-4" data-pruef-schalter>
      <h2 className="text-[17px] font-semibold text-[var(--lg-text)]">Prüfschalter (nur Vorschau)</h2>
      <p className="mt-1 mb-3 text-[13px] text-[var(--lg-text-2)]">Jeder Wechsel lädt die App neu.</p>
      <div className="flex flex-col gap-2">
        {PRUEF_SCHALTER.map(s => (
          <button
            key={s.id}
            type="button"
            role="switch"
            aria-checked={an.has(s.id)}
            onClick={() => wechsle(s.id)}
            className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 text-left text-[15px] text-[var(--lg-text)]"
            style={{ background: an.has(s.id) ? 'var(--lg-fill-strong, rgba(255,255,255,0.12))' : 'var(--lg-fill, rgba(255,255,255,0.06))' }}
          >
            <span>{s.text}</span>
            <span className="shrink-0 text-[13px] font-semibold" style={{ color: an.has(s.id) ? 'var(--lg-accent-text)' : 'var(--lg-text-2)' }}>{an.has(s.id) ? 'AN' : 'aus'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
