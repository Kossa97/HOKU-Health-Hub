import { useSyncExternalStore } from 'react'
import type { RoutineExercise } from '../types'
import { cloneExercise, isRoutineExercise } from './exerciseSelection'

/**
 * Ablage fuer kopierte Uebungen — app-weit, damit man in einem Workout
 * kopiert und in einem anderen einfuegt. Liegt fuer die Sitzung im
 * sessionStorage (uebersteht Neuladen, nicht das Schliessen des Tabs).
 */

const KEY = 'tyd.training.clipboard'
const MAX_ITEMS = 50

function load(): RoutineExercise[] {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter(isRoutineExercise).slice(0, MAX_ITEMS) : []
  } catch {
    return []
  }
}

let items: RoutineExercise[] = load()
const listeners = new Set<() => void>()

function set(next: RoutineExercise[]) {
  items = next
  try { sessionStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ohne Speicher: nur im Speicher */ }
  listeners.forEach(fn => fn())
}

export function copyToClipboard(exercises: readonly RoutineExercise[]) {
  set(exercises.slice(0, MAX_ITEMS).map(cloneExercise))
}

/** Frische Kopien zum Einfuegen — die Ablage bleibt, man kann mehrfach einfuegen. */
export function clipboardCopies(): RoutineExercise[] {
  return items.map(cloneExercise)
}

export function clearClipboard() {
  set([])
}

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }

export function useExerciseClipboard(): readonly RoutineExercise[] {
  return useSyncExternalStore(subscribe, () => items, () => items)
}
