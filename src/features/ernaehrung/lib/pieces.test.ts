import { describe, expect, it } from 'vitest'
import { countFor, pieceByName, pieceFor } from './pieces'

const food = (name: string, extra: Partial<Parameters<typeof pieceFor>[0]> = {}) =>
  ({ name, unit: 'g' as const, serving: null, recipe: null, ...extra })

describe('pieceByName', () => {
  it('erkennt zählbare Lebensmittel auf Deutsch und Englisch', () => {
    expect(pieceByName('Hühnerei, gekocht', 'g')).toEqual({ kind: 'piece', grams: 55, label: null })
    expect(pieceByName('Bio-Eier', 'g')?.kind).toBe('piece')
    expect(pieceByName('Egg, whole, raw', 'g')?.grams).toBe(55)
    expect(pieceByName('Apfel, roh', 'g')?.grams).toBe(180)
    expect(pieceByName('Banane', 'g')?.grams).toBe(120)
    expect(pieceByName('Vollkornbrot', 'g')).toEqual({ kind: 'slice', grams: 45, label: null })
    expect(pieceByName('Knäckebrot Roggen', 'g')?.grams).toBe(10)
    expect(pieceByName('Toast', 'g')?.grams).toBe(25)
    expect(pieceByName('Brötchen', 'g')?.kind).toBe('piece')
  })

  it('Wortteile und Zusammengesetztes zählen nicht', () => {
    for (const name of ['Eis Vanille', 'Eiweißpulver', 'Eiernudeln', 'Apfelsaft', 'Apfelmus', 'Joghurt mit Apfel', 'Eiersalat', 'Haferflocken', 'Bananenchips'])
      expect(pieceByName(name, 'g'), name).toBeNull()
  })

  it('Getränke: Tasse für Kaffee und Tee, sonst Glas', () => {
    expect(pieceByName('Kaffee schwarz', 'ml')).toEqual({ kind: 'cup', grams: 200, label: null })
    expect(pieceByName('Espresso', 'ml')?.grams).toBe(30)
    expect(pieceByName('Vollmilch 3,5 %', 'ml')).toEqual({ kind: 'glass', grams: 200, label: null })
    expect(pieceByName('Mineralwasser', 'ml')?.kind).toBe('glass')
    expect(pieceByName('Orange juice', 'ml')?.kind).toBe('glass')
  })

  it('Öl, Sahne, Soßen in ml und Verarbeitetes zählen nicht', () => {
    for (const name of ['Olivenöl', 'Schlagsahne', 'Sojasauce', 'Ahornsirup']) expect(pieceByName(name, 'ml'), name).toBeNull()
    for (const name of ['Tomaten Ketchup', 'Tomaten passiert', 'Apfel-Zimt Porridge', 'Tomatenmark']) expect(pieceByName(name, 'g'), name).toBeNull()
  })
})

describe('pieceFor', () => {
  it('Portion mit Namen aus den Produktdaten geht vor', () => {
    expect(pieceFor(food('Proteinriegel', { serving: { amount: 45, label: '1 Riegel' } }))).toEqual({ kind: 'serving', grams: 45, label: '1 Riegel' })
    expect(pieceFor(food('Freilandeier', { serving: { amount: 60, label: '1 Ei' } }))?.grams).toBe(60)
  })

  it('eine Portion, die nur eine Menge nennt, ist kein Stück', () => {
    expect(pieceFor(food('Haferflocken', { serving: { amount: 40, label: '40 g' } }))).toBeNull()
    expect(pieceFor(food('Hühnerei', { serving: { amount: 100, label: '100 g' } }))?.grams).toBe(55)
  })

  it('Gerichte zählen in Portionen, nicht in Stück', () => {
    expect(pieceFor(food('Rührei mit Brot', { recipe: { ingredients: [], portions: 1 } as never }))).toBeNull()
  })
})

describe('countFor', () => {
  it('runde Anzahl auf halbe Stücke, sonst null', () => {
    expect(countFor(110, 55)).toBe(2)
    expect(countFor(82.5, 55)).toBe(1.5)
    expect(countFor(100, 55)).toBeNull()
    expect(countFor(20, 55)).toBeNull()
  })
})
