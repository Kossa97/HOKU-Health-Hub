import { createContext, useContext, useEffect, useState } from 'react'
import { isAuthRetryableFetchError, type Session, type User } from '@supabase/supabase-js'
import { vergissAbdruecke } from '../components/ui/umrissAbdruck'
import { AUTH_STORAGE_KEY, supabase } from '../lib/supabase'
import { setzeAngemeldetenNutzer, vergissOfflineDaten } from '../lib/stoerung'
import { vergissDotVerlauf } from '../features/dot/chat/coachService'

interface AuthContextType {
  session: Session | null
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
})

/**
 * Abgelaufene Sitzung ohne Netz: supabase-js kann das Token nicht erneuern,
 * gibt `null` zurück, lässt die Sitzung aber im Speicher. Damit niemand
 * offline auf die Anmeldung fliegt, gilt die gespeicherte weiter — Daten
 * kommen dann aus dem Offline-Cache, und sobald das Netz zurück ist,
 * erneuert supabase-js das Token selbst (TOKEN_REFRESHED).
 */
function gespeicherteSitzung(): Session | null {
  try {
    const roh = localStorage.getItem(AUTH_STORAGE_KEY)
    const sitzung = roh ? (JSON.parse(roh) as Session) : null
    return sitzung?.user?.id ? sitzung : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // Der Offline-Cache erfährt sofort, wessen Daten er lesen darf — vor dem
  // ersten Rendern der Seiten, die gleich laden
  const setSession = (neu: Session | null) => {
    setzeAngemeldetenNutzer(neu?.user?.id ?? null)
    setSessionState(neu)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      setSession(session ?? (error && isAuthRetryableFetchError(error) ? gespeicherteSitzung() : null))
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Den Start regelt getSession oben — offline käme hier sonst `null`
      // und würfe die gerettete Sitzung wieder weg
      if (event === 'INITIAL_SESSION') return
      // Jeder Weg hinaus (Abmelden, Konto gelöscht, Sitzung abgelaufen)
      if (event === 'SIGNED_OUT') {
        vergissAbdruecke()
        vergissDotVerlauf()
        void vergissOfflineDaten()
      }
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    // Ohne Netz meldet supabase-js nur den Fehler und bleibt angemeldet —
    // auf dem Gerät trotzdem abmelden
    if (error && isAuthRetryableFetchError(error)) {
      try { localStorage.removeItem(AUTH_STORAGE_KEY) } catch { /* kein Speicher */ }
      vergissAbdruecke()
      vergissDotVerlauf()
      await vergissOfflineDaten()
      setSession(null)
    }
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
