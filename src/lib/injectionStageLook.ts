// src/lib/injectionStageLook.ts

type LightPosition = [number, number, number]

// „Bühne“: wenig Licht von vorn oben, zwei helle Kantenlichter seitlich hinten
// zeichnen die Silhouette auf Schwarz, ein kühles Gegenlicht trennt die Figur
// vom Hintergrund. Die Kanten stehen hinter der Figur und leuchten so auch die
// Rückseite aus. Spiegelungen aus einer lokal erzeugten Raumumgebung, ohne
// HDR-Datei aus dem Netz; bewusst schwach, damit die Schatten tief bleiben.
export const INJECTION_STAGE_LIGHTS = {
  environmentIntensity: 0.08,
  top: { position: [0, 4, 2.4] as LightPosition, intensity: 1.0, color: '#ffeedd' },
  rimLeft: { position: [-3.4, 1.2, -1.6] as LightPosition, intensity: 4.2, color: '#ffffff' },
  rimRight: { position: [3.4, 1.2, -1.6] as LightPosition, intensity: 4.2, color: '#ffffff' },
  back: { position: [0, 0.5, -4] as LightPosition, intensity: 1.2, color: '#9fdcff' },
}

// Hintergrund hinter dem Canvas: Schwarz mit einem Lichtkegel von oben.
export const INJECTION_STAGE_BACKDROP =
  'radial-gradient(ellipse 34% 70% at 50% 8%, rgba(255,255,255,0.13), rgba(255,255,255,0) 72%), #000'
