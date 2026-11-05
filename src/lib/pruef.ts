/**
 * Prüfschalter fürs Gerät (Eingrenzen, was am iPhone bremst).
 *
 * Gesetzt über die Adresse (?licht=aus, ?messen=an, …) oder in den
 * Vorschau-Versionen über die Schalter im Profil (PruefSchalter.tsx). Die Wahl
 * bleibt auf dem Gerät gespeichert, weil eine Homescreen-App ohne die Zusätze
 * der Adresse startet und ihren eigenen Speicher hat.
 */
export type Pruef = 'messen' | 'licht' | 'effekte' | 'hintergrund' | 'schwappen' | 'blasen' | 'buehne'

export const PRUEF_SCHALTER: readonly { id: Pruef; text: string; wert: string }[] = [
  { id: 'messen', text: 'Messanzeige oben links', wert: 'an' },
  { id: 'blasen', text: 'Bläschen im Fläschchen aus', wert: 'aus' },
  { id: 'buehne', text: 'Alle Dauer-Animationen der Seite angehalten', wert: 'still' },
  { id: 'schwappen', text: 'Flüssigkeit steht still', wert: 'aus' },
  { id: 'licht', text: 'Hokus Licht aus', wert: 'aus' },
  { id: 'effekte', text: 'Schwere Design-Effekte aus', wert: 'aus' },
  { id: 'hintergrund', text: 'Seitenhintergrund der Designs aus', wert: 'aus' },
]

const SCHLUESSEL = 'tyd.pruef'

export function lesePruef(): Set<Pruef> {
  try {
    const roh = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? '[]') as unknown
    return new Set(Array.isArray(roh) ? roh.filter((x): x is Pruef => PRUEF_SCHALTER.some(s => s.id === x)) : [])
  } catch {
    return new Set()
  }
}

export function speicherePruef(an: Set<Pruef>): void {
  try {
    if (an.size) localStorage.setItem(SCHLUESSEL, JSON.stringify([...an]))
    else localStorage.removeItem(SCHLUESSEL)
  } catch { /* ohne Speicher gilt die Wahl bis zum Neuladen */ }
}

/** Schalter im Profil nur in Vorschau und Entwicklung, nie in der echten App. */
export const PRUEF_SICHTBAR = import.meta.env.DEV || import.meta.env.VITE_DEPLOY_ENV === 'preview'

/**
 * Was gerade gilt: die Zusätze der Adresse, in der Vorschau dazu die
 * gespeicherte Wahl (was die Adresse setzt, wird dort gespeichert). In der
 * echten App gilt nur die Adresse, für diesen einen Start: dort gibt es keinen
 * Schalter, mit dem man eine gespeicherte Wahl wieder abstellen könnte.
 */
export function aktivePruef(): Set<Pruef> {
  const an = PRUEF_SICHTBAR ? lesePruef() : new Set<Pruef>()
  try {
    const q = new URLSearchParams(location.search)
    let neu = false
    for (const s of PRUEF_SCHALTER) if (q.get(s.id) === s.wert && !an.has(s.id)) { an.add(s.id); neu = true }
    if (neu && PRUEF_SICHTBAR) speicherePruef(an)
  } catch { /* ohne Adresse nichts zu tun */ }
  return an
}
