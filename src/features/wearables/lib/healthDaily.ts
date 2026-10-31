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
  steps: { start: Date; count: number }[];
  restingHr: HealthHeartRate[];
  sleep: HealthSleep[];
  activeEnergy: { start: Date; kcal: number }[];
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

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const mean = (values: number[]) => sum(values) / values.length;

/**
 * Verdichtet Rohproben zu einer Zeile je lokalem Tag. Schritte und kcal werden
 * summiert, Ruhepuls, SpO2, Atemfrequenz und Blutdruck gemittelt. Schlaf ist die
 * Summe der Abschnitte ausser `InBed`, gebucht auf den Tag des Abschnittsendes.
 * Tage ohne jeden Wert fehlen; Ergebnis aufsteigend nach Tag.
 */
export function aggregateHealthDaily(input: HealthDailyInput): HealthDailyRow[] {
  const steps = group(input.steps.map(s => ({ day: localDay(s.start), value: s.count })));
  const restingHr = group(input.restingHr.map(s => ({ day: localDay(s.date), value: s.bpm })));
  const sleep = group(
    input.sleep
      .filter(s => s.state !== 'InBed')
      .map(s => ({ day: localDay(s.endDate), value: s.durationHours * 60 })),
  );
  const kcal = group(input.activeEnergy.map(s => ({ day: localDay(s.start), value: s.kcal })));
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
