import { useCallback, useEffect, useState } from 'react'
import {
  ACTIVE_WORKOUT_KEY, loadActiveWorkout, reduceWorkout, storeActiveWorkout,
  type ActiveWorkout, type WorkoutAction,
} from '../lib/activeWorkout'

/**
 * Das laufende Training als React-Zustand, gespiegelt in localStorage.
 * Ein zweiter Tab mit der App sieht Aenderungen ueber das `storage`-Ereignis.
 */
export function useActiveWorkout() {
  const [workout, setWorkout] = useState<ActiveWorkout | null>(() => loadActiveWorkout())

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === ACTIVE_WORKOUT_KEY) setWorkout(loadActiveWorkout())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const begin = useCallback((next: ActiveWorkout) => {
    storeActiveWorkout(next)
    setWorkout(next)
  }, [])

  const dispatch = useCallback((action: WorkoutAction) => {
    setWorkout(current => {
      if (!current) return current
      const next = reduceWorkout(current, action)
      storeActiveWorkout(next)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    storeActiveWorkout(null)
    setWorkout(null)
  }, [])

  return { workout, begin, dispatch, clear }
}

/** Fuer Home und Schnellzugriff: laeuft gerade ein Training? */
export function hasActiveWorkout(): boolean {
  return loadActiveWorkout() != null
}
