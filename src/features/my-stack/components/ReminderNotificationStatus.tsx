import { useEffect, useRef } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { usePushNotifications } from '../../../lib/usePushNotifications'
import { NotificationHint } from '../../../components/NotificationHint'

/**
 * Unter den Erinnerungs-Feldern: sorgt dafuer, dass eine gewaehlte Erinnerung
 * auch ankommen kann, und sagt es, wenn nicht.
 *
 * Den Systemdialog loest das Tippen auf ein Feld aus (`toggleReminder`). Ist
 * die Erlaubnis da, aber noch kein Push-Abo, wird es hier nachgeholt — dafuer
 * braucht es kein Tippen mehr.
 */
export function ReminderNotificationStatus({ active }: { active: boolean }) {
  const { user } = useAuth()
  const { state, subscribe } = usePushNotifications(user)
  const versucht = useRef(false)

  useEffect(() => {
    if (!active || state !== 'default' || versucht.current) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    versucht.current = true
    void subscribe()
  }, [active, state, subscribe])

  if (!active) return null
  return <NotificationHint state={state} />
}
