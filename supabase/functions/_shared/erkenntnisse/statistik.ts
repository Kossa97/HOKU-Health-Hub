// Statistik der Erkenntnis-Engine. Reines TypeScript ohne Importe: läuft im Browser,
// in Vitest und in Deno. Zufall nur über den gesetzten Seed, damit dieselben Daten
// immer denselben p-Wert ergeben.

/** FNV-1a, 32 Bit. */
export function seed(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: Zahlen in [0, 1), bestimmt durch den Seed. */
export function zufall(seedWert: number): () => number {
  let a = seedWert >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Zweiseitiger Permutationstest auf die Mittelwertdifferenz:
 * Anteil der Zufallsaufteilungen, deren |Differenz| mindestens so groß ist wie die
 * beobachtete, als (Treffer + 1) / (Läufe + 1). Nie 0.
 */
export function permutationsTest(a: number[], b: number[], laeufe: number, rnd: () => number): number {
  const na = a.length
  const nb = b.length
  if (na === 0 || nb === 0) return 1
  const alle = [...a, ...b]
  const n = alle.length
  const summe = alle.reduce((s, x) => s + x, 0)
  const summeA = a.reduce((s, x) => s + x, 0)
  const beobachtet = Math.abs(summeA / na - (summe - summeA) / nb)
  const toleranz = 1e-9 // Gleitkomma-Rauschen bei gleich großen Differenzen
  let treffer = 0
  for (let lauf = 0; lauf < laeufe; lauf++) {
    // Teilmischung: nur die ersten na Plätze brauchen eine Ziehung
    let s = 0
    for (let i = 0; i < na; i++) {
      const j = i + Math.floor(rnd() * (n - i))
      const t = alle[i]
      alle[i] = alle[j]
      alle[j] = t
      s += alle[i]
    }
    if (Math.abs(s / na - (summe - s) / nb) >= beobachtet - toleranz) treffer++
  }
  return (treffer + 1) / (laeufe + 1)
}

/** Benjamini-Hochberg (Step-up): adjustierte q-Werte in der Reihenfolge der Eingabe. */
export function benjaminiHochberg(p: number[]): number[] {
  const m = p.length
  const ordnung = p.map((wert, index) => ({ wert, index })).sort((x, y) => x.wert - y.wert || x.index - y.index)
  const q = new Array<number>(m)
  let darueber = 1
  for (let rang = m; rang >= 1; rang--) {
    const { wert, index } = ordnung[rang - 1]
    darueber = Math.min(darueber, (wert * m) / rang)
    q[index] = darueber
  }
  return q
}
