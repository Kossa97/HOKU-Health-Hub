// src/lib/injectionListEntry.ts
//
// Listenansicht des Injektionstrackers: fuer alle, die keinen Torso wollen.
// Ein Eintrag aus der Liste kennt nur Region und Seite. Er traegt die
// Standardposition seiner Stelle (fuer Abstandswarnung und Hoku), aber eine
// eigene Kennung -- so erscheint er nie als Pin auf dem Torso. Beide Ansichten
// teilen einen Verlauf: Farben und Warnungen zaehlen alle Eintraege.
import { INJECTION_LIST_MODEL_VERSION, type InjectionLog3D, type InjectionPinDraft } from './injectionLogTypes'
import { pinDraftFromPreset, type InjectionSitePreset } from './injectionSitePresets'

export { INJECTION_LIST_MODEL_VERSION }

export type InjectionView = 'torso' | 'liste'

/** Welche Ansicht jemand zuletzt gewaehlt hat (pro Geraet). */
export const INJECTION_VIEW_STORAGE_KEY = 'tyd.injektion.ansicht.v1'

export function isListInjection(log: Pick<InjectionLog3D, 'model_version'>): boolean {
  return log.model_version === INJECTION_LIST_MODEL_VERSION
}

export function listPinDraft(preset: InjectionSitePreset): InjectionPinDraft {
  return { ...pinDraftFromPreset(preset), model_version: INJECTION_LIST_MODEL_VERSION }
}

/** Juengster Eintrag an dieser Stelle, egal ob vom Torso oder aus der Liste. */
export function lastInjectionAtSite(
  logs: readonly InjectionLog3D[],
  site: Pick<InjectionSitePreset, 'region' | 'side'>,
): InjectionLog3D | null {
  let last: InjectionLog3D | null = null
  for (const log of logs) {
    if (log.body_region !== site.region || log.body_side !== site.side) continue
    if (!last || Date.parse(log.logged_at) > Date.parse(last.logged_at)) last = log
  }
  return last
}

export function readInjectionView(): InjectionView {
  try {
    return localStorage.getItem(INJECTION_VIEW_STORAGE_KEY) === 'liste' ? 'liste' : 'torso'
  } catch {
    return 'torso'
  }
}

export function writeInjectionView(view: InjectionView): void {
  try {
    localStorage.setItem(INJECTION_VIEW_STORAGE_KEY, view)
  } catch {
    // ohne Speicher: dann eben beim naechsten Mal wieder der Torso
  }
}
