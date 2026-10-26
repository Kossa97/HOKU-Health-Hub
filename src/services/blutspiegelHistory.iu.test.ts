import { describe, expect, it } from 'vitest'
import { calculateHistoryBlutspiegelCurve } from './blutspiegelHistory'

// Der gemeldete Fehler, als Test.
//
// HCG und HGH haben ein PK-Profil, werden aber in IU dosiert. `toPkMilligrams`
// kannte nur mg und mcg und gab null zurueck; die Schleife in der Kurve
// uebersprang die Einnahme mit `continue`, die Summe blieb bei null, und
// Das fruehere `BlutspiegelCarousel` machte aus der leeren Kurve ein `return null`. Die
// Substanz verschwand wortlos aus dem Blutspiegel — korrekt ausgefuellt, kein
// Hinweis, einfach weg.

const EINNAHME = [{
  timestamp: new Date('2026-09-13T08:00:00Z'),
  dose: 3,
  unit: 'IU',
  status: 'taken' as const,
}]

function hoechster(punkte: { level: number }[]): number {
  return punkte.reduce((max, punkt) => Math.max(max, punkt.level), 0)
}

describe('Blutspiegel mit IU-Dosierung', () => {
  it('bleibt flach, solange die Substanz keinen Umrechnungsfaktor hat', () => {
    // Kein Faktor heisst: wir koennen es nicht umrechnen. Die Kurve bleibt
    // leer — das ist richtig. Falsch war nur, dass niemand es erfuhr.
    const kurve = calculateHistoryBlutspiegelCurve(EINNAHME, 3.8, 3, 1, 30, null)

    expect(kurve.length).toBeGreaterThan(0)
    expect(hoechster(kurve)).toBe(0)
  })

  it('rechnet mit, sobald der Faktor der Substanz dabei ist', () => {
    // HGH: 3 IU je Milligramm. Aus 3 IU wird 1 mg.
    const kurve = calculateHistoryBlutspiegelCurve(EINNAHME, 3.8, 3, 1, 30, null, { iuPerMg: 3 })

    expect(hoechster(kurve)).toBeGreaterThan(0)
  })

  it('kommt auf denselben Verlauf wie dieselbe Menge in Milligramm', () => {
    // 3 IU HGH sind 1 mg. Beide Wege muessen dieselbe Kurve ergeben —
    // sonst rechnet die Umrechnung an der falschen Stelle.
    const ueberIu = calculateHistoryBlutspiegelCurve(EINNAHME, 3.8, 3, 1, 30, null, { iuPerMg: 3 })
    const ueberMg = calculateHistoryBlutspiegelCurve(
      [{ ...EINNAHME[0], dose: 1, unit: 'mg' }], 3.8, 3, 1, 30, null,
    )

    expect(ueberIu.length).toBe(ueberMg.length)
    for (let i = 0; i < ueberIu.length; i++) {
      expect(ueberIu[i].level).toBeCloseTo(ueberMg[i].level, 10)
    }
  })

  it('gewichtet gemischte Einheiten nach dem Faktor', () => {
    // Die Kurve ist auf ihren eigenen Hoechstwert normiert — bei EINER
    // Einnahme aendert der Faktor die Form deshalb nicht, nur ob ueberhaupt
    // eine entsteht. Sichtbar wird er, sobald eine Historie beide Einheiten
    // enthaelt: dann entscheidet er, wie hoch die IU-Gabe neben der mg-Gabe
    // steht.
    //
    // Die Zeitpunkte liegen relativ zu jetzt, weil die Kurve bei `new Date()`
    // endet — feste Daten waeren je nach Uhrzeit halb abgeschnitten.
    const jetzt = Date.now()
    const vor24h = new Date(jetzt - 24 * 3_600_000)
    const vor12h = new Date(jetzt - 12 * 3_600_000)
    const gemischt = [
      { timestamp: vor24h, dose: 3, unit: 'IU', status: 'taken' as const },
      { timestamp: vor12h, dose: 1, unit: 'mg', status: 'taken' as const },
    ]

    // Mit 3 IU/mg sind beide Gaben 1 mg — zwei gleich hohe Gipfel.
    const gleichgewichtig = calculateHistoryBlutspiegelCurve(gemischt, 3.8, 3, 1, 30, null, { iuPerMg: 3 })
    // Mit 10.000 IU/mg ist die erste Gabe verschwindend klein.
    const einseitig = calculateHistoryBlutspiegelCurve(gemischt, 3.8, 3, 1, 30, null, { iuPerMg: 10000 })

    // Der Gipfel der ERSTEN Gabe, gemessen in den sechs Stunden danach.
    const ersterGipfel = (kurve: { time: Date; level: number }[]) => hoechster(
      kurve.filter(punkt => punkt.time.getTime() < vor24h.getTime() + 6 * 3_600_000),
    )

    expect(ersterGipfel(gleichgewichtig)).toBeGreaterThan(50)
    expect(ersterGipfel(einseitig)).toBeLessThan(1)
  })
})
