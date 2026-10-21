/**
 * Zählbare Mengen: Eier zählt man, Brot in Scheiben, Getränke in Gläsern. Für solche
 * Lebensmittel wählt man die Anzahl statt Gramm; gespeichert wird weiter in g/ml.
 * Ohne React und ohne Netz.
 */
import type { Food, FoodUnit } from './nutrition'

export type PieceKind = 'piece' | 'slice' | 'glass' | 'cup' | 'serving'

export interface Piece {
  kind: PieceKind
  /** Gewicht bzw. Menge eines Stücks in g/ml. */
  grams: number
  /** Nur bei einer Portion aus den Produktdaten, etwa „1 Riegel". */
  label: string | null
}

const L = 'a-zäöüß'
/** Ganzes Wort (Bindestrich und Komma trennen), damit „Eis“, „Eiweiß“ oder „Apfelsaft“ nicht als Ei bzw. Apfel gelten. */
const word = (s: string) => new RegExp(`(?:^|[^${L}])(?:${s})(?=$|[^${L}])`)

/** Zusammengesetztes ist kein Stück, auch wenn ein Stück im Namen steht („Joghurt mit Apfel“). */
const MIXED = /saft|mus\b|salat|nudel|likör|pulver|aufstrich|kuchen|chips|joghurt|jogurt|quark|marmelade|konfitüre|smoothie|juice|sauce|soße|sosse|suppe|chutney|riegel|müsli|muesli|granola|crumble|pie\b|cake|jam\b|yog(h)?urt|ketchup|porridge|passiert|püree|puree|mark\b|paste|pesto|getrocknet|dried|konserve|kompott/

/** Übliche Größen, essbarer Anteil, gerundet (Ei: Gewichtsklasse M ohne Schale). */
const TABLE: { re: RegExp; kind: PieceKind; grams: number }[] = [
  { re: word('knäckebrot|knäcke|crispbread'), kind: 'slice', grams: 10 },
  { re: word('reiswaffeln?|rice cakes?'), kind: 'piece', grams: 8 },
  { re: word('toast|toastbrot|sandwichtoast|toast bread'), kind: 'slice', grams: 25 },
  { re: word('brötchen|semmeln?|schrippen?|bread rolls?'), kind: 'piece', grams: 60 },
  { re: word(`[${L}]*brot|bread`), kind: 'slice', grams: 45 },
  { re: word('croissants?'), kind: 'piece', grams: 55 },
  { re: word('eier|ei|hühnereier|hühnerei|freilandeier|eggs?'), kind: 'piece', grams: 55 },
  { re: word('äpfel|apfel|apples?'), kind: 'piece', grams: 180 },
  { re: word('bananen?|bananas?'), kind: 'piece', grams: 120 },
  { re: word('orangen?|apfelsinen?|oranges?'), kind: 'piece', grams: 150 },
  { re: word('mandarinen?|clementinen?|mandarins?|clementines?|tangerines?'), kind: 'piece', grams: 60 },
  { re: word('kiwis?'), kind: 'piece', grams: 75 },
  { re: word('birnen?|pears?'), kind: 'piece', grams: 170 },
  { re: word('pfirsiche?|nektarinen?|peach(?:es)?|nectarines?'), kind: 'piece', grams: 130 },
  { re: word('avocados?'), kind: 'piece', grams: 140 },
  { re: word('tomaten?|tomato(?:es)?'), kind: 'piece', grams: 85 },
]

/** Nur Getränke: Öl, Sahne oder Soße in ml zählt man nicht in Gläsern. */
const DRINKS: { re: RegExp; kind: PieceKind; grams: number }[] = [
  { re: word('espresso'), kind: 'cup', grams: 30 },
  { re: word('kaffee|cappuccino|latte|latte macchiato|tee|kakao|coffee|tea|cocoa'), kind: 'cup', grams: 200 },
  { re: new RegExp(`(?:^|[^${L}])[${L}]*(?:wasser|milch|saft|schorle|limonade|limo|cola|bier|wein|sprudel|drink)(?=$|[^${L}])|${word('water|milk|juice|soda|beer|wine|lemonade|kefir|ayran|buttermilch|eistee|iced tea').source}`), kind: 'glass', grams: 200 },
]

/** Nach dem Namen (ohne Produktdaten): Tabelle, bei Getränken Tasse oder Glas. */
export function pieceByName(name: string, unit: FoodUnit): Piece | null {
  const s = name.toLowerCase()
  if (unit === 'ml') {
    const hit = DRINKS.find(d => d.re.test(s))
    return hit ? { kind: hit.kind, grams: hit.grams, label: null } : null
  }
  if (MIXED.test(s)) return null
  const hit = TABLE.find(d => d.re.test(s))
  return hit ? { kind: hit.kind, grams: hit.grams, label: null } : null
}

/** Eine Portion, die nur eine Menge nennt („100 g“), ist kein Stück. */
const ONLY_WEIGHT = /^\s*[\d.,]+\s*(g|ml|gramm|grams?)\s*$/i

/**
 * Zählbar? Eine Portion aus den Produktdaten mit Namen („1 Riegel“) geht vor —
 * sie gilt für genau dieses Produkt; sonst die Tabelle. Gerichte zählen in Portionen (eigener Weg).
 */
export function pieceFor(food: Pick<Food, 'name' | 'unit' | 'serving' | 'recipe'>): Piece | null {
  if (food.recipe) return null
  const s = food.serving
  if (s && s.amount > 0 && s.label && !ONLY_WEIGHT.test(s.label)) return { kind: 'serving', grams: s.amount, label: s.label }
  return pieceByName(food.name, food.unit)
}

/** Auf halbe Stücke gerundet; feiner wird in g/ml gewählt. */
export const halves = (n: number) => Math.round(n * 2) / 2

/** Anzahl zu einer Menge, auf halbe Stücke — oder null, wenn die Menge keine runde Zahl Stücke ist (±2 %). */
export function countFor(amount: number, grams: number): number | null {
  if (!(amount > 0) || !(grams > 0)) return null
  const n = halves(amount / grams)
  return n >= 0.5 && Math.abs(n * grams - amount) <= amount * 0.02 ? n : null
}

/** „1 Riegel“ → „Riegel“: für „2 × Riegel“. */
export const servingNoun = (label: string) => label.replace(/^\s*1\s*(?:x|×)?\s*/i, '')
