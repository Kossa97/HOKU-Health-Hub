import { useEffect } from 'react'
import i18n from 'i18next'
import { useAuth } from '../../../context/AuthContext'

/**
 * Haelt den Schnappschuss der Profilwerte aktuell (Teilprojekt 2a): einmal kurz
 * nach dem App-Start und entprellt nach eigenen Eintraegen
 * (`requestProfileSnapshot()`). Gerechnet und geschrieben wird im Dienst; der
 * wird erst beim ersten Lauf nachgeladen, damit Uebungs- und Markerkatalog
 * nicht im Start-Bundle landen. Fehler bleiben still — der naechste Anlass
 * versucht es wieder.
 */

/** Nach dem Start erst die App laden lassen. */
export const SNAPSHOT_START_DELAY_MS = 5_000
/** Mehrere Eintraege kurz hintereinander ergeben einen Lauf. */
export const SNAPSHOT_DEBOUNCE_MS = 2_000

// Modulweit: das Layout kann neu eingehaengt werden, der App-Start bleibt einer.
let activeUser: string | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let running = false
let again = false
/** Nutzer, fuer die der Start-Lauf schon begonnen hat. */
const started = new Set<string>()

const appLang = (): 'de' | 'en' =>
  (i18n.resolvedLanguage ?? i18n.language ?? '').toLowerCase().startsWith('de') ? 'de' : 'en'

function schedule(delayMs: number) {
  const userId = activeUser
  if (!userId) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void run(userId)
  }, delayMs)
}

async function run(userId: string) {
  if (running) {
    again = true
    return
  }
  running = true
  started.add(userId)
  try {
    const { syncProfileSnapshot } = await import('../services/profileSnapshotStore')
    if (activeUser === userId) await syncProfileSnapshot(userId, appLang())
  } catch {
    // Still: etwa vor der Migration (Tabelle fehlt) oder ohne Netz.
  } finally {
    running = false
    if (again) {
      again = false
      schedule(SNAPSHOT_DEBOUNCE_MS)
    }
  }
}

/** Nach einem eigenen Eintrag aufrufen: stoesst entprellt einen neuen Schnappschuss an. Ohne Anmeldung nichts. */
export function requestProfileSnapshot(): void {
  schedule(SNAPSHOT_DEBOUNCE_MS)
}

/** Im Layout eingehaengt: Lauf nach dem App-Start, solange angemeldet. */
export function useProfileSnapshotSync() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  useEffect(() => {
    if (!userId) return
    activeUser = userId
    if (!started.has(userId) && !timer) schedule(SNAPSHOT_START_DELAY_MS)
    return () => {
      if (activeUser !== userId) return
      activeUser = null
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }
  }, [userId])
}
