import { describe, expect, it } from 'vitest';
import { aggregateHealthDaily, localDay } from './healthDaily';
import { spo2Percent } from '../../../lib/health';

const empty = {
  steps: [],
  restingHr: [],
  sleep: [],
  activeEnergy: [],
  spo2: [],
  respRate: [],
  bloodPressure: [],
};

// Alle Zeitpunkte in lokaler Zeit gebaut, damit die Tests von der Zeitzone der Maschine unabhaengig sind.
const local = (d: number, h = 0, min = 0) => new Date(2026, 9, d, h, min);

describe('localDay', () => {
  it('gibt yyyy-MM-dd in lokaler Zeit zurueck', () => {
    expect(localDay(local(31, 0, 30))).toBe('2026-10-31');
    expect(localDay(local(31, 23, 59))).toBe('2026-10-31');
  });
});

describe('spo2Percent', () => {
  it('rechnet den iOS-Bruch in Prozent um und laesst Prozentwerte stehen', () => {
    expect(spo2Percent(0.97)).toBe(97);
    expect(spo2Percent(97)).toBe(97);
  });
});

describe('aggregateHealthDaily', () => {
  it('bucht Schlaf 23:30-07:00 auf den Folgetag mit 450 min', () => {
    const rows = aggregateHealthDaily({
      ...empty,
      sleep: [{ startDate: local(30, 23, 30), endDate: local(31, 7, 0), durationHours: 7.5, state: 'Asleep' }],
    });
    expect(rows).toEqual([
      { day: '2026-10-31', steps: null, resting_hr: null, sleep_min: 450, active_kcal: null, spo2_pct: null, resp_rate: null, bp_sys: null, bp_dia: null },
    ]);
  });

  it('zaehlt InBed nicht', () => {
    const rows = aggregateHealthDaily({
      ...empty,
      sleep: [
        { startDate: local(30, 23, 0), endDate: local(31, 7, 0), durationHours: 8, state: 'InBed' },
        { startDate: local(30, 23, 30), endDate: local(31, 6, 30), durationHours: 7, state: 'Asleep' },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].sleep_min).toBe(420);
  });

  it('liefert fuer nur InBed gar keinen Tag', () => {
    const rows = aggregateHealthDaily({
      ...empty,
      sleep: [{ startDate: local(30, 23, 0), endDate: local(31, 7, 0), durationHours: 8, state: 'InBed' }],
    });
    expect(rows).toEqual([]);
  });

  it('mittelt zwei SpO2-Werte 96 und 98 zu 97', () => {
    const rows = aggregateHealthDaily({
      ...empty,
      spo2: [
        { date: local(31, 8), value: 96 },
        { date: local(31, 22), value: 98 },
      ],
    });
    expect(rows[0].spo2_pct).toBe(97);
  });

  it('summiert Schritte mehrerer Proben am selben Tag', () => {
    const rows = aggregateHealthDaily({
      ...empty,
      steps: [
        { start: local(31, 8), count: 3000 },
        { start: local(31, 17), count: 4500.4 },
      ],
    });
    expect(rows[0].steps).toBe(7500);
  });

  it('summiert aktive kcal gerundet', () => {
    const rows = aggregateHealthDaily({
      ...empty,
      activeEnergy: [
        { start: local(31, 8), kcal: 120.4 },
        { start: local(31, 18), kcal: 200.4 },
      ],
    });
    expect(rows[0].active_kcal).toBe(321);
  });

  it('ein Tag nur mit Blutdruck hat sonst null', () => {
    const rows = aggregateHealthDaily({
      ...empty,
      bloodPressure: [
        { date: local(31, 8), systolic: 120, diastolic: 80 },
        { date: local(31, 20), systolic: 125, diastolic: 83 },
      ],
    });
    expect(rows).toEqual([
      { day: '2026-10-31', steps: null, resting_hr: null, sleep_min: null, active_kcal: null, spo2_pct: null, resp_rate: null, bp_sys: 123, bp_dia: 82 },
    ]);
  });

  it('mittelt Ruhepuls und Atemfrequenz mit einer Nachkommastelle', () => {
    const rows = aggregateHealthDaily({
      ...empty,
      restingHr: [
        { bpm: 55, date: local(31, 6) },
        { bpm: 58, date: local(31, 7) },
        { bpm: 58, date: local(31, 8) },
      ],
      respRate: [
        { date: local(31, 3), value: 14 },
        { date: local(31, 4), value: 15 },
      ],
    });
    expect(rows[0].resting_hr).toBe(57);
    expect(rows[0].resp_rate).toBe(14.5);
  });

  it('ordnet eine Messung um 00:30 lokal dem lokalen Tag zu', () => {
    const rows = aggregateHealthDaily({
      ...empty,
      spo2: [{ date: local(31, 0, 30), value: 95 }],
    });
    expect(rows.map(r => r.day)).toEqual(['2026-10-31']);
  });

  it('sortiert aufsteigend nach Tag', () => {
    const rows = aggregateHealthDaily({
      ...empty,
      steps: [
        { start: local(31, 9), count: 10 },
        { start: local(29, 9), count: 20 },
        { start: local(30, 9), count: 30 },
      ],
    });
    expect(rows.map(r => r.day)).toEqual(['2026-10-29', '2026-10-30', '2026-10-31']);
  });
});
