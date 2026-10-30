import { useEffect, useLayoutEffect, useRef } from 'react'
import { dotStore, useDotStand } from '../../dot/dotStore'
import { useDotText } from '../../dot/texte'
import { merkeRundflug, rundflugBahn, rundflugFaellig, rundflugTexte, umlaufBahn, zaehleBesuch } from '../lib/dotRundflug'
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
 * Beim Hineinnavigieren in den Kalorientracker (Tag geladen) fliegt Dot um die Kugel: sonst ein
 * Umlauf ohne Daten; nach zwei Stunden oder beim dritten Öffnen (heute) der Rundflug mit Halt an
 * Kugel und Monden, je Halt ein Satz, am Platz alles zusammen. Nur wenn er heraus darf und frei
 * ist; draußen startet er, wo er ist, sonst am linken Rand. Antippen kürzt ab. Bei „Bewegung
 * reduzieren“ kein Flug — beim Rundflug nur der Satz.
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

  // Vor Dots eigenem Seitenwechsel (Layout-Effekt): dieses Hineinnavigieren zählen; kommt gleich ein
  // Rundflug, wartet er im Haus, statt unten herauszukommen — dann erscheint er am linken Rand.
  const gezaehlt = useRef(false)
  useLayoutEffect(() => {
    if (heute && !gezaehlt.current) { gezaehlt.current = true; zaehleBesuch() }
    const s = dotStore.stand()
    if (s.darfRaus && !s.kameras && !wenigerBewegung()) dotStore.api()?.rundflugKommt(ANKUENDIGUNG_MS)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const dotFrei = stand.bereit && stand.darfRaus && stand.kameras === 0 && (stand.modus === 'home' || stand.modus === 'house')

  useEffect(() => {
    if (!bereit || !dotFrei || gestartet.current) return
    let timer = 0, versuch = 0
    const los = () => {
      const dot = dotStore.api(), s = dotStore.stand()
      if (!dot || (s.modus !== 'home' && s.modus !== 'house')) return
      const lage0 = orbBuehne()?.koerper()
      if (!lage0?.main) {
        // Kugel noch nicht gezeichnet: gleich noch einmal
        if (++versuch < VERSUCHE) timer = window.setTimeout(los, NOCHMAL_MS)
        else dot.rundflugKommt(0)
        return
      }
      gestartet.current = true
      const main = lage0.main
      const start = s.modus === 'home' ? dot.lage() : { x: -46, y: main.y - main.r * 0.25 }
      const lage = () => { const k = orbBuehne()?.koerper(); return k?.main ? { main: k.main, moons: k.moons } : null }
      let laeuft = true
      const abkuerzen = () => { if (!laeuft) return; orbBuehne()?.fokus(null); dot.rundflugAbkuerzen(0.5) }
      const aufraeumen = () => {
        laeuft = false
        document.removeEventListener('pointerdown', abkuerzen, true)
        orbBuehne()?.fokus(null)
        abbrechen.current = () => {}
      }
      const fliege = (bahn: Parameters<typeof dot.rundflug>[0]) => {
        if (!dot.rundflug(bahn)) { laeuft = false; dot.rundflugKommt(0); return false }
        document.addEventListener('pointerdown', abkuerzen, true)
        abbrechen.current = () => { if (laeuft) { aufraeumen(); dot.rundflugAbkuerzen(0.3) } }
        return true
      }

      // Sonst nur der Umlauf, ohne Daten
      if (!heute || !rundflugFaellig(Date.now())) {
        // Abgelehnt, solange er im Haus ist: sobald er frei ist, noch einmal versuchen
        if (!fliege(umlaufBahn({ start, lage, platz: () => dot.platz(), fertig: aufraeumen, abgebrochen: aufraeumen })) && s.modus === 'house') gestartet.current = false
        return
      }

      const { total: t0, goals: g0, dt: tr } = aktuell.current
      const T = rundflugTexte(t0, g0, tr)
      // Monde von links nach rechts
      const order = (Object.keys(lage0.moons) as MacroKey[]).sort((a, b) => lage0.moons[a]!.x - lage0.moons[b]!.x)
      const bahn = rundflugBahn({
        start,
        lage,
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
      if (fliege(bahn)) merkeRundflug(Date.now())
      // Weniger Bewegung (oder er kann gerade nicht fliegen): nur der Satz, wenn er draußen ist
      else if (s.modus === 'home') { dot.sag(T.summe, SUMME_MS); merkeRundflug(Date.now()) } else gestartet.current = false
    }
    timer = window.setTimeout(los, WARTEN_MS)
    return () => window.clearTimeout(timer)
  }, [bereit, dotFrei])
}
