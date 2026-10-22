// Die Farben, die ein Eintrag tragen kann. Sie sind KEINE zufaellige Auswahl,
// sondern ein geschlossener Farbkreis um unsere eigenen Farben herum.
//
// Fuenf davon sind die Marke selbst, unveraendert aus index.css:
//   #f59e0b  --cat-amber      #10b981  --cat-emerald
//   #00ccf5  --accent         #8b5cf6  --cat-violet
//   #f43f5e  --cat-rose
//
// Die restlichen sieben fuellen die Luecken dazwischen: alle 30 Grad ein Ton,
// alle mit derselben Saettigung (70 %) und derselben Helligkeit (58 %). Dadurch
// treten sie hinter die Markenfarben zurueck, statt mit ihnen zu konkurrieren —
// und untereinander lesen sie sich als eine Familie statt als zwoelf Einzelfaelle.
//
// Sortiert nach Farbton, nicht nach Zufall: die Palette liest sich als Kreis.
export const STACK_ITEM_COLORS = [
  '#df6c49', // H 14  abgeleitet
  '#f59e0b', // H 38  --cat-amber
  '#cbdf49', // H 68  abgeleitet
  '#7ddf49', // H 99  abgeleitet
  '#49df5f', // H129  abgeleitet
  '#10b981', // H160  --cat-emerald
  '#00ccf5', // H190  --accent
  '#4976df', // H222  abgeleitet
  '#8b5cf6', // H258  --cat-violet
  '#c349df', // H289  abgeleitet
  '#df49ad', // H320  abgeleitet
  '#f43f5e', // H350  --cat-rose
]

export function getStackItemColor(index: number): string {
  if (index < 0) return '#64748b'
  return STACK_ITEM_COLORS[index % STACK_ITEM_COLORS.length]
}

export function getRandomStackItemColor(random: () => number = Math.random): string {
  const index = Math.min(STACK_ITEM_COLORS.length - 1, Math.floor(random() * STACK_ITEM_COLORS.length))
  return STACK_ITEM_COLORS[Math.max(0, index)]
}

export function getStableStackItemColor(id: string): string {
  let hash = 2166136261
  for (let index = 0; index < id.length; index += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 16777619)
  }
  return STACK_ITEM_COLORS[(hash >>> 0) % STACK_ITEM_COLORS.length]
}

/**
 * Die Systemfarben von iOS im dunklen Erscheinungsbild — dieselben zwoelf,
 * die Erinnerungen und Kalender zur Wahl stellen. Aufeinander abgestimmt
 * (gleiche Leuchtkraft auf Schwarz). Aus ihnen waehlt das Formular; die
 * Palette oben bleibt der Ersatz fuer Eintraege ohne eigene Farbe.
 */
export const SWATCH_COLORS = [
  { hex: '#ff453a', name: 'red' },
  { hex: '#ff9f0a', name: 'orange' },
  { hex: '#ffd60a', name: 'yellow' },
  { hex: '#30d158', name: 'green' },
  { hex: '#66d4cf', name: 'mint' },
  { hex: '#40c8e0', name: 'teal' },
  { hex: '#64d2ff', name: 'cyan' },
  { hex: '#0a84ff', name: 'blue' },
  { hex: '#5e5ce6', name: 'indigo' },
  { hex: '#bf5af2', name: 'purple' },
  { hex: '#ff375f', name: 'pink' },
  { hex: '#ac8e68', name: 'brown' },
] as const

/** Eine Vorbelegung fuers Formular — eine der Systemfarben, damit sie gewaehlt aussieht. */
export function getRandomSwatchColor(random: () => number = Math.random): string {
  const index = Math.min(SWATCH_COLORS.length - 1, Math.max(0, Math.floor(random() * SWATCH_COLORS.length)))
  return SWATCH_COLORS[index].hex
}
