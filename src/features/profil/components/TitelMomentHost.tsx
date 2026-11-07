import { lazy, Suspense, useEffect, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useDotStand } from '../../dot/dotStore'
import { importWithReload } from '../../../lib/staleChunkReload'
import { titleMomentStore, usePendingTitleMoment } from '../lib/titleMomentStore'

// Der Moment selbst (Namen, Abzeichen, Bewegung) kommt erst, wenn es etwas zu zeigen gibt.
const TitelMoment = lazy(importWithReload(() => import('./TitelMoment').then(m => ({ default: m.TitelMoment }))))

/** Ist gerade ein anderer Dialog der App offen (`data-app-modal`, z. B. der Hoku-Chat)? */
const dialogOffen = () => typeof document !== 'undefined' && document.querySelector('[data-app-modal]') !== null

/** Beobachtet, ob ein Dialog der App offen ist; ändert sich mit dem DOM. */
function useDialogOffen(aktiv: boolean): boolean {
  const [offen, setOffen] = useState(dialogOffen)
  useEffect(() => {
    if (!aktiv || typeof MutationObserver === 'undefined') return
    const pruefe = () => setOffen(dialogOffen())
    pruefe()
    const beob = new MutationObserver(pruefe)
    beob.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-app-modal'] })
    return () => beob.disconnect()
  }, [aktiv])
  return offen
}

/**
 * Im Layout eingehängt: zeigt den Moment „Neuer Rang“ / „Neuer Titel“, den der
 * Schnappschuss-Lauf nach dem Speichern neu verdienter Abzeichen abgelegt hat.
 * Wartet, solange Dot nach der Anmeldung im Portal ist (wie die Passkey-Frage)
 * und solange ein anderer Dialog offen ist (etwa der Hoku-Chat, der gerade den
 * Eintrag gemacht hat); steht er einmal, bleibt er stehen.
 */
export function TitelMomentHost() {
  const pending = usePendingTitleMoment()
  const { user } = useAuth()
  const dot = useDotStand()
  const [gezeigt, setGezeigt] = useState<number | null>(null)
  const wartet = !!pending && gezeigt !== pending.seq
  // Beobachter für spätere Änderungen; beim ersten Blick zählt der Stand jetzt
  const dialog = useDialogOffen(wartet) || (wartet && dialogOffen())
  const darf = !!pending && !!user && pending.userId === user.id && dot.modus !== 'portal'
    && (gezeigt === pending.seq || !dialog)
  // Sobald er stehen darf, merken (während des Renderns, wie von React empfohlen):
  // ein Dialog, der danach aufgeht (auch er selbst), blendet ihn nicht wieder aus
  if (darf && pending && gezeigt !== pending.seq) setGezeigt(pending.seq)
  if (!darf || !pending || !user) return null
  const moment = pending.kind === 'rank' ? { kind: 'rank' as const, id: pending.id } : { kind: 'badge' as const, id: pending.id }
  return (
    <Suspense fallback={null}>
      {/* Neuer Moment, neuer Lauf: key bricht den laufenden ab und spielt von vorn */}
      <TitelMoment key={pending.seq} moment={moment} userId={user.id} onDone={() => titleMomentStore.dismiss(pending.seq)} />
    </Suspense>
  )
}
