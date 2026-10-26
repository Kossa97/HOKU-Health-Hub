import { pkRates, singleDoseLevel } from '../../lib/pkModel'

export interface PkProfile {
  id: string
  name: string
  aliases: string[]
  half_life_hours: number
  tmax_hours: number
  bioavailability_sc: number
  vd_l_kg: number | null
  notes: string | null
  category: string
}

function levelsAt(profile: PkProfile, times: number[], doseOffsets: number[]): number[] {
  const rates = pkRates(profile.half_life_hours, profile.tmax_hours)
  if (!rates) return times.map(() => 0)
  return times.map(t => doseOffsets.reduce(
    (total, offset) => total + singleDoseLevel(1, profile.bioavailability_sc, t - offset, rates),
    0,
  ))
}

export interface SimResult {
  /** t in Stunden, c in % vom Peak */
  data: Array<{ t: number; c: number }>
  tmaxActual: number
  /** Ende des berechneten Fensters (h) */
  xMax: number
  t10: number
  accumFactor: number
}

export function runSimulation(profile: PkProfile, multiDose: boolean, intervalH: number, numDoses: number): SimResult {
  const steps = 300
  const doseOffsets = multiDose && intervalH > 0 && numDoses > 1
    ? Array.from({ length: numDoses }, (_, d) => d * intervalH)
    : [0]
  // Fenster: letzte Gabe plus fuenf Halbwertszeiten der langsameren Konstante.
  // Bei langsamer Resorption (ka < ke) bestimmt ka das Abklingen, nicht ke.
  const rates = pkRates(profile.half_life_hours, profile.tmax_hours)
  const terminalHalfLife = rates ? Math.LN2 / Math.min(rates.ka, rates.ke) : profile.half_life_hours
  const xMax = doseOffsets[doseOffsets.length - 1] + Math.max(profile.half_life_hours, terminalHalfLife) * 5
  const rawT = Array.from({ length: steps + 1 }, (_, i) => (i * xMax) / steps)
  const concentrations = levelsAt(profile, rawT, doseOffsets)

  const peak = Math.max(...concentrations)
  const peakIdx = concentrations.indexOf(peak)
  const tmaxActual = rawT[peakIdx] ?? profile.tmax_hours
  const pct = concentrations.map(c => (peak > 0 ? (c / peak) * 100 : 0))

  let t10 = xMax
  for (let i = peakIdx; i < rawT.length; i++) {
    if (pct[i] < 10) { t10 = rawT[i]; break }
  }

  let accumFactor = 1
  if (doseOffsets.length > 1) {
    const singlePeak = Math.max(...levelsAt(profile, rawT, [0]))
    accumFactor = singlePeak > 0 ? peak / singlePeak : 1
  }

  return { data: rawT.map((t, i) => ({ t, c: pct[i] })), tmaxActual, xMax, t10, accumFactor }
}

