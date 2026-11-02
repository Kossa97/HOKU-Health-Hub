import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'
import { darfErkenntnisseSehen, ERKENNTNISSE_FREI } from '../lib/zugang'
import { ladeWoche } from './erkenntnisseService'
import { useErkenntnisseTexte } from './texte'

/**
 * Karte auf Home: „Dein Wochen-Update ist da" — nur mit Freischaltung,
 * Einwilligung und einer ungelesenen sichtbaren Woche. Geladen wird nach dem
 * ersten Bild, alles in einem try: Fehler bleiben still, Home läuft für alle
 * anderen unverändert. (Bewusst nicht über `useDotZugang` — dessen Abfrage
 * steht nicht im try, und ein Wurf dort risse Home mit.)
 */
export function WochenUpdateHomeKarte() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { et } = useErkenntnisseTexte()
  const [ungelesenFuer, setUngelesenFuer] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let aus = false
    void (async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('is_admin, erkenntnisse_consent_at').eq('id', user.id).maybeSingle()
        if (error || !data) return
        const p = data as { is_admin: boolean | null; erkenntnisse_consent_at: string | null }
        if (!darfErkenntnisseSehen(ERKENNTNISSE_FREI, p.is_admin === true, import.meta.env.DEV) || !p.erkenntnisse_consent_at) return
        const woche = await ladeWoche(user.id)
        if (!aus && woche && !woche.gelesen) setUngelesenFuer(user.id)
      } catch {
        // still: Home bleibt, wie es ist
      }
    })()
    return () => { aus = true }
  }, [user])

  if (!user || ungelesenFuer !== user.id) return null
  return (
    <button
      type="button"
      onClick={() => navigate('/erkenntnisse')}
      className="card lg-press flex w-full items-center gap-3 text-left"
      data-erkenntnisse-home-karte
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--lg-accent-text)]">{et('home_kopf')}</span>
        <span className="text-[17px] font-semibold leading-snug text-[var(--lg-text)]">{et('home_karte')}</span>
      </span>
      <ChevronRight size={20} aria-hidden="true" className="shrink-0 text-[var(--lg-text-3)]" />
    </button>
  )
}
