import type { HealthBloodPressure, HealthHeartRate, HealthSample, HealthSleep } from '../../../lib/health';

/** Eine Zeile von `health_daily` (ohne user_id, source, updated_at). */
export interface HealthDailyRow {
  day: string;
  steps: number | null;
  resting_hr: number | null;
  sleep_min: number | null;
  active_kcal: number | null;
  spo2_pct: number | null;
  resp_rate: number | null;
  bp_sys: number | null;
  bp_dia: number | null;
}

export interface HealthDailyInput {
  steps: { start: Date; count: number; source?: string }[];
  restingHr: HealthHeartRate[];
  sleep: HealthSleep[];
  activeEnergy: { start: Date; kcal: number; source?: string }[];
  spo2: HealthSample[];
  respRate: HealthSample[];
  bloodPressure: HealthBloodPressure[];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `yyyy-MM-dd` in lokaler Zeit. */
export function localDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function group(values: { day: string; value: number }[]): Map<string, number[]> {
  const byDay = new Map<string, number[]>();
  for (const { day, value } of values) {
    if (!Number.isFinite(value)) continue;
    const list = byDay.get(day);
    if (list) list.push(value);
    else byDay.set(day, [value]);
  }
  return byDay;
}

const NIGHT_START_HOUR = 18;

/** Ein Schlafabschnitt gehoert zur Nacht: endet er ab 18:00, zaehlt er zum Folgetag. */
function sleepDay(end: Date): string {
  if (end.getHours() < NIGHT_START_HOUR) return localDay(end);
  return localDay(new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1));
}

/** Minuten der Vereinigung aller Intervalle (ueberlappende Quellen zaehlen einmal). */
function unionMinutes(intervals: { start: number; end: number }[]): number {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  let total = 0;
  let curStart = 0;
  let curEnd = 0;
  sorted.forEach((interval, i) => {
    if (i === 0 || interval.start > curEnd) {
      total += curEnd - curStart;
      curStart = interval.start;
      curEnd = interval.end;
    } else if (interval.end > curEnd) {
      curEnd = interval.end;
    }
  });
  total += curEnd - curStart;
  return total / 60000;
}

/**
 * Schlaf je Nacht-Tag. Abschnitte ausser `InBed`, vereinigt ueber alle Quellen.
 * Bekannte Grenze: Das iOS-Plugin meldet alles ausser InBed als "Asleep", Wachphasen
 * (Awake) werden also mitgezaehlt; das loest erst der Plugin-Wechsel (Spec Schritt 1b).
 */
function sleepByDay(sleep: HealthSleep[]): Map<string, number[]> {
  const byDay = new Map<string, { start: number; end: number }[]>();
  for (const s of sleep) {
    if (s.state === 'InBed') continue;
    const start = s.startDate.getTime();
    const end = s.endDate.getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const day = sleepDay(s.endDate);
    const list = byDay.get(day);
    if (list) list.push({ start, end });
    else byDay.set(day, [{ start, end }]);
  }
  const result = new Map<string, number[]>();
  for (const [day, intervals] of byDay) result.set(day, [unionMinutes(intervals)]);
  return result;
}

/** Je Tag nur die Quelle mit der hoechsten Tagessumme (Telefon und Uhr zaehlen dieselben Schritte). */
function bestSourceTotals(items: { day: string; source?: string; value: number }[]): Map<string, number[]> {
  const totals = new Map<string, Map<string, number>>();
  for (const { day, source, value } of items) {
    if (!Number.isFinite(value)) continue;
    const bySource = totals.get(day) ?? new Map<string, number>();
    const key = source ?? '';
    bySource.set(key, (bySource.get(key) ?? 0) + value);
    totals.set(day, bySource);
  }
  const result = new Map<string, number[]>();
  for (const [day, bySource] of totals) result.set(day, [Math.max(...bySource.values())]);
  return result;
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const mean = (values: number[]) => sum(values) / values.length;

/**
 * Verdichtet Rohproben zu einer Zeile je lokalem Tag. Schritte und kcal: Summe der
 * Quelle mit dem hoechsten Tageswert. Ruhepuls, SpO2, Atemfrequenz und Blutdruck
 * werden gemittelt. Schlaf: Vereinigung der Abschnitte ausser `InBed`, gebucht auf
 * den Tag des Aufwachens (Abschnitt endet ab 18:00 -> Folgetag).
 * Tage ohne jeden Wert fehlen; Ergebnis aufsteigend nach Tag.
 */
export function aggregateHealthDaily(input: HealthDailyInput): HealthDailyRow[] {
  const steps = bestSourceTotals(input.steps.map(s => ({ day: localDay(s.start), source: s.source, value: s.count })));
  const restingHr = group(input.restingHr.map(s => ({ day: localDay(s.date), value: s.bpm })));
  const sleep = sleepByDay(input.sleep);
  const kcal = bestSourceTotals(input.activeEnergy.map(s => ({ day: localDay(s.start), source: s.source, value: s.kcal })));
  const spo2 = group(input.spo2.map(s => ({ day: localDay(s.date), value: s.value })));
  const respRate = group(input.respRate.map(s => ({ day: localDay(s.date), value: s.value })));
  const bpSys = group(input.bloodPressure.map(s => ({ day: localDay(s.date), value: s.systolic })));
  const bpDia = group(input.bloodPressure.map(s => ({ day: localDay(s.date), value: s.diastolic })));

  const days = new Set<string>();
  for (const map of [steps, restingHr, sleep, kcal, spo2, respRate, bpSys, bpDia]) {
    for (const day of map.keys()) days.add(day);
  }

  const total = (map: Map<string, number[]>, day: string) => {
    const v = map.get(day);
    return v ? Math.round(sum(v)) : null;
  };
  const avg1 = (map: Map<string, number[]>, day: string) => {
    const v = map.get(day);
    return v ? round1(mean(v)) : null;
  };
  const avg0 = (map: Map<string, number[]>, day: string) => {
    const v = map.get(day);
    return v ? Math.round(mean(v)) : null;
  };

  return [...days].sort().map(day => ({
    day,
    steps: total(steps, day),
    resting_hr: avg1(restingHr, day),
    sleep_min: total(sleep, day),
    active_kcal: total(kcal, day),
    spo2_pct: avg1(spo2, day),
    resp_rate: avg1(respRate, day),
    bp_sys: avg0(bpSys, day),
    bp_dia: avg0(bpDia, day),
  }));
}
