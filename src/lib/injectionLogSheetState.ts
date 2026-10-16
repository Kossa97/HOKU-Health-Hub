import { format, parseISO } from 'date-fns'

export const INJECTION_UNIT_OPTIONS = ['mcg', 'mg', 'IU', 'ml', 'nmol']
export const INJECTION_METHOD_OPTIONS = ['Subkutan', 'Intramuskulär']

/** ISO-Zeitpunkt -> Wert fuer <input type="datetime-local"> (Ortszeit, Minuten). */
export const toLocalDateTimeInput = (iso: string) => format(parseISO(iso), "yyyy-MM-dd'T'HH:mm")

export function replaceTimeInLocalDateTime(
  localDateTime: string,
  time: string,
): string {
  return `${localDateTime.slice(0, 10)}T${time}`
}

/**
 * Dosis aus einem Textfeld: leer -> null, sonst eine Dezimalzahl >= 0 mit
 * Punkt oder Komma („0,5“). Alles andere -> undefined (ungueltig). Kein
 * Number() auf der Roheingabe: das nimmt „0x10“ und „1e3“ und macht aus
 * „0,5“ NaN, das als null gespeichert wird.
 */
export function parseInjectionDose(value: string): number | null | undefined {
  const trimmed = value.trim().replace(',', '.')
  if (!trimmed) return null
  return /^\d+(\.\d+)?$|^\.\d+$/.test(trimmed) ? Number(trimmed) : undefined
}
