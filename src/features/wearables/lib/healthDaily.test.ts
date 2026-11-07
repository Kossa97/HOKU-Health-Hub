import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

  it('bucht eine in Stufen zerlegte Nacht komplett auf den Aufwachtag (510 min)', () => {
    const seg = (a: Date, b: Date, h: number) => ({ startDate: a, endDate: b, durationHours: h, state: 'Asleep' });
    const rows = aggregateHealthDaily({
      ...empty,
      sleep: [
        seg(local(30, 22, 30), local(30, 23, 50), 80 / 60),
        seg(local(30, 23, 50), local(31, 3, 0), 190 / 60),
        seg(local(31, 3, 0), local(31, 7, 0), 4),
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].day).toBe('2026-10-31');
    expect(rows[0].sleep_min).toBe(510);
  });

  it('laesst ein Nickerchen 14:00-15:00 auf seinem eigenen Tag', () => {
    const rows = aggregateHealthDaily({
      ...empty,
      sleep: [{ startDate: local(31, 14, 0), endDate: local(31, 15, 0), durationHours: 1, state: 'Asleep' }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ day: '2026-10-31', sleep_min: 60 });
  });

  it('zaehlt identische Abschnitte zweier Quellen einmal (450 statt 900)', () => {
    const seg = (source: string) => ({ startDate: local(30, 23, 30), endDate: local(31, 7, 0), durationHours: 7.5, state: 'Asleep', source });
    const rows = aggregateHealthDaily({ ...empty, sleep: [seg('iPhone'), seg('Watch')] });
    expect(rows[0].sleep_min).toBe(450);
  });

  it('zaehlt teilweise ueberlappende Abschnitte nur einmal', () => {
    const rows = aggregateHealthDaily({
      ...empty,
      sleep: [
        { startDate: local(30, 23, 0), endDate: local(31, 3, 0), durationHours: 4, state: 'Asleep' },
        { startDate: local(31, 1, 0), endDate: local(31, 6, 0), durationHours: 5, state: 'Asleep' },
      ],
    });
    expect(rows[0].sleep_min).toBe(420);
  });

  it('nimmt bei Schritten nur die Quelle mit der hoechsten Tagessumme', () => {
    const rows = aggregateHealthDaily({
      ...empty,
      steps: [
        { start: local(31, 9), count: 5000, source: 'iPhone' },
        { start: local(31, 18), count: 3000, source: 'iPhone' },
        { start: local(31, 12), count: 7500, source: 'Watch' },
      ],
    });
    expect(rows[0].steps).toBe(8000);
  });

  it('nimmt bei aktiven kcal nur die Quelle mit der hoechsten Tagessumme', () => {
    const rows = aggregateHealthDaily({
      ...empty,
      activeEnergy: [
        { start: local(31, 9), kcal: 300, source: 'iPhone' },
        { start: local(31, 12), kcal: 450.4, source: 'Watch' },
        { start: local(31, 18), kcal: 100, source: 'Watch' },
      ],
    });
    expect(rows[0].active_kcal).toBe(550);
  });

  it('behandelt Proben ohne Quelle als eine Quelle (Summe)', () => {
    const rows = aggregateHealthDaily({
      ...empty,
      steps: [
        { start: local(31, 8), count: 1000 },
        { start: local(31, 9), count: 2000 },
      ],
    });
    expect(rows[0].steps).toBe(3000);
  });

  describe('Zeitumstellung (Europe/Berlin, Nacht auf 25.10.2026)', () => {
    const oldTz = process.env.TZ;
    beforeAll(() => { process.env.TZ = 'Europe/Berlin'; });
    afterAll(() => {
      if (oldTz === undefined) delete process.env.TZ;
      else process.env.TZ = oldTz;
    });

    it('bucht die Nacht der Zeitumstellung auf den Aufwachtag mit echten 510 min', () => {
      // 23:30 CEST (21:30Z) bis 07:00 MEZ (06:00Z): 8,5 Stunden.
      const start = new Date('2026-10-24T21:30:00Z');
      const end = new Date('2026-10-25T06:00:00Z');
      expect(end.getHours()).toBe(7);
      const rows = aggregateHealthDaily({
        ...empty,
        sleep: [{ startDate: start, endDate: end, durationHours: 8.5, state: 'Asleep' }],
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ day: '2026-10-25', sleep_min: 510 });
    });
  });
});
