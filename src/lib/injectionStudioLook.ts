// src/lib/injectionStudioLook.ts

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

// Hintergrund hinter dem Canvas: Schwarz mit einem weichen, warmen Schein um die Figur.
export const INJECTION_STUDIO_BACKDROP =
  'radial-gradient(ellipse 60% 48% at 50% 46%, rgba(255,244,230,0.10), rgba(255,244,230,0) 70%), #000'
