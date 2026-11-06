import { lazy, Suspense } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useDotStand } from '../../dot/dotStore'
import { importWithReload } from '../../../lib/staleChunkReload'
import { titleMomentStore, usePendingTitleMoment } from '../lib/titleMomentStore'

// Der Moment selbst (Namen, Abzeichen, Bewegung) kommt erst, wenn es etwas zu zeigen gibt.
const TitelMoment = lazy(importWithReload(() => import('./TitelMoment').then(m => ({ default: m.TitelMoment }))))

/**
 * Im Layout eingehängt: zeigt den Moment „Neuer Rang“ / „Neuer Titel“, den der
 * Schnappschuss-Lauf nach dem Speichern neu verdienter Abzeichen abgelegt hat.
 * Wartet, solange Dot nach der Anmeldung im Portal ist (wie die Passkey-Frage).
 */
export function TitelMomentHost() {
  const pending = usePendingTitleMoment()
  const { user } = useAuth()
  const dot = useDotStand()
  if (!pending || !user || pending.userId !== user.id || dot.modus === 'portal') return null
  const moment = pending.kind === 'rank' ? { kind: 'rank' as const, id: pending.id } : { kind: 'badge' as const, id: pending.id }
  return (
    <Suspense fallback={null}>
      {/* Neuer Moment, neuer Lauf: key bricht den laufenden ab und spielt von vorn */}
      <TitelMoment key={pending.seq} moment={moment} userId={user.id} onDone={() => titleMomentStore.dismiss(pending.seq)} />
    </Suspense>
  )
}
