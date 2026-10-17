import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AmbientEngine } from './engine'
import { AmbientContext } from './context'

/** Licht-Ebene hinter der Seite; Karten melden ihr Licht über useAmbientLight an. */
export function AmbientLightProvider({ children }: { children: ReactNode }) {
  const layerRef = useRef<HTMLDivElement>(null)
  const [engine] = useState(() => new AmbientEngine())

  useEffect(() => {
    if (!layerRef.current) return
    return engine.attach(layerRef.current)
  }, [engine])

  return (
    <AmbientContext.Provider value={engine}>
      <div ref={layerRef} className="fg-ambient" aria-hidden />
      {children}
    </AmbientContext.Provider>
  )
}
