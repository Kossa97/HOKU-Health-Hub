import type { CycleTimeline } from '../../../lib/planTimeline'
import { localDateTimeKey } from '../../../lib/planTimeline'
import { cyclePeriod, inclusiveDayCount } from '../../my-stack/lib/planCard'
import { rhythmLabel, slotDoseLabel, versionSlots, type Translate } from '../../my-stack/lib/planLabels'

/**
 * Bewertungen v2: eine Bewertung haengt an einem Zyklus. Was dabei war —
 * Zeitraum, Dauer, Dosis, Rhythmus — kommt aus dem Plan, nicht aus dem
 * Formular. Reine Logik, ohne Datenbank und ohne React.
 */

export type Erfahrung = 'gut' | 'mittel' | 'schlecht'
export type WiederNehmen = 'ja' | 'unsicher' | 'nein'

export interface Review {
  id: string
  stack_item_id: string
  cycle_id: string | null
  rating: number
  title: string | null
  body: string | null
  pros: string | null
  cons: string | null
  experience: Erfahrung | null
  wirkung: number | null
  vertraeglichkeit: number | null
  wieder_nehmen: WiederNehmen | null
  is_public: boolean
  /** Von der Moderation ausgeblendet: nur noch fuer den Eigentuemer sichtbar. */
  hidden_by_moderation?: boolean
  created_at: string
  updated_at: string | null
  stack_items: { display_name: string; archived?: boolean | null } | null
}

/** Was das Sheet bearbeitet. `rating` ist leer, bis man waehlt — nichts ist vorbelegt. */
export interface ReviewDraft {
  stack_item_id: string
  cycle_id: string | null
  rating: number | null
  wirkung: number | null
  vertraeglichkeit: number | null
  wieder_nehmen: WiederNehmen | null
  title: string
  body: string
  pros: string
  cons: string
  is_public: boolean
}

export function leererEntwurf(stackItemId: string, cycleId: string | null): ReviewDraft {
  return {
    stack_item_id: stackItemId, cycle_id: cycleId, rating: null, wirkung: null, vertraeglichkeit: null,
    wieder_nehmen: null, title: '', body: '', pros: '', cons: '', is_public: false,
  }
}

export function entwurfAus(review: Review): ReviewDraft {
  return {
    stack_item_id: review.stack_item_id,
    cycle_id: review.cycle_id,
    rating: review.rating,
    wirkung: review.wirkung,
    vertraeglichkeit: review.vertraeglichkeit,
    wieder_nehmen: review.wieder_nehmen,
    title: review.title ?? '',
    body: review.body ?? '',
    pros: review.pros ?? '',
    cons: review.cons ?? '',
    is_public: review.is_public,
  }
}

/** Speichern geht, sobald Substanz und Sterne gesetzt sind — alles andere ist freiwillig. */
export function entwurfGueltig(draft: ReviewDraft): boolean {
  return Boolean(draft.stack_item_id) && draft.rating != null && draft.rating >= 1 && draft.rating <= 5
}

/**
 * Die alte Dreiteilung leitet sich aus den Sternen ab. Protokoll, PDF und
 * Auswertung lesen sie noch; so bleiben sie richtig, ohne dass man zweimal
 * dasselbe gefragt wird.
 */
export function erfahrungAusSternen(rating: number): Erfahrung {
  if (rating >= 4) return 'gut'
  if (rating === 3) return 'mittel'
  return 'schlecht'
}

const leerZuNull = (text: string) => (text.trim() ? text.trim() : null)

/**
 * Die Zeile fuer die Datenbank. Der Titel ist dort Pflicht — leer heisst ''.
 * `vorher`: die bisherige Fassung. Bleiben die Sterne gleich, bleibt auch
 * die alte Dreiteilung — wer nur den Text aendert, aendert nicht nebenbei
 * „schlecht" in „gut".
 */
export function zeileAus(draft: ReviewDraft, userId: string, vorher?: Pick<Review, 'rating' | 'experience'> | null) {
  if (!entwurfGueltig(draft)) throw new Error('Bewertung unvollstaendig')
  const rating = draft.rating!
  return {
    user_id: userId,
    stack_item_id: draft.stack_item_id,
    cycle_id: draft.cycle_id,
    rating,
    experience: vorher?.experience && vorher.rating === rating ? vorher.experience : erfahrungAusSternen(rating),
    wirkung: draft.wirkung,
    vertraeglichkeit: draft.vertraeglichkeit,
    wieder_nehmen: draft.wieder_nehmen,
    title: draft.title.trim(),
    body: leerZuNull(draft.body),
    pros: leerZuNull(draft.pros),
    cons: leerZuNull(draft.cons),
    is_public: draft.is_public,
  }
}

/**
 * Beendet heisst: das Ende liegt hinter uns. Ein Plan mit festem Enddatum
 * traegt sein Ende schon vorher in `ended_at` — bis dahin laeuft er.
 */
export function istBeendet(timeline: CycleTimeline, now: Date): boolean {
  const ende = timeline.cycle.ended_at
  return ende !== null && new Date(ende).getTime() <= now.getTime()
}

/**
 * Erster und letzter Tag. Am Starttag beendet, laege der letzte Tag vor dem
 * ersten (das Ende ist eine Grenze) — dann zaehlt der eine Tag.
 */
function periode(timeline: CycleTimeline, timeZone: string, now?: Date): { first: string; last: string | null } {
  const { first, last } = cyclePeriod(timeline, timeZone)
  // Noch nicht beendet (Ende geplant, aber nicht erreicht): laeuft noch.
  if (now && !istBeendet(timeline, now)) return { first, last: null }
  return { first, last: last !== null && last < first ? first : last }
}

/** Die Zyklen einer Substanz, neueste zuerst. */
export function zyklenVon(timelines: readonly CycleTimeline[], stackItemId: string): CycleTimeline[] {
  return timelines
    .filter(timeline => timeline.cycle.stack_item_id === stackItemId)
    .sort((a, b) => b.cycle.started_at.localeCompare(a.cycle.started_at))
}

/**
 * Welcher Zyklus vorausgewaehlt wird: der zuletzt beendete, der noch keine
 * Bewertung hat — sonst der laufende ohne Bewertung — sonst keiner.
 */
export function vorgeschlagenerZyklus(
  timelines: readonly CycleTimeline[],
  stackItemId: string,
  bewertet: ReadonlySet<string>,
  now: Date,
): string | null {
  const offen = zyklenVon(timelines, stackItemId).filter(timeline => !bewertet.has(timeline.cycle.id))
  const beendet = offen
    .filter(timeline => istBeendet(timeline, now))
    .sort((a, b) => b.cycle.ended_at!.localeCompare(a.cycle.ended_at!))
  return beendet[0]?.cycle.id ?? offen.find(timeline => !istBeendet(timeline, now))?.cycle.id ?? null
}

/**
 * Fuer alte Bewertungen ohne Zyklus: der Zyklus, in dem sie geschrieben
 * wurde — sonst der letzte, der davor endete.
 */
export function zyklusZumDatum(
  timelines: readonly CycleTimeline[],
  stackItemId: string,
  instant: string,
  timeZone: string,
): string | null {
  const tag = localDateTimeKey(new Date(instant), timeZone).slice(0, 10)
  const zyklen = zyklenVon(timelines, stackItemId)
  const drin = zyklen.find(timeline => {
    const { first, last } = periode(timeline, timeZone)
    return first <= tag && (last === null || tag <= last)
  })
  if (drin) return drin.cycle.id
  const davor = zyklen
    .map(timeline => ({ id: timeline.cycle.id, last: periode(timeline, timeZone).last }))
    .filter((zyklus): zyklus is { id: string; last: string } => zyklus.last !== null && zyklus.last < tag)
    .sort((a, b) => b.last.localeCompare(a.last))
  return davor[0]?.id ?? null
}

export interface ZyklusKontext {
  /** „12.08.2026 – 28.09.2026" bzw. „seit 12.08.2026". */
  zeitraum: string
  /** „7 Wochen", „10 Tage". */
  dauer: string
  /** „250 mcg" oder „250 → 500 mcg", wenn sich die Dosis geaendert hat. */
  dosis: string | null
  /** „Täglich", „Alle 3 Tage" … — der Rhythmus der letzten Planstufe. */
  rhythmus: string | null
  laeuft: boolean
}

function datum(localDate: string, language: string): string {
  return new Intl.DateTimeFormat(language, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${localDate}T00:00:00.000Z`))
}

function dauerText(tage: number, t: Translate): string {
  if (tage >= 14) {
    const wochen = Math.round(tage / 7)
    return String(t('review_duration_weeks', { n: wochen }))
  }
  return String(tage === 1 ? t('review_duration_day') : t('review_duration_days', { n: tage }))
}

function dosisVon(timeline: CycleTimeline): string | null {
  const versionen = [...timeline.versions].sort((a, b) =>
    (a.effective_local_date ?? a.effective_at ?? '').localeCompare(b.effective_local_date ?? b.effective_at ?? ''))
  const dosen = versionen
    .map(version => versionSlots(version).map(slotDoseLabel).find(Boolean) ?? null)
    .filter((dosis): dosis is string => dosis !== null)
  if (dosen.length === 0) return null
  const erste = dosen[0]
  const letzte = dosen[dosen.length - 1]
  if (erste === letzte) return erste
  // „250 mcg → 500 mcg" mit gleicher Einheit kuerzer: „250 → 500 mcg".
  const [wertA, ...einheitA] = erste.split(' ')
  const [wertB, ...einheitB] = letzte.split(' ')
  return einheitA.join(' ') === einheitB.join(' ')
    ? `${wertA} → ${wertB} ${einheitB.join(' ')}`.trim()
    : `${erste} → ${letzte}`
}

export function zyklusKontext(
  timeline: CycleTimeline,
  now: Date,
  timeZone: string,
  language: string,
  t: Translate,
): ZyklusKontext {
  const { first, last } = periode(timeline, timeZone, now)
  const heute = localDateTimeKey(now, timeZone).slice(0, 10)
  const laeuft = last === null
  const bis = last ?? heute
  const tage = Math.max(1, inclusiveDayCount(first, bis < first ? first : bis))
  const letzteVersion = [...timeline.versions].sort((a, b) =>
    (b.effective_local_date ?? b.effective_at ?? '').localeCompare(a.effective_local_date ?? a.effective_at ?? ''))[0]
  return {
    zeitraum: laeuft
      ? String(t('review_period_since', { date: datum(first, language) }))
      : `${datum(first, language)} – ${datum(last, language)}`,
    dauer: dauerText(tage, t),
    dosis: dosisVon(timeline),
    rhythmus: letzteVersion ? rhythmLabel(letzteVersion, t) : null,
    laeuft,
  }
}

/** Kurz fuer die Auswahl: „Aug – Sep 2026", „seit Sep 2026". */
export function zyklusKurz(timeline: CycleTimeline, now: Date, timeZone: string, language: string, t: Translate): string {
  const { first, last } = periode(timeline, timeZone, now)
  const monat = (tag: string, mitJahr: boolean) => new Intl.DateTimeFormat(language, {
    month: 'short', ...(mitJahr ? { year: 'numeric' } : {}), timeZone: 'UTC',
  }).format(new Date(`${tag}T00:00:00.000Z`))
  if (last === null) return String(t('review_period_since', { date: monat(first, true) }))
  if (first.slice(0, 7) === last.slice(0, 7)) return monat(first, true)
  return `${monat(first, first.slice(0, 4) !== last.slice(0, 4))} – ${monat(last, true)}`
}

export type Reihenfolge = 'neueste' | 'beste'

export interface BewertungsGruppe {
  stackItemId: string
  name: string
  archiviert: boolean
  /** Mittel der Sterne, auf eine Stelle. */
  schnitt: number
  bewertungen: Review[]
}

/** Wann eine Bewertung zuletzt angefasst wurde. */
const zuletzt = (review: Review) => review.updated_at ?? review.created_at

/**
 * Die Uebersicht: je Substanz eine Gruppe, darin die Zyklen neueste zuerst
 * (ohne Zyklus nach Datum dahinter) — so stehen Zyklen derselben Substanz
 * nebeneinander. Gruppen nach der zuletzt bearbeiteten Bewertung oder nach
 * dem besten Schnitt.
 */
export function gruppiereBewertungen(
  reviews: readonly Review[],
  timelines: readonly CycleTimeline[],
  reihenfolge: Reihenfolge,
): BewertungsGruppe[] {
  const start = new Map(timelines.map(timeline => [timeline.cycle.id, timeline.cycle.started_at]))
  const gruppen = new Map<string, Review[]>()
  for (const review of reviews) {
    const liste = gruppen.get(review.stack_item_id) ?? []
    liste.push(review)
    gruppen.set(review.stack_item_id, liste)
  }
  const ergebnis = [...gruppen.entries()].map(([stackItemId, liste]) => {
    const sortiert = [...liste].sort((a, b) => {
      const sa = a.cycle_id ? start.get(a.cycle_id) : undefined
      const sb = b.cycle_id ? start.get(b.cycle_id) : undefined
      if (sa && sb) return sb.localeCompare(sa)
      if (sa) return -1
      if (sb) return 1
      return b.created_at.localeCompare(a.created_at)
    })
    const summe = liste.reduce((acc, review) => acc + review.rating, 0)
    return {
      stackItemId,
      name: liste[0].stack_items?.display_name ?? '',
      archiviert: liste[0].stack_items?.archived === true,
      schnitt: Math.round((summe / liste.length) * 10) / 10,
      bewertungen: sortiert,
    }
  })
  const neueste = (gruppe: BewertungsGruppe) => gruppe.bewertungen.map(zuletzt).sort().at(-1) ?? ''
  return ergebnis.sort((a, b) => reihenfolge === 'beste'
    ? b.schnitt - a.schnitt || a.name.localeCompare(b.name)
    : neueste(b).localeCompare(neueste(a)))
}

/** Suche in Name, Titel und Texten — Gross/klein egal. */
export function passtZurSuche(review: Review, suche: string): boolean {
  const s = suche.trim().toLowerCase()
  if (!s) return true
  return [review.stack_items?.display_name, review.title, review.body, review.pros, review.cons]
    .some(text => (text ?? '').toLowerCase().includes(s))
}
