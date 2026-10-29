import { useEffect, useLayoutEffect, useRef } from 'react'
import { dotStore, useDotStand } from '../../dot/dotStore'
import { useDotText } from '../../dot/texte'
import { merkeRundflug, rundflugBahn, rundflugFaellig, rundflugTexte } from '../lib/dotRundflug'
import { orbBuehne } from '../lib/orbBridge'
import type { MacroKey } from '../lib/orb'
import type { Goals, Nutrients } from '../lib/nutrition'

/** Erst landen lassen: Seite gleitet herein, die Kugel steht. */
const WARTEN_MS = 700
/** Steht die Kugel noch nicht (Tag lädt, Gericht offen): so oft und so lange neu versuchen. */
const VERSUCHE = 10, NOCHMAL_MS = 300
/** So lange steht die Zusammenfassung. */
const SUMME_MS = 3800
/** So lange wartet Dot im Haus auf den Rundflug, danach kommt er wie sonst heraus. */
const ANKUENDIGUNG_MS = WARTEN_MS + 2000

const wenigerBewegung = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Beim Öffnen des Kalorientrackers (heute, Tag geladen): Dot fliegt einmal um die Kugel, hält an
 * Kugel und Monden und sagt, was offen ist — höchstens alle zwei Stunden, nur wenn er heraus
 * darf und gerade frei ist. Antippen kürzt ab. Bei „Bewegung reduzieren“ nur der Satz.
 */
export function useDotRundflug({ heute, bereit, total, goals }: { heute: boolean; bereit: boolean; total: Nutrients; goals: Goals }) {
  const { dt } = useDotText()
  const stand = useDotStand()
  const aktuell = useRef({ total, goals, dt })
  useEffect(() => { aktuell.current = { total, goals, dt } })
  const gestartet = useRef(false)
  /** Seite verlassen mitten im Flug: er fliegt direkt an seinen Platz, ohne Zusammenfassung. */
  const abbrechen = useRef<() => void>(() => {})
  useEffect(() => () => abbrechen.current(), [])

  // Vor Dots eigenem Seitenwechsel (Layout-Effekt): kommt gleich ein Rundflug, wartet er im Haus,
  // statt unten herauszukommen — dann erscheint er mit dem Rundflug am linken Rand.
  useLayoutEffect(() => {
    const s = dotStore.stand()
    if (heute && s.darfRaus && !s.kameras && !wenigerBewegung() && rundflugFaellig(Date.now())) dotStore.api()?.rundflugKommt(ANKUENDIGUNG_MS)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const dotFrei = stand.bereit && stand.darfRaus && stand.kameras === 0 && (stand.modus === 'home' || stand.modus === 'house')

  useEffect(() => {
    if (!bereit || !dotFrei || gestartet.current) return
    let timer = 0, versuch = 0
    const los = () => {
      const dot = dotStore.api(), s = dotStore.stand()
      if (!dot || (s.modus !== 'home' && s.modus !== 'house') || !rundflugFaellig(Date.now())) return
      const lage0 = orbBuehne()?.koerper()
      if (!lage0?.main) {
        // Kugel noch nicht gezeichnet: gleich noch einmal
        if (++versuch < VERSUCHE) timer = window.setTimeout(los, NOCHMAL_MS)
        else dot.rundflugKommt(0)
        return
      }
      gestartet.current = true
      const { total: t0, goals: g0, dt: tr } = aktuell.current
      const T = rundflugTexte(t0, g0, tr)
      const main = lage0.main
      // Monde von links nach rechts
      const order = (Object.keys(lage0.moons) as MacroKey[]).sort((a, b) => lage0.moons[a]!.x - lage0.moons[b]!.x)
      const start = s.modus === 'home' ? dot.lage() : { x: -46, y: main.y - main.r * 0.25 }
      let laeuft = true
      const abkuerzen = () => { if (!laeuft) return; orbBuehne()?.fokus(null); dot.rundflugAbkuerzen(0.5) }
      const aufraeumen = () => {
        laeuft = false
        document.removeEventListener('pointerdown', abkuerzen, true)
        orbBuehne()?.fokus(null)
        abbrechen.current = () => {}
      }
      const bahn = rundflugBahn({
        start,
        lage: () => { const k = orbBuehne()?.koerper(); return k?.main ? { main: k.main, moons: k.moons } : null },
        platz: () => dot.platz(),
        rand: { l: 0, r: window.innerWidth },
        order,
        beiHalt: i => {
          if (!laeuft) return
          if (i === 0) { orbBuehne()?.fokus(null); dot.sag(T.kugel, 1050) } else { orbBuehne()?.fokus(order[i - 1]); dot.sag(T.makro(order[i - 1]), 1050) }
        },
        fertig: () => {
          const war = laeuft
          aufraeumen()
          if (!war) return
          dot.sag(T.summe, SUMME_MS)
          if (T.erledigt) { dot.setStimmung('joy'); window.setTimeout(() => dot.setStimmung('idle'), 1800) }
        },
        // Chat, Kamera oder Zugang weg haben ihn herausgeholt: nur aufräumen
        abgebrochen: aufraeumen,
      })
      if (dot.rundflug(bahn)) {
        merkeRundflug(Date.now())
        document.addEventListener('pointerdown', abkuerzen, true)
        abbrechen.current = () => { if (laeuft) { aufraeumen(); dot.rundflugAbkuerzen(0.3) } }
      } else {
        laeuft = false
        dot.rundflugKommt(0)
        // Weniger Bewegung (oder er kann gerade nicht fliegen): nur der Satz, wenn er draußen ist
        if (s.modus === 'home') { dot.sag(T.summe, SUMME_MS); merkeRundflug(Date.now()) } else gestartet.current = false
      }
    }
    timer = window.setTimeout(los, WARTEN_MS)
    return () => window.clearTimeout(timer)
  }, [bereit, dotFrei])
}
