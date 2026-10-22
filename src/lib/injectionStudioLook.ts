// src/lib/injectionStudioLook.ts
import type { Look } from './look'

type LightPosition = [number, number, number]

// „Studio“ wie bei einem Produktfoto: ein weiches, leicht warmes Hauptlicht
// oben links vorn, ein schwaches kühles Fülllicht rechts, und zwei kühle
// Kantenlichter seitlich hinten, die die Silhouette vom Schwarz lösen. Die
// Kanten stehen hinter der Figur und leuchten so auch die Rückseite aus.
// Weiche Spiegelungen aus einer lokal erzeugten Raumumgebung, ohne HDR-Datei
// aus dem Netz.
export const INJECTION_STUDIO_LIGHTS = {
  environmentIntensity: 0.22,
  key: { position: [-2.2, 3.4, 3.2] as LightPosition, intensity: 1.9, color: '#fff1e4' },
  fill: { position: [2.8, 1.0, 2.4] as LightPosition, intensity: 0.35, color: '#e6efff' },
  rimLeft: { position: [-3.2, 1.6, -2.4] as LightPosition, intensity: 2.6, color: '#e8f2ff' },
  rimRight: { position: [3.2, 1.6, -2.4] as LightPosition, intensity: 2.6, color: '#e8f2ff' },
}

// „Nacht": dieselben Lichter, nur die beiden Kantenlichter getönt — links
// cyan, rechts violett, wie die Glaskanten der Karten (kühl oben links,
// violett unten rechts). Hauptlicht und Haut bleiben wie bei „Studio".
const NACHT_RIMS = {
  rimLeft: { ...INJECTION_STUDIO_LIGHTS.rimLeft, intensity: 3.0, color: '#7fe3ff' },
  rimRight: { ...INJECTION_STUDIO_LIGHTS.rimRight, intensity: 3.0, color: '#b7a3ff' },
}

export function injectionStudioLightsFor(look: Look) {
  return look === 'nacht' ? { ...INJECTION_STUDIO_LIGHTS, ...NACHT_RIMS } : INJECTION_STUDIO_LIGHTS
}

// Hintergrund hinter dem Canvas: hängt am Look und steht deshalb als
// --inj-backdrop in liquid-glass.css (Studio: Schwarz mit warmem Schein).
export const INJECTION_STUDIO_BACKDROP = 'var(--inj-backdrop)'
