import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import {
  activeWorkoutKey, loadActiveWorkout, reduceWorkout, storeActiveWorkout,
  type ActiveWorkout, type WorkoutAction,
} from '../lib/activeWorkout'

/**
 * Das laufende Training als React-Zustand, gespiegelt in localStorage — je
 * Konto getrennt. Ein zweiter Tab mit der App sieht Aenderungen ueber das
 * `storage`-Ereignis.
 */
export function useActiveWorkout() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [loaded, setLoaded] = useState<{ userId: string | null; workout: ActiveWorkout | null }>(
    () => ({ userId, workout: userId ? loadActiveWorkout(userId) : null }),
  )
  // Kontowechsel: den Speicherplatz des neuen Kontos lesen (Muster „Zustand beim Rendern anpassen").
  if (loaded.userId !== userId) setLoaded({ userId, workout: userId ? loadActiveWorkout(userId) : null })
  const workout = loaded.userId === userId ? loaded.workout : null

  useEffect(() => {
    if (!userId) return
    const onStorage = (event: StorageEvent) => {
      if (event.key === activeWorkoutKey(userId)) setLoaded({ userId, workout: loadActiveWorkout(userId) })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [userId])

  const begin = useCallback((next: ActiveWorkout) => {
    if (!userId) return
    storeActiveWorkout(userId, next)
    setLoaded({ userId, workout: next })
  }, [userId])

  const dispatch = useCallback((action: WorkoutAction) => {
    if (!userId) return
    setLoaded(current => {
      if (!current.workout || current.userId !== userId) return current
      const next = reduceWorkout(current.workout, action)
      storeActiveWorkout(userId, next)
      return { userId, workout: next }
    })
  }, [userId])

  const clear = useCallback(() => {
    if (!userId) return
    storeActiveWorkout(userId, null)
    setLoaded({ userId, workout: null })
  }, [userId])

  return { workout, begin, dispatch, clear }
}
