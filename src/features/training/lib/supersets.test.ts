import { describe, expect, it } from 'vitest'
import { continuesSuperset, dissolveLoneSupersets, toggleSupersetAt } from './supersets'

const list = (...groups: Array<number | null>) => groups.map((supersetGroup, i) => ({ exerciseId: String.fromCharCode(97 + i), supersetGroup }))
const groups = (items: Array<{ supersetGroup?: number | null }>) => items.map(ex => ex.supersetGroup ?? null)

describe('toggleSupersetAt', () => {
  it('verknuepft zwei Nachbarn mit einer neuen Gruppe und loest sie wieder', () => {
    const linked = toggleSupersetAt(list(null, null, null), 0)
    expect(groups(linked)).toEqual([1, 1, null])
    expect(groups(toggleSupersetAt(linked, 0))).toEqual([null, null, null])
  })

  it('haengt die naechste Uebung an eine bestehende Gruppe an und trennt die Kette ab dem Knopf', () => {
    const chain = toggleSupersetAt(toggleSupersetAt(list(null, null, null, null), 0), 1)
    expect(groups(chain)).toEqual([1, 1, 1, null])
    // Trennen in der Mitte: alles dahinter verliert die Gruppe, vorne bleibt sie — zu zweit
    expect(groups(toggleSupersetAt(chain, 1))).toEqual([1, 1, null, null])
    // Trennen am Anfang: nur eine Uebung bliebe vorn — die Gruppe loest sich vorn auf, hinten bleiben zwei
    const front = toggleSupersetAt(toggleSupersetAt(chain, 0), 1)
    expect(groups(front)).toEqual([null, 1, 1, null])
  })

  it('zieht beim Verknuepfen die naechste Uebung aus ihrer Gruppe und loest den Rest auf', () => {
    const two = list(1, 1, 2, 2)
    expect(groups(toggleSupersetAt(two, 1))).toEqual([1, 1, 1, null])
    // Nummer der Gruppe: die eigene, sonst die der naechsten, sonst neu (hoechste + 1)
    expect(groups(toggleSupersetAt(list(null, 3, 3), 0))).toEqual([3, 3, 3])
    expect(groups(toggleSupersetAt(list(5, 5, null, null), 2))).toEqual([5, 5, 6, 6])
  })

  it('tut nichts an der letzten Uebung ohne Verbindung und bei ungueltigem Index', () => {
    const items = list(null, null)
    expect(toggleSupersetAt(items, 1)).toBe(items)
    expect(toggleSupersetAt(items, 7)).toBe(items)
    expect(toggleSupersetAt([], 0)).toEqual([])
  })

  it('laesst Felder ausser der Gruppe unberuehrt', () => {
    const items = [{ exerciseId: 'a', restS: 90, supersetGroup: null }, { exerciseId: 'b', notes: 'x', supersetGroup: null }]
    const linked = toggleSupersetAt(items, 0)
    expect(linked[0]).toEqual({ exerciseId: 'a', restS: 90, supersetGroup: 1 })
    expect(linked[1]).toEqual({ exerciseId: 'b', notes: 'x', supersetGroup: 1 })
  })
})

describe('dissolveLoneSupersets und continuesSuperset', () => {
  it('loest Gruppen mit nur einer Uebung auf, auch wenn die Nummer weiter hinten noch einmal vorkommt', () => {
    expect(groups(dissolveLoneSupersets(list(1, null, 1, 2, 2)))).toEqual([null, null, null, 2, 2])
  })

  it('erkennt, ob die Runde nach der Uebung weitergeht', () => {
    const items = list(1, 1, null)
    expect(continuesSuperset(items, 0)).toBe(true)
    expect(continuesSuperset(items, 1)).toBe(false)
    expect(continuesSuperset(items, 2)).toBe(false)
    expect(continuesSuperset(items, 9)).toBe(false)
  })
})
