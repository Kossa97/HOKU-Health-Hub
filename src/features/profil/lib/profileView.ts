/**
 * Was eine Profilseite anzeigt (Teilprojekt 2a): die Antwort von
 * `profile_view(username)` in einer geprüften Form, dazu der Ersatz aus der
 * eigenen Profilzeile und dem lokal gerechneten Schnappschuss, falls die
 * Funktion fehlt oder ausfällt.
 *
 * Die Werte im Schnappschuss schreibt das Gerät des Profilinhabers. Für ein
 * fremdes Profil sind sie damit nicht vertrauenswürdig: `parseProfileView`
 * übernimmt nur bekannte Felder in ihrer erwarteten Form, alles andere fällt weg.
 */
import { MEASUREMENT_SITES, type MeasurementSite } from '../../fortschritt/lib/measurements'
import { GOAL_TAGS, isProfileGender, knownCountry, type GoalTag, type ProfileGender } from './profileFields'
import type { ProfileSnapshotData, SnapshotNumber } from './profileSnapshot'
import { isBadgeId, isRankId, parseWebBadges, type WebBadgeOverrides } from './badgeIds'
import { isPersonalTitle, isTitleBadgeId, type ProfileTitle, type TitleSettings } from './titles'
import { PROGRESS_AREAS, type ProgressArea, type ProgressSnapshot } from './progressScore'
import { isDay } from './progressSettings'
import { fieldsOfSection, parseVisibilityMap, type ProfileField, type ProfileSection, type VisibilityMap } from './profileVisibility'

/** Werte aus der Profilzeile selbst (liest der Server direkt aus `profiles`). */
export interface ProfileRowFields {
  bio?: string
  goals?: GoalTag[]
  country?: string
  gender?: ProfileGender
  /** `YYYY-MM` */
  member_since?: string
  /** Pfad im Bucket `profile-media` */
  cover?: string
}

/** Stufen „über X %“ (`profile_web_progress_tier`). */
export const WEB_PROGRESS_TIERS = [10, 20, 30, 50, 75, 100] as const
export type WebProgressTier = typeof WEB_PROGRESS_TIERS[number]

/** Gesamtfortschritt in der Stufe web: nur die abgerundete Stufe, nie Zahl, Bereiche oder Start. */
export interface WebProgress { tier: WebProgressTier }

export const isWebProgress = (p: ProgressSnapshot | WebProgress): p is WebProgress => 'tier' in p

export type ProfileViewFields = Omit<ProfileSnapshotData, 'progress' | 'reviews'> & ProfileRowFields & {
  /** Stufen owner/friends/all: Gesamt, Bereiche, Start (2b); Stufe web: nur die Stufe (2c). */
  progress?: ProgressSnapshot | WebProgress
  /** In der Stufe web nur die Anzahl, ohne Bewertung. */
  reviews?: { count: number; avgRating?: number }
  /** Titel unter dem Namen (Profil-Zusatz Titel): bestimmt allein der Server. */
  title?: ProfileTitle
}

/** Mitgliedschaft als Dauer, abgerundet (`profile_web_member_for`); das Datum kommt nie. */
export interface MemberFor {
  unit: 'days' | 'months' | 'years'
  n: number
}

/** Angaben fuer Link-Karte und Web-Seite (`card`, nur Stufe web). */
export interface WebCard {
  memberFor?: MemberFor
  /** „trackt N Werte“: Werte in Koerper, Training, Erholung. */
  webValueCount?: number
  /** Zahl aller Eintraege; nur, wenn die Fortschrittsstufe im Web steht. */
  entryCount?: number
}

/** Stufe der Antwort: `owner` = eigene Sicht; sonst „Ansehen als …“. */
export type ViewAs = 'owner' | 'friends' | 'all' | 'web'
export const VIEW_AS: readonly ViewAs[] = ['owner', 'friends', 'all', 'web']

/** Stand des Bild-Checks (`profiles.avatar_status` / `cover_status`). */
export type MediaStatus = 'pending' | 'approved' | 'rejected'
export const isMediaStatus = (v: unknown): v is MediaStatus => v === 'pending' || v === 'approved' || v === 'rejected'

export interface ProfileView {
  username: string
  displayName: string | null
  own: boolean
  blocked: boolean
  /** Fremdes Profil ist privat: nur Bild, Name, Nickname. */
  private: boolean
  /** Pfad des Profilbilds, nur wenn es der Betrachter sehen darf. */
  avatar: string | null
  fields: ProfileViewFields
  /** Nur in der eigenen Sicht (Stufe „owner“). */
  visibility: VisibilityMap | null
  profilePrivate: boolean | null
  webLinkEnabled: boolean | null
  /** Nur für den Eigentümer: in welcher Stufe der Server geantwortet hat. */
  as: ViewAs | null
  /** Nur in der eigenen Sicht: Stand des Bild-Checks. */
  avatarStatus: MediaStatus | null
  coverStatus: MediaStatus | null
  /** Nur in der Stufe web (2c); `null`, wenn keine Angabe gueltig ist. */
  card: WebCard | null
  /** Suchmaschinen-Schalter: in der Stufe web und in der eigenen Sicht. */
  webIndexable: boolean | null
  /** Nur in der eigenen Sicht: Abweichungen vom Standard der Abzeichen im Web. */
  webBadges: WebBadgeOverrides | null
  /** Nur in der eigenen Sicht: Wahl, Schalter und Bestätigungen des Titels. */
  titleSettings: TitleSettings | null
}

// ─── Prüfen ─────────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const text = (v: unknown, max = 200): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined
/** Ganze Zahl in den Grenzen, sonst `undefined`. */
const int = (v: unknown, min: number, max: number): number | undefined =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? v as number : undefined
const isWebTier = (v: unknown): v is WebProgressTier => (WEB_PROGRESS_TIERS as readonly unknown[]).includes(v)

function snapNumber<U extends string>(v: unknown, unit: U): SnapshotNumber<U> | undefined {
  if (!isObj(v)) return undefined
  const value = num(v.v)
  if (value === undefined) return undefined
  const delta = num(v.delta)
  return delta === undefined ? { v: value, unit } : { v: value, unit, delta }
}

const isSite = (v: unknown): v is MeasurementSite =>
  typeof v === 'string' && (MEASUREMENT_SITES as readonly string[]).includes(v)

/** Übernimmt nur bekannte Felder in ihrer erwarteten Form. */
export function parseFields(raw: unknown): ProfileViewFields {
  const out: ProfileViewFields = {}
  if (!isObj(raw)) return out

  const bio = text(raw.bio, 1000)
  if (bio) out.bio = bio
  if (Array.isArray(raw.goals)) {
    const goals = GOAL_TAGS.filter(g => (raw.goals as unknown[]).includes(g))
    if (goals.length > 0) out.goals = goals
  }
  const country = knownCountry(raw.country)
  if (country) out.country = country
  if (isProfileGender(raw.gender)) out.gender = raw.gender
  if (typeof raw.member_since === 'string' && /^\d{4}-\d{2}$/.test(raw.member_since)) out.member_since = raw.member_since
  const cover = text(raw.cover, 500)
  if (cover) out.cover = cover

  if (isObj(raw.age) && num(raw.age.v) !== undefined) out.age = { v: num(raw.age.v)! }
  const height = snapNumber(raw.height, 'cm')
  if (height) out.height = height
  const weight = snapNumber(raw.weight, 'kg')
  if (weight) out.weight = weight
  const bodyFat = snapNumber(raw.body_fat, '%')
  if (bodyFat) out.body_fat = bodyFat
  const muscle = snapNumber(raw.muscle_mass, 'kg')
  if (muscle) out.muscle_mass = muscle
  if (isObj(raw.measurements) && Array.isArray(raw.measurements.sites)) {
    const sites = raw.measurements.sites.flatMap(s => {
      if (!isObj(s) || !isSite(s.site) || num(s.v) === undefined) return []
      const delta = num(s.delta)
      return [delta === undefined ? { site: s.site, v: num(s.v)! } : { site: s.site, v: num(s.v)!, delta }]
    })
    if (sites.length > 0) out.measurements = { unit: 'cm', sites }
  }
  if (isObj(raw.adherence)) {
    const { pct, confirmed, missed, days } = raw.adherence
    if (num(pct) !== undefined) {
      out.adherence = { pct: num(pct)!, confirmed: num(confirmed) ?? 0, missed: num(missed) ?? 0, days: num(days) ?? 90 }
    }
  }
  if (isObj(raw.substances) && num(raw.substances.count) !== undefined) {
    out.substances = { count: num(raw.substances.count)!, activeCycles: num(raw.substances.activeCycles) ?? 0 }
  }
  if (isObj(raw.markers) && num(raw.markers.count) !== undefined) out.markers = { count: num(raw.markers.count)! }
  if (isObj(raw.in_range) && num(raw.in_range.inRange) !== undefined && num(raw.in_range.of) !== undefined) {
    out.in_range = { inRange: num(raw.in_range.inRange)!, of: num(raw.in_range.of)! }
  }
  const steps = snapNumber(raw.steps, 'steps')
  if (steps) out.steps = steps
  const hr = snapNumber(raw.resting_hr, 'bpm')
  if (hr) out.resting_hr = hr
  const sleep = snapNumber(raw.sleep, 'min')
  if (sleep) out.sleep = sleep
  const kcal = snapNumber(raw.active_kcal, 'kcal')
  if (kcal) out.active_kcal = kcal
  const spo2 = snapNumber(raw.spo2, '%')
  if (spo2) out.spo2 = spo2
  if (isObj(raw.blood_pressure) && num(raw.blood_pressure.sys) !== undefined && num(raw.blood_pressure.dia) !== undefined) {
    out.blood_pressure = { sys: num(raw.blood_pressure.sys)!, dia: num(raw.blood_pressure.dia)!, unit: 'mmHg' }
  }
  if (isObj(raw.workouts) && num(raw.workouts.total) !== undefined) {
    out.workouts = { total: num(raw.workouts.total)!, perWeek: num(raw.workouts.perWeek) ?? 0 }
  }
  if (isObj(raw.routine)) {
    const name = text(raw.routine.name, 80)
    if (name) out.routine = { name }
  }
  if (isObj(raw.favorite_exercise)) {
    const name = text(raw.favorite_exercise.name, 80)
    if (name) out.favorite_exercise = { id: text(raw.favorite_exercise.id, 80) ?? '', name }
  }
  if (isObj(raw.e1rm) && Array.isArray(raw.e1rm.top)) {
    const top = raw.e1rm.top.flatMap(e => {
      const name = isObj(e) ? text(e.name, 80) : undefined
      const v = isObj(e) ? num(e.v) : undefined
      return isObj(e) && name && v !== undefined ? [{ id: text(e.id, 80) ?? '', name, v }] : []
    }).slice(0, 3)
    if (top.length > 0) out.e1rm = { unit: 'kg', top }
  }
  if (isObj(raw.reviews) && num(raw.reviews.count) !== undefined && num(raw.reviews.count)! > 0) {
    // Stufe web: nur {count} — dann fehlt die Bewertung, statt als 0 zu erscheinen.
    const avg = num(raw.reviews.avgRating)
    out.reviews = avg === undefined ? { count: num(raw.reviews.count)! } : { count: num(raw.reviews.count)!, avgRating: avg }
  }
  if (isObj(raw.streak) && num(raw.streak.days) !== undefined && num(raw.streak.days)! > 0) {
    out.streak = { days: num(raw.streak.days)! }
  }
  // 2c, Stufe web: nur {tier}. Steht `tier` da, gilt allein diese Form (ungueltig → weg).
  if (isObj(raw.progress) && 'tier' in raw.progress) {
    if (isWebTier(raw.progress.tier)) out.progress = { tier: raw.progress.tier }
  // 2b: nur Gesamt, die fuenf Bereiche und der Start; Einzelwerte gibt es hier nie
  } else if (isObj(raw.progress) && num(raw.progress.total) !== undefined && isDay(raw.progress.since)) {
    const areas: Partial<Record<ProgressArea, number>> = {}
    const rawAreas = isObj(raw.progress.areas) ? raw.progress.areas : {}
    for (const a of PROGRESS_AREAS) {
      const v = num(rawAreas[a])
      if (v !== undefined) areas[a] = v
    }
    out.progress = { total: num(raw.progress.total)!, areas, since: raw.progress.since }
  }
  if (Array.isArray(raw.badges)) {
    const badges = [...new Set(raw.badges.filter(isBadgeId))]
    if (badges.length > 0) out.badges = badges
  }
  const title = parseProfileTitle(raw.title)
  if (title) out.title = title
  return out
}

/** `{kind, id}`: Rang nur mit Rang-ID, Abzeichen nur mit tragbarer ID; sonst nichts. */
export function parseProfileTitle(raw: unknown): ProfileTitle | undefined {
  if (!isObj(raw) || !isBadgeId(raw.id)) return undefined
  if (raw.kind === 'rank' && isRankId(raw.id)) return { kind: 'rank', id: raw.id }
  if (raw.kind === 'badge' && isTitleBadgeId(raw.id)) return { kind: 'badge', id: raw.id }
  return undefined
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Titel-Spalten der eigenen Profilzeile (fehlen vor der Titel-Migration → Standard). */
export function parseTitleSettings(row: Obj): TitleSettings {
  const consents: TitleSettings['consents'] = {}
  if (isObj(row.title_consents)) {
    for (const [k, v] of Object.entries(row.title_consents)) {
      if (isBadgeId(k) && isPersonalTitle(k) && typeof v === 'string' && DAY.test(v)) consents[k] = v
    }
  }
  return {
    choice: isTitleBadgeId(row.title_choice) ? row.title_choice : null,
    personalAllowed: row.personal_titles === true,
    consents,
  }
}

const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)

/** Obergrenze fuer Zaehler der Karte (Schutz gegen Unsinn; SQL liefert weit weniger). */
const CARD_COUNT_MAX = 100_000_000
const MEMBER_UNITS: readonly MemberFor['unit'][] = ['days', 'months', 'years']

/** `card` der Stufe web: nur bekannte Angaben in ihrer Form; ungueltige fallen einzeln weg. */
export function parseWebCard(raw: unknown): WebCard | null {
  if (!isObj(raw)) return null
  const out: WebCard = {}
  const m = raw.member_since
  if (isObj(m) && (MEMBER_UNITS as readonly unknown[]).includes(m.unit)) {
    const n = int(m.n, 0, 10_000)
    if (n !== undefined) out.memberFor = { unit: m.unit as MemberFor['unit'], n }
  }
  const values = int(raw.web_value_count, 1, CARD_COUNT_MAX)
  if (values !== undefined) out.webValueCount = values
  const entries = int(raw.entry_count, 1, CARD_COUNT_MAX)
  if (entries !== undefined) out.entryCount = entries
  return Object.keys(out).length > 0 ? out : null
}

/** Antwort von `profile_view`; `null` = nicht gefunden oder unbrauchbar. */
export function parseProfileView(raw: unknown): ProfileView | null {
  if (!isObj(raw) || typeof raw.username !== 'string') return null
  return {
    username: raw.username,
    displayName: text(raw.display_name, 80) ?? null,
    own: raw.own === true,
    blocked: raw.blocked === true,
    private: raw.private === true,
    avatar: text(raw.avatar, 500) ?? null,
    fields: parseFields(raw.fields),
    visibility: isObj(raw.visibility) ? parseVisibilityMap(raw.visibility) : null,
    profilePrivate: bool(raw.profile_private),
    webLinkEnabled: bool(raw.web_link_enabled),
    as: (VIEW_AS as readonly unknown[]).includes(raw.as) ? raw.as as ViewAs : null,
    avatarStatus: isMediaStatus(raw.avatar_status) ? raw.avatar_status : null,
    coverStatus: isMediaStatus(raw.cover_status) ? raw.cover_status : null,
    card: parseWebCard(raw.card),
    webIndexable: bool(raw.web_indexable),
    webBadges: isObj(raw.web_badges) ? parseWebBadges(raw.web_badges) : null,
    titleSettings: 'personal_titles' in raw ? parseTitleSettings(raw) : null,
  }
}

// ─── Ersatz in der eigenen Sicht ───────────────────────────────────────────

/** Eigene Profilzeile + lokal gerechneter Schnappschuss, wenn `profile_view` nicht antwortet. */
export function localProfileView(row: Obj, snapshot: ProfileSnapshotData | null): ProfileView {
  const created = typeof row.created_at === 'string' ? row.created_at.slice(0, 7) : undefined
  const fields = parseFields({
    ...(snapshot ?? {}),
    bio: row.public_bio,
    goals: row.goals,
    country: row.country,
    gender: row.profile_gender,
    member_since: created,
    cover: row.cover_path,
  })
  return {
    username: typeof row.username === 'string' ? row.username : '',
    displayName: text(row.display_name, 80) ?? null,
    own: true,
    blocked: false,
    private: false,
    avatar: text(row.avatar_path, 500) ?? null,
    fields,
    visibility: parseVisibilityMap(row.field_visibility),
    profilePrivate: row.profile_private === true,
    webLinkEnabled: row.web_link_enabled === true,
    as: 'owner',
    avatarStatus: isMediaStatus(row.avatar_status) ? row.avatar_status : null,
    coverStatus: isMediaStatus(row.cover_status) ? row.cover_status : null,
    card: null,
    // vor der Migration 2c fehlen beide Spalten
    webIndexable: bool(row.web_indexable),
    webBadges: isObj(row.web_badges) ? parseWebBadges(row.web_badges) : null,
    titleSettings: parseTitleSettings(row),
  }
}

// ─── Karten ─────────────────────────────────────────────────────────────────

export type ProfileCardId = Exclude<ProfileSection, 'kopf' | 'kurzinfo'>

/** Reihenfolge der Karten unter dem Kopf (Plätze für 2b bleiben frei). */
export const PROFILE_CARDS: readonly ProfileCardId[] = [
  'ueber', 'koerper', 'einnahmen', 'blut', 'gesundheit', 'training', 'berichte',
]

/** Felder ohne Wert, die der Inhaber trotzdem mit Strich sieht (kommen mit Schritt 1b). */
export const OWN_PLACEHOLDER_FIELDS: readonly ProfileField[] = ['hrv', 'vo2max']

/** Felder einer Karte, die angezeigt werden: mit Wert, und in der eigenen Sicht die Platzhalter. */
export function shownFields(card: ProfileCardId, fields: ProfileViewFields, own: boolean): ProfileField[] {
  return fieldsOfSection(card).filter(f =>
    (fields as Record<string, unknown>)[f] !== undefined || (own && OWN_PLACEHOLDER_FIELDS.includes(f)))
}

/** Lange Textwerte stehen nie in einer Dreierreihe. */
export const LONG_TEXT_FIELDS: readonly ProfileField[] = ['measurements']

// ─── Link ───────────────────────────────────────────────────────────────────

/** Öffentliche Adresse des Profils; in der nativen App nicht `capacitor://…`. */
export function profileUrl(username: string, origin?: string): string {
  const base = (origin ?? (import.meta.env?.VITE_PUBLIC_SITE_URL || window.location.origin)).replace(/\/+$/, '')
  return `${base}/u/${encodeURIComponent(username.toLowerCase())}`
}
