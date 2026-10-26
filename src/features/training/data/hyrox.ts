/**
 * Hyrox: offizielle Gewichte je Division und die Wettkampf-Routine.
 *
 * Quelle: HYROX Singles Rulebook (Saison 25/26, Werte unveraendert im
 * Rulebook 26/27: https://maintain.hyrox.com/rulebooks/HYROX_RulebookSingles_EN.pdf),
 * gegengeprueft mit Red Bull „HYROX weights overview“
 * (https://www.redbull.com/us-en/hyrox-weights-overview). Stand: Oktober 2026.
 *
 * - Sled-Gewichte INKLUSIVE Schlitten.
 * - Farmers Carry: Gewicht je Hand (zwei Kettlebells).
 * - Wall Balls: 100 Wdh. in allen Divisionen; Zielhoehe 2,70 m (Frauen) /
 *   3,00 m (Maenner).
 * - Doubles (Women/Men) laufen mit den Open-Gewichten. Mixed Doubles fehlt
 *   bewusst: eine Quelle nennt Men-Open-, eine andere Women-Pro-Gewichte.
 *   Bei Sled, Carry und Sandbag ist das dieselbe Zahl, bei der Wall-Ball-
 *   Zielhoehe (3,00 m oder 2,70 m) nicht. Erst nach Blick ins Doubles-
 *   Rulebook ergaenzen.
 */
import type { RoutineExercise } from '../types'

export type HyroxDivisionId =
  | 'women_open'
  | 'men_open'
  | 'women_pro'
  | 'men_pro'
  | 'women_doubles'
  | 'men_doubles'

export interface HyroxDivision {
  id: HyroxDivisionId
  name: { de: string; en: string }
  /** Sled Push 50 m, Gewicht inkl. Schlitten. */
  sledPushKg: number
  /** Sled Pull 50 m, Gewicht inkl. Schlitten. */
  sledPullKg: number
  /** Farmers Carry 200 m, Gewicht je Hand. */
  farmersCarryKg: number
  /** Sandbag Lunges 100 m. */
  sandbagKg: number
  wallBallKg: number
  /** Zielhoehe der Wall Balls in Metern. */
  wallBallTargetM: number
  wallBallReps: number
}

const WOMEN_OPEN = { sledPushKg: 102, sledPullKg: 78, farmersCarryKg: 16, sandbagKg: 10, wallBallKg: 4, wallBallTargetM: 2.7, wallBallReps: 100 }
const MEN_OPEN = { sledPushKg: 152, sledPullKg: 103, farmersCarryKg: 24, sandbagKg: 20, wallBallKg: 6, wallBallTargetM: 3.0, wallBallReps: 100 }
const WOMEN_PRO = { sledPushKg: 152, sledPullKg: 103, farmersCarryKg: 24, sandbagKg: 20, wallBallKg: 6, wallBallTargetM: 2.7, wallBallReps: 100 }
const MEN_PRO = { sledPushKg: 202, sledPullKg: 153, farmersCarryKg: 32, sandbagKg: 30, wallBallKg: 9, wallBallTargetM: 3.0, wallBallReps: 100 }

export const HYROX_DIVISIONS: Readonly<Record<HyroxDivisionId, HyroxDivision>> = {
  women_open: { id: 'women_open', name: { de: 'Women Open', en: 'Women Open' }, ...WOMEN_OPEN },
  men_open: { id: 'men_open', name: { de: 'Men Open', en: 'Men Open' }, ...MEN_OPEN },
  women_pro: { id: 'women_pro', name: { de: 'Women Pro', en: 'Women Pro' }, ...WOMEN_PRO },
  men_pro: { id: 'men_pro', name: { de: 'Men Pro', en: 'Men Pro' }, ...MEN_PRO },
  women_doubles: { id: 'women_doubles', name: { de: 'Women Doubles', en: 'Women Doubles' }, ...WOMEN_OPEN },
  men_doubles: { id: 'men_doubles', name: { de: 'Men Doubles', en: 'Men Doubles' }, ...MEN_OPEN },
}

/** Offizielle Reihenfolge der acht Stationen. */
export const HYROX_STATION_ORDER = [
  'hyrox_skierg',
  'hyrox_sled_push',
  'hyrox_sled_pull',
  'hyrox_burpee_broad_jumps',
  'hyrox_rowing',
  'hyrox_farmers_carry',
  'hyrox_sandbag_lunges',
  'hyrox_wall_balls',
] as const

export const HYROX_RUN_ID = 'hyrox_run_1km'

type RoutineSet = RoutineExercise['sets'][number]

function stationSet(stationId: (typeof HYROX_STATION_ORDER)[number], d: HyroxDivision): RoutineSet {
  switch (stationId) {
    case 'hyrox_skierg':
      return { type: 'normal', distanceM: 1000 }
    case 'hyrox_sled_push':
      return { type: 'normal', weightKg: d.sledPushKg, distanceM: 50 }
    case 'hyrox_sled_pull':
      return { type: 'normal', weightKg: d.sledPullKg, distanceM: 50 }
    case 'hyrox_burpee_broad_jumps':
      return { type: 'normal', distanceM: 80 }
    case 'hyrox_rowing':
      return { type: 'normal', distanceM: 1000 }
    case 'hyrox_farmers_carry':
      return { type: 'normal', weightKg: d.farmersCarryKg, distanceM: 200 }
    case 'hyrox_sandbag_lunges':
      return { type: 'normal', weightKg: d.sandbagKg, distanceM: 100 }
    case 'hyrox_wall_balls':
      return { type: 'normal', weightKg: d.wallBallKg, reps: d.wallBallReps }
  }
}

/**
 * Komplettes Hyrox-Rennen als Routine: 8 × (1 km Lauf + Station) = 16 Eintraege,
 * Gewichte nach Division vorbefuellt. Pause 0 s: im Rennen geht es direkt weiter.
 */
export function hyroxRoutine(division: HyroxDivisionId | HyroxDivision): RoutineExercise[] {
  const d = typeof division === 'string' ? HYROX_DIVISIONS[division] : division
  return HYROX_STATION_ORDER.flatMap((stationId): RoutineExercise[] => [
    { exerciseId: HYROX_RUN_ID, restS: 0, sets: [{ type: 'normal', distanceM: 1000 }] },
    { exerciseId: stationId, restS: 0, sets: [stationSet(stationId, d)] },
  ])
}
