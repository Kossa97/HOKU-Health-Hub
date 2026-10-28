/**
 * Supersaetze verknuepfen und loesen — eine Regel fuer Logger (Reducer) und
 * Routine-Editor, damit sich beide gleich verhalten.
 *
 * Eine Gruppe ist eine Kette benachbarter Uebungen mit derselben
 * `supersetGroup`. Der Knopf an Uebung `index` meint immer die Verbindung
 * zur naechsten Uebung:
 * - besteht sie, wird die Kette ab `index` abgetrennt (alles dahinter mit
 *   derselben Gruppe verliert sie);
 * - sonst werden `index` und `index + 1` in eine Gruppe gelegt (die
 *   bestehende von `index`, sonst die von `index + 1`, sonst eine neue).
 * Was danach allein in einer Gruppe steht, ist kein Supersatz mehr.
 */

type Grouped = { supersetGroup?: number | null }

/** Ein Supersatz mit nur noch einer Uebung ist keiner mehr. */
export function dissolveLoneSupersets<T extends Grouped>(exercises: T[]): T[] {
  return exercises.map((ex, i) => {
    if (ex.supersetGroup == null) return ex
    const neighbour = exercises[i - 1]?.supersetGroup === ex.supersetGroup || exercises[i + 1]?.supersetGroup === ex.supersetGroup
    return neighbour ? ex : { ...ex, supersetGroup: null }
  })
}

function nextSupersetGroup(exercises: readonly Grouped[]): number {
  return exercises.reduce((max, ex) => Math.max(max, ex.supersetGroup ?? 0), 0) + 1
}

/** Verbindung von `index` zur naechsten Uebung umschalten; gibt dieselbe Liste zurueck, wenn nichts zu tun ist. */
export function toggleSupersetAt<T extends Grouped>(exercises: T[], index: number): T[] {
  const current = exercises[index]
  const next = exercises[index + 1]
  if (!current) return exercises
  if (current.supersetGroup != null && next?.supersetGroup === current.supersetGroup) {
    // Aufloesen: die Kette ab hier abtrennen.
    return dissolveLoneSupersets(exercises.map((ex, i) =>
      i > index && ex.supersetGroup === current.supersetGroup ? { ...ex, supersetGroup: null } : ex))
  }
  if (!next) return exercises
  const group = current.supersetGroup ?? next.supersetGroup ?? nextSupersetGroup(exercises)
  // Zieht `next` aus einem anderen Supersatz herueber, bleibt dort evtl. eine Uebung allein.
  return dissolveLoneSupersets(exercises.map((ex, i) =>
    i === index || i === index + 1 ? { ...ex, supersetGroup: group } : ex))
}

/** Gehoert die Uebung zu einem Supersatz und ist sie nicht die letzte darin? */
export function continuesSuperset(exercises: readonly Grouped[], index: number): boolean {
  const group = exercises[index]?.supersetGroup
  return group != null && exercises[index + 1]?.supersetGroup === group
}
