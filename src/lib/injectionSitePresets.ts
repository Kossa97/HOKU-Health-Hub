// src/lib/injectionSitePresets.ts
//
// Feste Injektionsstellen fuer „Stelle aus Liste waehlen“ -- der Weg ohne
// Long-Press auf dem 3D-Modell (Tastatur, Screenreader, motorische
// Einschraenkungen). Die Punkte liegen auf der Hautoberflaeche des Modells
// und sind mit scripts/compute-injection-site-presets.mjs berechnet; ein
// Pin von hier ist also ein echter Pin wie per Long-Press gesetzt, und die
// Abstandswarnung rechnet mit ihm wie mit jedem anderen.
//
// Region und Seite kommen aus dieser Liste, nicht aus inferBodyRegion: die
// Punkte sind nach dem Modell gewaehlt (Bauch neben dem Nabel, Gesaess oben
// aussen, ...), und die Schwellen von inferBodyRegion passen zu diesem Modell
// nicht (siehe Kommentar im Berechnungsskript).
import type { BodyRegion, BodySide, InjectionPinDraft, Vector3Json } from './injectionLogTypes'
import { INJECTION_MODEL_VERSION } from './injectionModelMaterial'

export interface InjectionSitePreset {
  region: BodyRegion
  side: Exclude<BodySide, 'center'>
  position: Vector3Json
  normal: Vector3Json
}

export const INJECTION_SITE_PRESETS: readonly InjectionSitePreset[] = [
  { region: 'abdomen', side: 'left', position: { x: -0.12, y: 0.68, z: 0.15575 }, normal: { x: -0.665, y: 0.11674, z: 0.73767 } },
  { region: 'abdomen', side: 'right', position: { x: 0.12, y: 0.68, z: 0.15565 }, normal: { x: 0.67697, y: 0.08745, z: 0.7308 } },
  { region: 'thigh', side: 'left', position: { x: -0.2, y: -0.1, z: 0.11854 }, normal: { x: 0.04394, y: -0.21788, z: 0.97498 } },
  { region: 'thigh', side: 'right', position: { x: 0.2, y: -0.1, z: 0.11911 }, normal: { x: -0.06653, y: -0.18824, z: 0.97987 } },
  { region: 'glute', side: 'left', position: { x: -0.17, y: 0.42, z: -0.20765 }, normal: { x: -0.39407, y: 0.36543, z: -0.84331 } },
  { region: 'glute', side: 'right', position: { x: 0.17, y: 0.42, z: -0.20785 }, normal: { x: 0.35924, y: 0.38046, z: -0.85217 } },
  { region: 'deltoid', side: 'left', position: { x: -0.42, y: 1.1, z: -0.02622 }, normal: { x: -0.73482, y: -0.14105, z: 0.66343 } },
  { region: 'deltoid', side: 'right', position: { x: 0.42, y: 1.1, z: -0.02576 }, normal: { x: 0.75365, y: -0.11304, z: 0.64749 } },
  { region: 'upper_arm', side: 'left', position: { x: -0.55, y: 0.87, z: -0.08746 }, normal: { x: -0.76739, y: 0.47336, z: 0.43248 } },
  { region: 'upper_arm', side: 'right', position: { x: 0.55, y: 0.87, z: -0.08517 }, normal: { x: 0.78969, y: 0.43241, z: 0.43521 } },
]

export function injectionSitePresetKey(preset: Pick<InjectionSitePreset, 'region' | 'side'>): string {
  return `${preset.region}_${preset.side}`
}

export function pinDraftFromPreset(preset: InjectionSitePreset): InjectionPinDraft {
  return {
    model_version: INJECTION_MODEL_VERSION,
    position: { ...preset.position },
    normal: { ...preset.normal },
    body_region: preset.region,
    body_side: preset.side,
    uv: null,
    camera_state: null,
  }
}
