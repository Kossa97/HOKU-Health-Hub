/**
 * Kleiner Briefkasten zwischen Schnappschuss-Lauf und Moment: Der Lauf legt
 * einen Moment ab, sobald die neu verdienten Abzeichen gespeichert sind; die im
 * Layout eingehängte Anzeige holt ihn ab. Es liegt immer höchstens einer da —
 * ein neuer ersetzt den alten (der Moment spielt dann neu ab).
 *
 * Bewusst ohne Abhängigkeiten: das Layout lädt nur diese Datei, die Anzeige
 * selbst kommt erst, wenn es etwas zu zeigen gibt.
 */
import { useSyncExternalStore } from 'react'
import type { TitleMoment } from './titleMoment'

export type PendingTitleMoment = TitleMoment & { userId: string; seq: number }

let current: PendingTitleMoment | null = null
let seq = 0
const listeners = new Set<() => void>()

const emit = () => { for (const l of listeners) l() }

export const titleMomentStore = {
  announce(userId: string, moment: TitleMoment) {
    seq += 1
    current = { ...moment, userId, seq }
    emit()
  },
  /** Nur den gezeigten schließen: kam inzwischen ein neuer, bleibt er. */
  dismiss(shownSeq: number) {
    if (current?.seq !== shownSeq) return
    current = null
    emit()
  },
  get: () => current,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
}

export function usePendingTitleMoment(): PendingTitleMoment | null {
  return useSyncExternalStore(titleMomentStore.subscribe, titleMomentStore.get, titleMomentStore.get)
}

/**
 * Der Moment schreibt Titel und Sichtbarkeit selbst in die Profilzeile. Eine
 * offene Profilseite hält aber ihren eigenen Stand: ohne Nachricht schriebe ihr
 * nächster Tipp den alten Stand zurück. Sie hört darauf und lädt neu.
 */
export const PROFIL_GEAENDERT = 'hoku:profil-geaendert'

export function meldeProfilGeaendert() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PROFIL_GEAENDERT))
}

