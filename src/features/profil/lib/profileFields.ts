/**
 * Felder des Profils, die nicht zu Blutwerten oder Koerpermassen gehoeren:
 * Ziele, Land und das Profil-Geschlecht (`profiles.goals`, `profiles.country`,
 * `profiles.profile_gender`). Das Profil-Geschlecht ist getrennt vom
 * biologischen Geschlecht (`profiles.bio_sex`, steuert Referenzbereiche).
 */

export type GoalTag =
  | 'fettabbau' | 'muskelaufbau' | 'recomp' | 'kraft' | 'ausdauer'
  | 'longevity' | 'blutwerte' | 'schlaf' | 'wohlbefinden'

export const GOAL_TAGS: readonly GoalTag[] = [
  'fettabbau', 'muskelaufbau', 'recomp', 'kraft', 'ausdauer',
  'longevity', 'blutwerte', 'schlaf', 'wohlbefinden',
]

export type ProfileGender = 'male' | 'female' | 'diverse'

export const isProfileGender = (v: unknown): v is ProfileGender =>
  v === 'male' || v === 'female' || v === 'diverse'

/** ⚧ ist ein Platzhalter, bis der Nutzer sein eigenes Zeichen liefert. */
export function genderSymbol(g: ProfileGender | null): string | null {
  if (g === 'male') return '♂'
  if (g === 'female') return '♀'
  if (g === 'diverse') return '⚧'
  return null
}

/**
 * Spalten fuers Speichern beim Registrieren: `bio_sex` wird nur bei
 * maennlich/weiblich vorbelegt, bei divers oder ohne Angabe bleibt es leer.
 */
export function geschlechtFelder(g: ProfileGender | null): { profile_gender: ProfileGender | null; bio_sex?: 'male' | 'female' } {
  if (g === 'male' || g === 'female') return { profile_gender: g, bio_sex: g }
  return { profile_gender: g }
}

const COUNTRY_CODES = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT ' +
  'MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG ' +
  'UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ')

const COUNTRY_SET = new Set(COUNTRY_CODES)

/** Gleiche Form wie die Pruefung in der Datenbank: zwei Grossbuchstaben. */
export const isCountryCode = (v: string): boolean => /^[A-Z]{2}$/.test(v)

const flagOf = (code: string): string =>
  String.fromCodePoint(...[...code].map(c => 0x1f1e6 + c.charCodeAt(0) - 65))

/** Alle Laender, im Namen der Sprache, nach Name sortiert. */
export function countryOptions(locale: string): { code: string; name: string; flag: string }[] {
  const names = new Intl.DisplayNames([locale], { type: 'region' })
  return COUNTRY_CODES
    .map(code => ({ code, name: names.of(code) ?? code, flag: flagOf(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale))
}

/** Gespeicherter Wert aus der Datenbank: nur bekannte Codes zaehlen. */
export const knownCountry = (v: unknown): string | null =>
  typeof v === 'string' && COUNTRY_SET.has(v) ? v : null
