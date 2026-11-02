import { useSyncExternalStore } from 'react'

/**
 * Kleine app-weite Ablage (Kopieren hier, Einfuegen dort), fuer die Sitzung
 * im sessionStorage: uebersteht Neuladen, nicht das Schliessen des Tabs.
 * Eintraege werden beim Laden geprueft und beim Herausgeben geklont.
 */
export function createClipboard<T>(key: string, isValid: (value: unknown) => value is T, clone: (value: T) => T, maxItems = 50) {
  const load = (): T[] => {
    try {
      const raw = JSON.parse(sessionStorage.getItem(key) ?? '[]') as unknown
      return Array.isArray(raw) ? raw.filter(isValid).slice(0, maxItems) : []
    } catch {
      return []
    }
  }

  let items: T[] = load()
  const listeners = new Set<() => void>()

  const set = (next: T[]) => {
    items = next
    try { sessionStorage.setItem(key, JSON.stringify(next)) } catch { /* ohne Speicher: nur im Speicher */ }
    listeners.forEach(fn => fn())
  }
  const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }

  return {
    copy: (values: readonly T[]) => set(values.slice(0, maxItems).map(clone)),
    /** Frische Kopien zum Einfuegen — die Ablage bleibt, man kann mehrfach einfuegen. */
    copies: () => items.map(clone),
    clear: () => set([]),
    useItems: (): readonly T[] => useSyncExternalStore(subscribe, () => items, () => items),
  }
}
