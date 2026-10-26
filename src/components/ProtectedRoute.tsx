import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SilhouettenHuelle } from './ui/Silhouette'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const { pathname } = useLocation()

  // Anmeldung wird geprüft: schon der Umriss der Seite, die gleich kommt
  if (loading) return <SilhouettenHuelle pfad={pathname} />

  if (!session) return <Navigate to="/auth" replace />

  return <>{children}</>
}
