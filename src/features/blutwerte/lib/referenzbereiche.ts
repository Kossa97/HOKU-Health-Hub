/**
 * Referenzbereiche nach Geschlecht und Alter (Erwachsene ab 18), in der
 * Katalog-Einheit des Markers. Greifen nur, wenn der Befund keinen eigenen
 * Laborbereich hat; der Laborbereich gilt immer zuerst.
 *
 * Quellen: gesundheitsinformation.de (IQWiG, Tabellen „Frauen/Männer über
 * 18 Jahre“) zuerst; wo es dort keine Seite gibt, MedlinePlus. Grenzen der
 * Form „unter X“ stehen als max X. Stand der Recherche: 2026-10-09.
 *
 * Für Östradiol, LH und FSH hängt der Bereich bei Frauen von Zyklus und
 * Wechseljahren ab. MedlinePlus nennt Bereiche vor und nach den Wechseljahren
 * (nicht je Zyklusphase); die Angabe kommt je Messung. Fehlt sie, gilt eine
 * Regel ohne Grenzen: dann wird kein Bereich gezeigt statt eines falschen.
 */
import type { BioSex } from './bioProfile'

export interface RangeRule {
  sex?: BioSex
  /** Alter in vollen Jahren am Tag der Messung, einschließlich. */
  ageMin?: number
  ageMax?: number
  /** Nur Frauen: gilt vor ('pre') oder nach ('post') den Wechseljahren. */
  menopause?: Wechseljahre
  min?: number
  max?: number
  /** Kein Standardbereich für diese Gruppe (Zyklus/Menopause). */
  keinStandard?: true
}

export type Wechseljahre = 'pre' | 'post'

export interface RangeSet {
  rules: RangeRule[]
  quellen: string[]
}

const IQWIG = (slug: string) => `https://www.gesundheitsinformation.de/${slug}.html`
const MLP = (id: string) => `https://medlineplus.gov/ency/article/${id}.htm`

/** Nach Geschlecht, je ein Bereich für Frauen und Männer ab 18. */
const nachGeschlecht = (frau: [number | undefined, number | undefined], mann: [number | undefined, number | undefined], quelle: string): RangeSet => ({
  rules: [
    { sex: 'female', ageMin: 18, min: frau[0], max: frau[1] },
    { sex: 'male', ageMin: 18, min: mann[0], max: mann[1] },
  ],
  quellen: [quelle],
})

/**
 * Frauen nach Wechseljahren (vor / nach); ohne Angabe kein Einzelbereich.
 * Männer: fester Bereich. Werte in Klammern der Quelle: [min, max].
 */
const nachWechseljahren = (
  vor: [number | undefined, number | undefined],
  nach: [number | undefined, number | undefined],
  mann: [number, number],
  quelle: string,
): RangeSet => ({
  rules: [
    { sex: 'female', ageMin: 18, menopause: 'pre', min: vor[0], max: vor[1] },
    { sex: 'female', ageMin: 18, menopause: 'post', min: nach[0], max: nach[1] },
    { sex: 'female', ageMin: 18, keinStandard: true },
    { sex: 'male', ageMin: 18, min: mann[0], max: mann[1] },
  ],
  quellen: [quelle],
})

export const REFERENZBEREICHE: Record<string, RangeSet> = {
  'Testosteron': nachGeschlecht([16, 78], [271, 1070], IQWIG('testosteron')),
  // MedlinePlus: Frauen vor den Wechseljahren 30–400, danach 0–30 pg/mL
  'Östradiol': nachWechseljahren([30, 400], [undefined, 30], [10, 50], MLP('003711')),
  // vor den Wechseljahren 5–25, danach 7,7–58,5 IU/L (= mIU/mL)
  'LH': nachWechseljahren([5, 25], [7.7, 58.5], [1.8, 8.6], MLP('003708')),
  // noch menstruierend 4,7–21,5, danach 25,8–134,8 mIU/mL
  'FSH': nachWechseljahren([4.7, 21.5], [25.8, 134.8], [1.5, 12.4], MLP('003710')),
  'Prolaktin': nachGeschlecht([undefined, 25], [undefined, 20], MLP('003718')),
  'DHEA-S': {
    rules: [
      { sex: 'female', ageMin: 18, ageMax: 29, min: 45, max: 320 },
      { sex: 'female', ageMin: 30, ageMax: 39, min: 40, max: 325 },
      { sex: 'female', ageMin: 40, ageMax: 49, min: 25, max: 220 },
      { sex: 'female', ageMin: 50, ageMax: 59, min: 15, max: 170 },
      { sex: 'female', ageMin: 60, max: 145 },
      { sex: 'male', ageMin: 18, ageMax: 29, min: 110, max: 510 },
      { sex: 'male', ageMin: 30, ageMax: 39, min: 110, max: 370 },
      { sex: 'male', ageMin: 40, ageMax: 49, min: 45, max: 345 },
      { sex: 'male', ageMin: 50, ageMax: 59, min: 25, max: 240 },
      { sex: 'male', ageMin: 60, max: 204 },
    ],
    quellen: [MLP('003717')],
  },
  // Nur nach Alter, für beide Geschlechter gleich.
  'TSH': {
    rules: [
      { ageMin: 18, ageMax: 19, min: 0.51, max: 4.3 },
      { ageMin: 20, ageMax: 49, min: 0.3, max: 3.5 },
      { ageMin: 50, min: 0.3, max: 4.5 },
    ],
    quellen: [IQWIG('thyreoidea-stimulierendes-hormon-tsh')],
  },
  'Hämoglobin': nachGeschlecht([11.5, 16.0], [13.5, 17.8], IQWIG('haemoglobin')),
  'Hämatokrit': nachGeschlecht([36, 48], [40, 53], IQWIG('haematokrit')),
  'Erythrozyten': nachGeschlecht([4.1, 5.1], [4.5, 5.9], IQWIG('erythrozyten')),
  'Ferritin': nachGeschlecht([9, 140], [18, 360], IQWIG('ferritin')),
  'Eisen': nachGeschlecht([40, 150], [60, 160], IQWIG('eisen')),
  'Kreatinin': nachGeschlecht([0.46, 1.0], [0.57, 1.18], IQWIG('kreatinin')),
  'Harnsäure': nachGeschlecht([2.3, 6.1], [3.6, 8.2], IQWIG('harnsaeure')),
  'Gamma-GT': nachGeschlecht([undefined, 40], [undefined, 60], IQWIG('gamma-gt-ggt')),
  'GOT (AST)': nachGeschlecht([undefined, 35], [undefined, 50], IQWIG('aspartat-aminotransferase-ast')),
  'GPT (ALT)': nachGeschlecht([undefined, 35], [undefined, 50], IQWIG('alanin-aminotransferase-alat')),
  'Alkalische Phosphatase': nachGeschlecht([35, 104], [40, 129], IQWIG('alkalische-phosphatase-ap')),
  'HDL-Cholesterin': nachGeschlecht([50, undefined], [40, undefined], IQWIG('hdl-cholesterin')),
}

/** Gruppe, für die ein Bereich gilt — für die Beschriftung („Männer, 40–49 J.“). */
export interface RangeGroup {
  sex?: BioSex
  ageMin?: number
  ageMax?: number
  menopause?: Wechseljahre
}

/** Marker, bei denen der Bereich für Frauen von den Wechseljahren abhängt. */
export const WECHSELJAHR_MARKER: ReadonlySet<string> = new Set(
  Object.entries(REFERENZBEREICHE).filter(([, set]) => set.rules.some(r => r.menopause)).map(([name]) => name),
)

export type ProfilBereich =
  | { art: 'bereich'; min: number | null; max: number | null; gruppe: RangeGroup }
  | { art: 'keinStandard'; gruppe: RangeGroup }

/** Volle Lebensjahre am Stichtag; null bei fehlendem oder unplausiblem Datum. */
export function alterAm(geburtsdatum: string | null | undefined, stichtag: string): number | null {
  if (!geburtsdatum) return null
  const g = /^(\d{4})-(\d{2})-(\d{2})/.exec(geburtsdatum)
  const s = /^(\d{4})-(\d{2})-(\d{2})/.exec(stichtag)
  if (!g || !s) return null
  const [gj, gm, gt] = [Number(g[1]), Number(g[2]), Number(g[3])]
  const [sj, sm, st] = [Number(s[1]), Number(s[2]), Number(s[3])]
  let alter = sj - gj
  if (sm < gm || (sm === gm && st < gt)) alter -= 1
  return alter >= 0 ? alter : null
}

function passt(rule: RangeRule, sex: BioSex | null, alter: number | null, menopause: Wechseljahre | null): boolean {
  if (rule.sex && rule.sex !== sex) return false
  if (rule.menopause && rule.menopause !== menopause) return false
  // Jede Regel gilt erst ab 18; ohne Alter weiß man das nicht sicher.
  if (rule.ageMin != null || rule.ageMax != null) {
    if (alter == null) {
      // Reine Geschlechtsregel ab 18: gilt auch ohne Geburtsdatum (App ist 18+).
      if (rule.ageMax == null && rule.ageMin === 18) return true
      return false
    }
    if (rule.ageMin != null && alter < rule.ageMin) return false
    if (rule.ageMax != null && alter > rule.ageMax) return false
  }
  return true
}

/**
 * Bereich für Marker, Person und Messtag — oder null, wenn keine Regel passt
 * (dann gilt der allgemeine Katalogbereich).
 */
export function profilBereich(
  markerName: string,
  profil: { birthDate: string | null; sex: BioSex | null } | null | undefined,
  testedAt: string,
  menopause: Wechseljahre | null = null,
): ProfilBereich | null {
  const set = REFERENZBEREICHE[markerName]
  if (!set || !profil || (!profil.birthDate && !profil.sex)) return null
  const alter = alterAm(profil.birthDate, testedAt)
  const rule = set.rules.find(r => passt(r, profil.sex, alter, menopause))
  if (!rule) return null
  const gruppe: RangeGroup = { sex: rule.sex, ageMin: rule.ageMin, ageMax: rule.ageMax, menopause: rule.menopause }
  if (rule.keinStandard) return { art: 'keinStandard', gruppe }
  return { art: 'bereich', min: rule.min ?? null, max: rule.max ?? null, gruppe }
}
