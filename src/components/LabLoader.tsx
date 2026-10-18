// src/components/LabLoader.tsx
// Ladebildschirm für den ersten Besuch von My Stack und The Lab: der Umriss
// der Seite in atmenden Silhouetten, bis die Daten da sind.

import { SeitenSilhouette } from './ui/Silhouette'
import type { SilhouettenArt } from './ui/silhouetteTakt'

interface LabLoaderProps {
  fadingOut?: boolean
  art: SilhouettenArt
}

export function LabLoader({ fadingOut = false, art }: LabLoaderProps) {
  return (
    <div
      // z-40 und nicht z-50: die Navigationsleiste (z-41) bleibt SICHTBAR,
      // waehrend geladen wird. Sie ist Geruest der App, kein Seiteninhalt —
      // wer auf eine Seite wechselt, die noch laedt, soll nicht das Gefuehl
      // haben, die App sei weg. Der schwebende Glaskoerper legt sich dabei auf
      // die Ladeflaeche und zeichnet sie weich, was gut aussieht.
      //
      // Dialoge (z-45 aufwaerts) liegen weiterhin ueber allem.
      className={`fixed inset-0 z-40 lg-backdrop overflow-hidden transition-opacity duration-500 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      // Dieselben Ränder wie die Seite darunter, damit nichts springt
      style={{
        paddingTop: 'calc(1rem + env(safe-area-inset-top))',
        paddingLeft: 'calc(12px + env(safe-area-inset-left))',
        paddingRight: 'calc(12px + env(safe-area-inset-right))',
      }}
    >
      <SeitenSilhouette art={art} />
    </div>
  )
}
