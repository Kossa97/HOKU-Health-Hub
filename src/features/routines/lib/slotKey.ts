/**
 * Der Name eines Platzes im Einnahmeplan.
 *
 * Jede entschiedene Einnahme traegt ihn in `dose_logs.routine_slot_key`. Auf
 * der Spalte liegt ein Unique-Index, und `confirm_intake_group` upsertet
 * darauf -- der Schluessel beantwortet also genau eine Frage: *ist das
 * derselbe Termin wie der, den ich schon habe?*
 *
 * Er traegt die **Wanduhr**, nicht den Zeitpunkt:
 *
 *     <cycle-uuid>@2026-09-22T08:00
 *
 * Vorher stand dort ein `toISOString()`, und der wurde aus der Zeitzone des
 * Geraets berechnet. Damit hing die Identitaet einer Einnahme daran, wo das
 * Telefon gerade steht: "Dienstag 08:00" heisst in Berlin `06:00Z`, in Tokio
 * `23:00Z` am Vortag. Wer verreist, bekam denselben Platz unter zwei Namen --
 * der Dienstag stand wieder offen da, und die bestaetigte Zeile liess sich
 * nicht einmal mehr wieder oeffnen, weil sie in keiner Tagesplanung mehr
 * vorkam.
 *
 * Die Wanduhr reist mit. Dienstagmorgen bleibt Dienstagmorgen, egal wo man
 * landet; nur der absolute Zeitpunkt verschiebt sich, und der steht ohnehin
 * getrennt in `logged_at` und in `scheduledAt`.
 *
 * Zwei Eigenschaften traegt das Format bewusst:
 *
 * - **Feste Breite.** `YYYY-MM-DDTHH:MM` ist immer 16 Zeichen, also ist der
 *   Zeitteil lexikografisch chronologisch. Darauf beruht `slotKeyRange.ts`,
 *   das Slots ueber Bereichsvergleiche sucht statt sie aufzuzaehlen.
 * - **Die geplante Minute, nicht die aufgeloeste.** An der Zeitumstellung
 *   gibt es lokale Zeiten, die nicht existieren: 02:30 am Tag der Umstellung
 *   landet als Zeitpunkt auf 03:30. Wuerde der Schluessel die aufgeloeste
 *   Uhrzeit tragen, fielen ein geplanter 02:30-Slot und ein geplanter
 *   03:30-Slot auf denselben Namen -- der Unique-Index machte daraus eine
 *   Zeile, und eine der beiden Einnahmen waere verschwunden.
 */

import { localDateTimeKey } from '../../../lib/planTimeline'

/** Trennt die Zyklus-id vom Zeitteil. Eine UUID enthaelt kein `@`. */
const TRENNER = '@'

/** `YYYY-MM-DDTHH:MM` -- die feste Breite, auf der die Bereichssuche beruht. */
const ZEITTEIL = /^\d{4}-\d{2}-\d{2}T[0-2]\d:[0-5]\d$/

function zweistellig(wert: number): string {
  return String(wert).padStart(2, '0')
}

/**
 * Der Schluessel eines geplanten Slots.
 *
 * `localDate` ist der Tag im Plan (`YYYY-MM-DD`), `minutes` die geplante
 * Minute dieses Tages (0 bis 1439) -- beides aus der Planung, nicht aus einem
 * Zeitpunkt zurueckgerechnet.
 */
export function slotSchluessel(cycleId: string, localDate: string, minutes: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    throw new Error(`Slot-Schluessel braucht ein lokales Datum: ${localDate}`)
  }
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1439) {
    throw new Error(`Slot-Schluessel braucht eine Minute des Tages: ${minutes}`)
  }
  return `${cycleId}${TRENNER}${localDate}T${zweistellig(Math.floor(minutes / 60))}:${zweistellig(minutes % 60)}`
}

/**
 * Der Schluessel zu einem Zeitpunkt -- fuer alles ohne geplanten Slot.
 *
 * „Bei Bedarf" hat keinen Platz im Plan; dort ist der Zeitpunkt der Einnahme
 * selbst der Platz. Er wird in die uebergebene Zeitzone gelesen, damit auch
 * hier die Wanduhr im Schluessel steht.
 */
export function slotSchluesselFuerZeitpunkt(cycleId: string, instant: Date | string, timeZone: string): string {
  const wanduhr = localDateTimeKey(instant instanceof Date ? instant : new Date(instant), timeZone)
  const localDate = wanduhr.slice(0, 10)
  const minutes = Number(wanduhr.slice(11, 13)) * 60 + Number(wanduhr.slice(14, 16))
  return slotSchluessel(cycleId, localDate, minutes)
}

/**
 * Die untere bzw. obere Grenze eines Tagesbereichs.
 *
 * `slotKeyRange.ts` sucht Slots ueber `>= von` und `< bis`. Beide Grenzen
 * tragen denselben Zyklus-Praefix, also kann kein fremder Zyklus
 * hineinfallen: ein anderer Schluessel unterscheidet sich schon im Praefix
 * und liegt damit ganz ausserhalb.
 */
export function slotSchluesselGrenze(cycleId: string, localDate: string): string {
  return slotSchluessel(cycleId, localDate, 0)
}

/**
 * Traegt der Schluessel diesen Zyklus und einen gueltigen Zeitteil?
 *
 * Absichtlich keine Pruefung gegen einen erwarteten Zeitpunkt: wer unterwegs
 * bestaetigt hat, traegt eine Wanduhr, die zur Planung gehoert und nicht zur
 * Uhr im aktuellen Aufenthaltsort. Was hier zaehlt, ist dass der Schluessel
 * nicht erfunden ist -- ob er einen offenen Platz trifft, entscheidet die
 * Datenbank beim Upsert.
 */
export function istSlotSchluessel(schluessel: string | null | undefined, cycleId: string): schluessel is string {
  if (!schluessel || !cycleId) return false
  const praefix = `${cycleId}${TRENNER}`
  return schluessel.startsWith(praefix) && ZEITTEIL.test(schluessel.slice(praefix.length))
}

/**
 * Der Tag im Plan, zu dem ein Schluessel gehoert (`YYYY-MM-DD`), oder `null`
 * ohne (gueltigen) Schluessel. Danach sortiert der Kalender: die Einnahme vom
 * Donnerstagabend, nach Mitternacht bestaetigt, gehoert zum Donnerstag —
 * genommen wurde sie trotzdem am Freitag (`logged_at`).
 */
export function planTagAusSchluessel(schluessel: string | null | undefined): string | null {
  if (!schluessel) return null
  const zeit = schluessel.slice(schluessel.lastIndexOf(TRENNER) + 1)
  return schluessel.includes(TRENNER) && ZEITTEIL.test(zeit) ? zeit.slice(0, 10) : null
}
