/**
 * Gemeinsame Bausteine der Ernährung im Liquid-Glass-Schwarz der App
 * (src/styles/liquid-glass.css). Klassen statt Inline-Stile, damit Flächen,
 * Knöpfe und Schrift dieselben sind wie auf den anderen Seiten.
 */

/** Makro-Farben als iOS-Systemfarben: Datenfarben (Kugel, Monde, Punkte), sonst nichts Buntes. Wasser trägt den Akzent. */
/** Übersetzungsschlüssel der Makro-Namen. */
export const MACRO_NAME = { protein: 'nutr_protein', carbs: 'nutr_carbs', fat: 'nutr_fat' } as const

export const MACRO_COLORS = {
  kcal: 'var(--accent)',
  protein: '#30d158',
  carbs: '#bf5af2',
  fat: '#ff9f0a',
  water: 'var(--accent)',
} as const

/** Fläche einer Karte (ohne Weichzeichner — auf Schwarz zeigt er nichts). */
export const CARD = 'lg-surface lg-flat'

/** Zweite und dritte Schriftebene. */
export const DIM = 'text-[var(--lg-text-2)]'
export const MUTED = 'text-[var(--lg-text-3)]'

/** Fehlertext unter einem Feld. */
export const ERROR_TEXT = 'text-[13px] text-[var(--lg-bad-text)]'

/** Hinweisfläche (Bernstein) mit Symbol. */
export const WARN_BOX = 'flex gap-2 rounded-[14px] bg-[color-mix(in_srgb,var(--lg-warn)_14%,transparent)] p-3 text-[13px] leading-snug text-[var(--lg-text-2)]'

/** Auswahl-Chip (Mahlzeit, Menge, Einheit …): gewählt eine Flächenstufe heller mit Haarlinie, sonst Füllung. */
export const chip = (active: boolean) =>
  `min-h-9 rounded-lg px-3 text-[15px] font-medium transition-colors ${active
    ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)] shadow-[inset_0_0_0_1px_var(--lg-hair)]'
    : 'bg-[var(--lg-fill)] text-[var(--lg-text-2)]'}`


/** Farbe je Stufe der Nährwert-Punkte (gut · mittel · niedrig) — nie rot. */
export const SCORE_COLOR = {
  good: 'var(--lg-good-text)',
  mid: '#ffd60a',
  low: '#ff9f0a',
} as const
