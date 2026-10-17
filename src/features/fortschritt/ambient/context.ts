import { createContext, useCallback, useContext, useEffect, type RefObject } from 'react'
import type { AmbientEngine, LightSpec } from './engine'

export const AmbientContext = createContext<AmbientEngine | null>(null)

/** Eine Karte bekommt ein eigenes Licht, das ihr folgt. */
export function useAmbientLight(id: string, ref: RefObject<HTMLElement | null>, spec: LightSpec) {
  const engine = useContext(AmbientContext)
  useEffect(() => {
    if (!engine) return
    engine.register(id, () => ref.current)
    return () => engine.unregister(id)
  }, [engine, id, ref])
  const { color, intensity, anchorX, anchorY, size } = spec
  useEffect(() => {
    engine?.update(id, { color, intensity, anchorX, anchorY, size })
  }, [engine, id, color, intensity, anchorX, anchorY, size])
}

/** Kurzes Aufblühen einer Farbe an einer Stelle (Chip an, Ring auf). */
export function useAmbientPulse() {
  const engine = useContext(AmbientContext)
  return useCallback(
    (color: string, el: HTMLElement | null, anchorX?: number, anchorY?: number) => engine?.pulse(color, el, anchorX, anchorY),
    [engine],
  )
}
