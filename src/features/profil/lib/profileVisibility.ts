/**
 * Sichtbarkeit pro Profilfeld (Teilprojekt 2a) und die Layoutregel, nach der
 * sich sichtbare Werte ohne Luecke anordnen.
 *
 * Gespeichert in `profiles.field_visibility` (jsonb): fehlender Schluessel =
 * „Nur ich“, sonst `friends` oder `all`. So starten neue Felder automatisch
 * privat. Die Feldliste muss mit `profile_visibility_ok` in
 * `supabase-profil-p2a-sichtbarkeit.sql` uebereinstimmen (Test prueft das).
 */

export type Visibility = 'me' | 'friends' | 'all'
export type StoredVisibility = Exclude<Visibility, 'me'>
export type VisibilityMap = Partial<Record<ProfileField, StoredVisibility>>

export type ProfileSection =
  | 'kopf' | 'kurzinfo' | 'ueber' | 'koerper' | 'einnahmen'
  | 'blut' | 'gesundheit' | 'training' | 'berichte'

export const PROFILE_SECTIONS: readonly ProfileSection[] = [
  'kopf', 'kurzinfo', 'ueber', 'koerper', 'einnahmen', 'blut', 'gesundheit', 'training', 'berichte',
]

export const PROFILE_FIELDS = [
  'cover', 'gender', 'country',
  'bio', 'goals', 'streak', 'member_since',
  'age', 'height', 'weight',
  'body_fat', 'muscle_mass', 'measurements',
  'adherence', 'substances',
  'markers', 'in_range',
  'steps', 'resting_hr', 'sleep', 'active_kcal', 'spo2', 'blood_pressure', 'hrv', 'vo2max',
  'workouts', 'routine', 'favorite_exercise', 'e1rm',
  'reviews',
] as const

export type ProfileField = typeof PROFILE_FIELDS[number]

export const FIELD_SECTION: Readonly<Record<ProfileField, ProfileSection>> = {
  cover: 'kopf', gender: 'kopf', country: 'kopf',
  bio: 'kurzinfo', goals: 'kurzinfo', streak: 'kurzinfo', member_since: 'kurzinfo',
  age: 'ueber', height: 'ueber', weight: 'ueber',
  body_fat: 'koerper', muscle_mass: 'koerper', measurements: 'koerper',
  adherence: 'einnahmen', substances: 'einnahmen',
  markers: 'blut', in_range: 'blut',
  steps: 'gesundheit', resting_hr: 'gesundheit', sleep: 'gesundheit', active_kcal: 'gesundheit',
  spo2: 'gesundheit', blood_pressure: 'gesundheit', hrv: 'gesundheit', vo2max: 'gesundheit',
  workouts: 'training', routine: 'training', favorite_exercise: 'training', e1rm: 'training',
  reviews: 'berichte',
}

export const isProfileField = (v: unknown): v is ProfileField =>
  typeof v === 'string' && (PROFILE_FIELDS as readonly string[]).includes(v)

export const fieldsOfSection = (section: ProfileSection): ProfileField[] =>
  PROFILE_FIELDS.filter(f => FIELD_SECTION[f] === section)

/** Liest eine Stufe; alles Unbekannte zaehlt als „Nur ich“. */
export function visibilityOf(map: unknown, field: ProfileField): Visibility {
  if (!map || typeof map !== 'object') return 'me'
  const v = (map as Record<string, unknown>)[field]
  return v === 'friends' || v === 'all' ? v : 'me'
}

/** Bereinigt, was aus der Datenbank kommt: nur bekannte Felder und Stufen. */
export function parseVisibilityMap(raw: unknown): VisibilityMap {
  const out: VisibilityMap = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw)) {
    if (isProfileField(key) && (value === 'friends' || value === 'all')) out[key] = value
  }
  return out
}

/** Neue Karte mit geaenderter Stufe; „Nur ich“ entfernt den Schluessel. */
export function withVisibility(map: VisibilityMap, field: ProfileField, v: Visibility): VisibilityMap {
  const next: VisibilityMap = { ...map }
  if (v === 'me') delete next[field]
  else next[field] = v
  return next
}

/** Chip antippen: Nur ich → Freunde → Alle → Nur ich. */
export function cycleVisibility(v: Visibility): Visibility {
  return v === 'me' ? 'friends' : v === 'friends' ? 'all' : 'me'
}

/** „Alle auf Ich“ / „Alle auf Alle“ fuer einen Bereich. */
export function withSectionVisibility(map: VisibilityMap, section: ProfileSection, v: Visibility): VisibilityMap {
  return fieldsOfSection(section).reduce((acc, f) => withVisibility(acc, f, v), map)
}

// ── Layoutregel: keine Luecke, trotzdem symmetrisch ──────────────────────────

/**
 * Raster einer Karte nach Anzahl sichtbarer Werte:
 * 1 → volle Breite; 3 kurze Werte → eine Reihe mit drei; sonst zwei Spalten,
 * ein ungerader Rest geht ueber die volle Breite. Lange Textwerte (Umfaenge)
 * kommen nie in eine Dreierreihe.
 */
export type TileLayout = 'r1' | 'r3' | 'r2' | 'r2-rest'

export function tileLayout(count: number, hasLongText = false): TileLayout {
  if (count <= 1) return 'r1'
  if (count === 3 && !hasLongText) return 'r3'
  return count % 2 === 0 ? 'r2' : 'r2-rest'
}

/**
 * Karten mit genau einem sichtbaren Wert werden halbe Karten; zwei solche
 * direkt hintereinander stehen nebeneinander. Bleibt eine allein, nimmt sie die
 * volle Breite. Karten ohne Wert fallen weg.
 */
export type CardRow<T> = { kind: 'full'; card: T } | { kind: 'pair'; cards: [T, T] }

export function arrangeCards<T>(cards: readonly T[], count: (card: T) => number): CardRow<T>[] {
  const visible = cards.filter(c => count(c) > 0)
  const rows: CardRow<T>[] = []
  for (let i = 0; i < visible.length; i++) {
    const card = visible[i]
    const next = visible[i + 1]
    if (count(card) === 1 && next !== undefined && count(next) === 1) {
      rows.push({ kind: 'pair', cards: [card, next] })
      i++
    } else {
      rows.push({ kind: 'full', card })
    }
  }
  return rows
}
