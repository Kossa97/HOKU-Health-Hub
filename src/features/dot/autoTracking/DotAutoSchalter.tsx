import { useState } from 'react'
import toast from 'react-hot-toast'
import { Schalter } from '../../../components/ui/Schalter'
import { useDotStand } from '../dotStore'
import { useDotText, type DotTextKey } from '../texte'

/**
 * Der Schalter „Dot trägt automatisch ein" — an einer Substanz oder einem
 * Bündel. Ohne Pro sichtbar, aber nicht schaltbar (ein bestehender Schalter
 * lässt sich trotzdem ausschalten). `speichern` schreibt `auto_log_since`.
 */
export function DotAutoSchalter({ seit, text, speichern, kompakt = false, hinweis }: {
  seit: string | null | undefined
  text: DotTextKey
  speichern(seit: string | null): Promise<void>
  /** Ohne eigene Gruppe, etwa im Bündel-Blatt. */
  kompakt?: boolean
  /** Zusatz unter dem Text, etwa wenn ein Bündel die Substanz schon einträgt. */
  hinweis?: string | null
}) {
  const { dt } = useDotText()
  const { darfRaus, geladen } = useDotStand()
  const [an, setAn] = useState(Boolean(seit))
  const [arbeitet, setArbeitet] = useState(false)
  // Erst gesperrt, wenn feststeht, dass kein Pro da ist (sonst ginge ein Tipp beim Laden verloren)
  const ohnePro = geladen && !darfRaus
  const gesperrt = ohnePro && !an

  const umschalten = async () => {
    if (arbeitet || gesperrt) return
    const neu = !an
    setAn(neu); setArbeitet(true)
    try {
      await speichern(neu ? new Date().toISOString() : null)
    } catch {
      setAn(!neu)
      toast.error(dt('auto_fehler'))
    } finally {
      setArbeitet(false)
    }
  }

  const zeile = (
    <div className="flex items-center gap-3 px-4 py-3" data-dot-auto={an ? 'an' : 'aus'}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[17px] text-[var(--lg-text)]">{dt('auto_titel')}</span>
          {ohnePro && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-[var(--lg-accent-text)]" style={{ background: 'rgba(0, 204, 245, 0.15)' }}>{dt('auto_pro')}</span>}
        </div>
        <p className="mt-0.5 text-[13px] leading-snug text-[var(--lg-text-3)]">{dt(text)}</p>
        {hinweis && <p className="mt-1 text-[13px] leading-snug text-[var(--lg-accent-text)]">{hinweis}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={an}
        aria-label={dt('auto_titel')}
        aria-disabled={gesperrt || undefined}
        onClick={() => void umschalten()}
        className={`shrink-0 ${gesperrt ? 'opacity-40' : ''}`}
      >
        <Schalter an={an} />
      </button>
    </div>
  )
  return kompakt ? zeile : <section className="mt-7"><div className="lg-group">{zeile}</div></section>
}
