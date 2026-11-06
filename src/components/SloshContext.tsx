import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { createSloshEngine, type SloshEngine, type SloshState } from './sloshEngine'

const SloshContext = createContext<SloshEngine | null>(null)

// Mehrere Bühnen können gleichzeitig stehen (MyStack und darüber der Assistent).
// Die Bläschen halten erst an, wenn keine mehr wach ist.
const alle = new Set<SloshEngine>()
const wach = new Set<SloshEngine>()
function zeigeRuhe() {
  const html = document.documentElement
  if (alle.size > 0 && wach.size === 0) html.dataset.fluessigRuht = ''
  else delete html.dataset.fluessigRuht
}

// Create and own one physics engine for a view. The engine is paused under
// prefers-reduced-motion and while the tab is hidden, comes to rest after a
// while without touch or scroll, and is torn down on unmount.
export function useSloshEngine(): SloshEngine {
  const ref = useRef<SloshEngine | null>(null)
  if (ref.current === null) ref.current = createSloshEngine()
  const engine = ref.current

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    // ?schwappen=aus (Prüfschalter, main.tsx): Flüssigkeit steht still
    const aus = 'schwappenAus' in document.documentElement.dataset
    const apply = () => engine.setEnabled(!aus && !(mq?.matches ?? false) && !document.hidden)
    apply()
    mq?.addEventListener?.('change', apply)
    document.addEventListener('visibilitychange', apply)
    // Ruhe (sloshEngine.ts): Wischen, Tippen und Rollen auf der Seite wecken die
    // Bühne. Hoku zählt nicht mit, er liegt außerhalb von <main>: wer mit ihm
    // spielt, soll ihn flüssig haben und nicht die Fläschchen aufwecken.
    const regung = (e: Event) => {
      const t = e.target
      if (t === document || (t instanceof Element && t.closest('main'))) engine.wecke()
    }
    const optionen = { capture: true, passive: true } as const
    for (const typ of ['pointerdown', 'scroll', 'wheel', 'keydown'] as const) document.addEventListener(typ, regung, optionen)
    // Bläschen sind CSS-Animationen: in Ruhe hält sie index.css an
    alle.add(engine); wach.add(engine); zeigeRuhe()
    const ruheAb = engine.beiRuhe(r => { if (r) wach.delete(engine); else wach.add(engine); zeigeRuhe() })
    return () => {
      mq?.removeEventListener?.('change', apply)
      document.removeEventListener('visibilitychange', apply)
      for (const typ of ['pointerdown', 'scroll', 'wheel', 'keydown'] as const) document.removeEventListener(typ, regung, optionen)
      ruheAb()
      alle.delete(engine); wach.delete(engine)
      // Ohne Bühne gibt es nichts anzuhalten; stehen andere noch, gilt ihre Ruhe weiter
      zeigeRuhe()
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
