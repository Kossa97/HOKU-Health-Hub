// Was eine Silhouette über die Seite weiß, die gleich erscheint: beim letzten
// Besuch auf diesem Gerät gesehen und gemerkt. Fehlt der Eintrag oder ist er
// unlesbar (privates Fenster, gelöschte Daten, ältere Fassung), gilt der
// allgemeine Umriss.
import { DOSAGE_FORMS } from '../../features/my-stack/lib/dosageForms'
import type { DosageFormKey } from '../../features/my-stack/types'

/** My Stack, wie es beim Öffnen dasteht: Reiter „Alle", Vorgabesortierung. */
export interface StackBild {
  /** Die Form, die zuerst auf der Bühne steht; null, wenn dort nichts steht. */
  form: DosageFormKey | null
  /** Ob unter ihr ein Füllstand steht. */
  pegel: boolean
  /** Einträge auf der Bühne (Punkte der Positionszeile). */
  buehne: number
  /** Einträge insgesamt (Zeilen der Liste). */
  gesamt: number
}

const STACK_SCHLUESSEL = 'tyd_silhouette_stack'

export function merkeStackBild(bild: StackBild): void {
  try {
    localStorage.setItem(STACK_SCHLUESSEL, JSON.stringify(bild))
  } catch {
    // Ohne Speicher bleibt es beim allgemeinen Umriss
  }
}

/** Beim Abmelden: der nächste Mensch an diesem Gerät sieht nicht den Stack des vorigen. */
export function vergissStackBild(): void {
  try {
    localStorage.removeItem(STACK_SCHLUESSEL)
  } catch {
    // Nichts gemerkt, nichts zu vergessen
  }
}

const anzahl = (wert: unknown) => (typeof wert === 'number' && Number.isInteger(wert) && wert >= 0 ? wert : null)

export function leseStackBild(): StackBild | null {
  try {
    const roh: unknown = JSON.parse(localStorage.getItem(STACK_SCHLUESSEL) ?? 'null')
    if (!roh || typeof roh !== 'object') return null
    const { form, pegel, buehne, gesamt } = roh as Record<string, unknown>
    const bekannt = form === null || DOSAGE_FORMS.some(f => f.key === form && f.stageRenderer)
    if (!bekannt || typeof pegel !== 'boolean' || anzahl(buehne) === null || anzahl(gesamt) === null) return null
    return { form: form as DosageFormKey | null, pegel, buehne: buehne as number, gesamt: gesamt as number }
  } catch {
    return null
  }
}

/** Bühne oder Liste — gemerkt von My Stack selbst. */
export function leseStackAnsicht(): 'vials' | 'list' {
  try {
    return localStorage.getItem('tyd_peptide_view') === 'list' ? 'list' : 'vials'
  } catch {
    return 'vials'
  }
}
