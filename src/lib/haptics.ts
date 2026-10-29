import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

/** Leichter Klick — für Scroll-Ticks beim Wischen im Graph. */
export async function hapticTick(): Promise<void> {
  try {
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    // Web-Fallback: Vibrations API (Android Chrome); iOS Safari ignoriert das still.
    // Chrome blockiert (und protokolliert) den Aufruf ohne noch aktive
    // Nutzer-Geste — etwa wenn das native Promise erst spaeter abgelehnt wird.
    if (navigator.userActivation?.isActive === false) return
    try { navigator.vibrate?.(2) } catch { /* ignore */ }
  }
}

/** Ergebnis einer Aktion spürbar machen (Anmeldung gelungen oder abgelehnt). */
export async function hapticErgebnis(ok: boolean): Promise<void> {
  try {
    await Haptics.notification({ type: ok ? NotificationType.Success : NotificationType.Error })
  } catch {
    // Web-Fallback wie bei hapticTick: Android Chrome vibriert, iOS Safari ignoriert es
    if (navigator.userActivation?.isActive === false) return
    try { navigator.vibrate?.(ok ? 12 : [20, 40, 20]) } catch { /* ignore */ }
  }
}
