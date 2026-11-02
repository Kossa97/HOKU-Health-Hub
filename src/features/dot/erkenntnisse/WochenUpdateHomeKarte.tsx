import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import type { supabase } from '../../../lib/supabase'
import { ladeWoche } from './erkenntnisseService'
import { erkenntnisseAktivFuer } from './homeZugang'
import { useErkenntnisseTexte } from './texte'

/**
 * Karte auf Home: „Dein Wochen-Update ist da" — nur mit Freischaltung,
 * Einwilligung und einer ungelesenen sichtbaren Woche. Geladen wird nach dem
 * ersten Bild über Homes Daten-Client, alles in einem try: Fehler bleiben
 * still, Home läuft für alle anderen unverändert. (Bewusst nicht über
 * `useDotZugang` — dessen Abfrage steht nicht im try, und ein Wurf dort risse
 * Home mit.) Die Freischaltung fragt `homeZugang.ts` nur einmal je Sitzung.
 */
export function WochenUpdateHomeKarte({ client }: { client: typeof supabase }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { et } = useErkenntnisseTexte()
  const [ungelesenFuer, setUngelesenFuer] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let aus = false
    void (async () => {
      try {
        if (!(await erkenntnisseAktivFuer(client, user.id))) return
        const woche = await ladeWoche(user.id, new Date(), client)
        if (!aus && woche && !woche.gelesen) setUngelesenFuer(user.id)
      } catch {
        // still: Home bleibt, wie es ist
      }
    })()
    return () => { aus = true }
  }, [client, user])

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
