import { useSyncExternalStore } from 'react'
import type { DotApi, DotModus } from './engine/dotEngine'

/**
 * Die Naht zwischen Dot und dem Rest der App, ohne React-Kontext: das Logo
 * in der Leiste, die Ebene im Layout und Seiten mit Kamera kennen einander
 * nicht, sie reden nur hierüber.
 */

interface DotStand {
  modus: DotModus
  drinnen: boolean
  /** Zählt hoch, wenn er gerade ins Haus geplumpst ist: das Logo hüpft. */
  stoss: number
  /** Ist eine Kamera offen? Dann ist er ganz weg. */
  kameras: number
  /** Darf er heraus (Pro oder Tester)? */
  darfRaus: boolean
  /** Ist der Zugang schon geladen? Vorher wird ein Tipp aufs Logo aufgehoben. */
  geladen: boolean
  /** Engine da und Zugang geladen. */
  bereit: boolean
  /** Das App-Gerüst (Layout) steht: mit oder ohne Leiste, Schnellzugriff offen. `null` = keine App-Seite. */
  app: { mitLeiste: boolean; schnellzugriff: boolean } | null
  /** Die Bühne der Anmeldung, solange sie zu sehen ist. */
  loginBuehne: HTMLElement | null
  /**
   * Was die offene Seite ihm gerade zu sagen gibt (etwa „Heute ist Push dran.“):
   * Ist er draußen, sagt er es; kommt er heraus, grüßt er damit. `null` = nichts.
   */
  hinweis: string | null
}

let stand: DotStand = { modus: 'house', drinnen: true, stoss: 0, kameras: 0, darfRaus: false, geladen: false, bereit: false, app: null, loginBuehne: null, hinweis: null }
let tippWartet = false
const hoerer = new Set<() => void>()
let engine: DotApi | null = null
let beiGesperrt: (() => void) | null = null

function setze(teil: Partial<DotStand>) {
  stand = { ...stand, ...teil }
  hoerer.forEach(h => h())
}

export const dotStore = {
  stand: () => stand,
  abonniere(h: () => void) { hoerer.add(h); return () => { hoerer.delete(h) } },
  melde(z: { modus: DotModus; drinnen: boolean; stoss: boolean }) {
    setze({ modus: z.modus, drinnen: z.drinnen, stoss: stand.stoss + (z.stoss ? 1 : 0) })
  },
  verbinde(e: DotApi | null, gesperrt: (() => void) | null) {
    engine = e; beiGesperrt = gesperrt
    setze({ bereit: !!e && stand.geladen })
    if (e && stand.geladen && tippWartet) { tippWartet = false; dotStore.logoTipp() }
  },
  setZugang(darfRaus: boolean, geladen: boolean) {
    if (darfRaus !== stand.darfRaus || geladen !== stand.geladen) setze({ darfRaus, geladen, bereit: geladen && !!engine })
    if (geladen && engine && tippWartet) { tippWartet = false; dotStore.logoTipp() }
  },
  /** Tipp aufs Logo: rufen, heimschicken, oder sagen, dass es Pro braucht. */
  logoTipp() {
    // Noch nicht bereit (Engine oder Zugang lädt): der Tipp wird aufgehoben
    if (!engine || !stand.geladen) { tippWartet = true; return }
    const was = engine.logoTipp(stand.darfRaus)
    if (was === 'gesperrt') beiGesperrt?.()
  },
  /** Die Engine selbst, für Seiten, die ihn Formen zeigen lassen (Anmeldung). */
  api: () => engine,
  setApp(app: DotStand['app']) {
    if (app?.mitLeiste === stand.app?.mitLeiste && app?.schnellzugriff === stand.app?.schnellzugriff) return
    setze({ app })
  },
  setLoginBuehne(el: HTMLElement | null) { if (el !== stand.loginBuehne) setze({ loginBuehne: el }) },
  setHinweis(text: string | null) { if (text !== stand.hinweis) setze({ hinweis: text }) },
  kameraAuf() { setze({ kameras: stand.kameras + 1 }) },
  kameraZu() { setze({ kameras: Math.max(0, stand.kameras - 1) }) },
}

export function useDotStand() {
  return useSyncExternalStore(dotStore.abonniere, dotStore.stand, dotStore.stand)
}
