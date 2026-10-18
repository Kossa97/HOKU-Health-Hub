// src/lib/injectionGlassLook.ts

type LightPosition = [number, number, number]

// „Dunkles Glas“: der Körper ist eine dunkle, glänzende Figur auf Schwarz.
// Gezeichnet wird er von zwei kühlen Kantenlichtern hinten links und rechts,
// vorn reicht ein schwaches Licht von oben. Die Spiegelungen kommen aus einer
// lokal erzeugten Raumumgebung, ohne HDR-Datei aus dem Netz.
export const INJECTION_GLASS_LIGHTS = {
  environmentIntensity: 0.5,
  front: { position: [0, 3.5, 3] as LightPosition, intensity: 0.8, color: '#ffffff' },
  rimLeft: { position: [-3.4, 1.4, -1.8] as LightPosition, intensity: 3.4, color: '#cfe9ff' },
  rimRight: { position: [3.4, 1.4, -1.8] as LightPosition, intensity: 3.4, color: '#cfe9ff' },
}

// Hintergrund hinter dem Canvas: Schwarz mit einem kühlen Schein um die Figur.
export const INJECTION_GLASS_BACKDROP =
  'radial-gradient(ellipse 62% 46% at 50% 48%, rgba(100,210,255,0.12), rgba(100,210,255,0) 72%), #000'
