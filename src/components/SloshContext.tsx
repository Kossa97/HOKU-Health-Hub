import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { createSloshEngine, type SloshEngine, type SloshState } from './sloshEngine'

const SloshContext = createContext<SloshEngine | null>(null)

// Create and own one physics engine for a view. The engine is paused under
// prefers-reduced-motion and while the tab is hidden, and torn down on unmount.
export function useSloshEngine(): SloshEngine {
  const ref = useRef<SloshEngine | null>(null)
  if (ref.current === null) ref.current = createSloshEngine()
  const engine = ref.current

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const apply = () => engine.setEnabled(!(mq?.matches ?? false) && !document.hidden)
    apply()
    mq?.addEventListener?.('change', apply)
    document.addEventListener('visibilitychange', apply)
    return () => {
      mq?.removeEventListener?.('change', apply)
      document.removeEventListener('visibilitychange', apply)
      engine.destroy()
    }
  }, [engine])

  return engine
}

// Share an engine with the vials underneath so they redraw from its physics.
export function SloshProvider({ engine, children }: { engine: SloshEngine; children: ReactNode }) {
  return <SloshContext.Provider value={engine}>{children}</SloshContext.Provider>
}

export function useSloshSubscribe(): ((cb: (state: SloshState) => boolean | void) => () => void) | null {
  return useContext(SloshContext)?.subscribe ?? null
}
