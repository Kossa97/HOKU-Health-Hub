import { useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import {
  getActiveEnergy, getBloodPressure, getOxygenSaturation, getRespiratoryRate, getRestingHeartRate,
  getSleep, getStepsByDay, isIOS, isNative,
} from '../../../lib/health'
import { aggregateHealthDaily, localDay, type HealthDailyRow } from '../lib/healthDaily'
import { loadHealthStoreConsent, syncWindow, upsertHealthDaily, type HealthDailyPatch } from '../services/healthStore'

/** Im Vordergrund hoechstens alle 6 h ein neuer Lauf. */
export const HEALTH_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000
const CHECK_EVERY_MS = 15 * 60 * 1000

const standKey = (userId: string) => `hoku.healthDaily.last.${userId}`

/**
 * Letzter abgeglichener Tag. Gilt nur fuer die Einwilligung, unter der er
 * entstand — nach Widerruf und neuer Einwilligung wieder 30 Tage.
 */
function readStand(userId: string, consent: string): string | null {
  try {
    const raw = localStorage.getItem(standKey(userId))
    const stand = raw ? JSON.parse(raw) as { day?: unknown; consent?: unknown } : null
    return stand && stand.consent === consent && typeof stand.day === 'string' ? stand.day : null
  } catch {
    return null
  }
}

function writeStand(userId: string, day: string, consent: string) {
  try { localStorage.setItem(standKey(userId), JSON.stringify({ day, consent })) } catch { /* kein Speicher */ }
}

type MetricColumn = Exclude<keyof HealthDailyRow, 'day'>

/**
 * Nur Kennzahlen mit Wert. Ein fehlender Wert ist kein Beleg fuer „keiner": iOS
 * liefert bei verweigertem Lesen [], und ein neues Geraet liest 30 Tage neu — NULL
 * ueberschriebe gespeicherte Werte. Bewusst in Kauf genommen: ein an der Quelle
 * geloeschter Wert bleibt hier stehen.
 */
function withoutNulls(row: HealthDailyRow): HealthDailyPatch {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null)) as HealthDailyPatch
}

// Modulweit: das Layout kann neu eingehaengt werden, der App-Start bleibt einer.
// Gesetzt erst nach einem fertigen Lauf: ein Netzfehler sperrt keine 6 h.
const lastRunAt = new Map<string, number>()
const running = new Set<string>()

/**
 * Ein Abgleich: Tageswerte aus Apple Health / Health Connect lesen, verdichten
 * und in `health_daily` schreiben. Nur nativ und nur mit Einwilligung — die
 * wird vor dem Lesen und noch einmal vor dem Schreiben frisch geladen (Widerruf
 * auf einem anderen Geraet). Fragt nie nach Berechtigungen; das tut nur das
 * Einwilligungs-Sheet. `force` uebergeht die 6-h-Sperre (direkt nach der Einwilligung).
 * Liefert true, wenn geschrieben wurde.
 */
export async function syncHealthDaily(userId: string, { force = false } = {}): Promise<boolean> {
  if (!isNative || running.has(userId)) return false
  const last = lastRunAt.get(userId)
  if (!force && last !== undefined && Date.now() - last < HEALTH_SYNC_INTERVAL_MS) return false
  running.add(userId)
  try {
    const consent = await loadHealthStoreConsent(userId)
    if (!consent) { lastRunAt.set(userId, Date.now()); return false }

    const window = syncWindow(readStand(userId, consent), localDay(new Date()))
    const [y, m, d] = window.from.split('-').map(Number)
    // Ab Mitternacht des Vortags lesen: Schlaf, der dort nach 18 Uhr endet, zaehlt zu `from`.
    const options = { startDate: new Date(y, m - 1, d - 1), endDate: new Date() }
    // Scheitert eine Abfrage (etwa eine fehlende Berechtigung), liefert sie keine Werte;
    // ihre Spalten fehlen dann im Upsert, und der Stand bleibt stehen.
    const failed = new Set<MetricColumn>()
    const read = <T,>(columns: MetricColumn[], query: Promise<T[]>) =>
      query.catch(() => { columns.forEach(c => failed.add(c)); return [] as T[] })
    const [steps, restingHr, sleep, activeEnergy, spo2, respRate, bloodPressure] = await Promise.all([
      read(['steps'], getStepsByDay(options)),
      read(['resting_hr'], getRestingHeartRate(options)),
      read(['sleep_min'], getSleep(options)),
      read(['active_kcal'], getActiveEnergy(options)),
      read(['spo2_pct'], getOxygenSaturation(options)),
      read(['resp_rate'], getRespiratoryRate(options)),
      read(['bp_sys', 'bp_dia'], getBloodPressure(options)),
    ])
    const rows = aggregateHealthDaily({ steps, restingHr, sleep, activeEnergy, spo2, respRate, bloodPressure })
      .filter(row => row.day >= window.from && row.day <= window.to)
      .map(withoutNulls)
      .filter(row => Object.keys(row).length > 1)

    if ((await loadHealthStoreConsent(userId)) !== consent) return false
    await upsertHealthDaily(userId, rows, isIOS ? 'healthkit' : 'health_connect')
    // Mit Luecken bleibt der Stand stehen: der naechste Lauf liest diese Tage noch einmal.
    if (!failed.size) writeStand(userId, window.to, consent)
    lastRunAt.set(userId, Date.now())
    return true
  } finally {
    running.delete(userId)
  }
}

/** Im Layout eingehaengt: Abgleich beim App-Start und danach alle 6 h im Vordergrund. */
export function useHealthDailySync() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  useEffect(() => {
    if (!isNative || !userId) return
    const run = () => { syncHealthDaily(userId).catch(() => {}) }
    const whenVisible = () => { if (document.visibilityState === 'visible') run() }
    run()
    document.addEventListener('visibilitychange', whenVisible)
    const timer = window.setInterval(whenVisible, CHECK_EVERY_MS)
    return () => {
      document.removeEventListener('visibilitychange', whenVisible)
      window.clearInterval(timer)
    }
  }, [userId])
}
