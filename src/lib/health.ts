import { Capacitor } from '@capacitor/core';
import { CapacitorHealthkit } from '@perfood/capacitor-healthkit';
import type { ActivityData, OtherData, SleepData } from '@perfood/capacitor-healthkit';
import { HealthConnect } from 'capacitor-health-connect';
import type { Record as HealthConnectRecord, RecordType } from 'capacitor-health-connect';
import { localDay } from '../features/wearables/lib/healthDaily';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_HEALTH_CONNECT_PAGES = 50;

// 'activity' gibt in @perfood/capacitor-healthkit Schlaf UND Workouts frei.
// 'calories' ist bei diesem Plugin die aktive Energie (activeEnergyBurned).
const IOS_READ_PERMISSIONS = [
  'weight', 'steps', 'activity', 'heartRate', 'restingHeartRate',
  'calories', 'oxygenSaturation', 'respiratoryRate', 'bloodPressureSystolic', 'bloodPressureDiastolic',
];
// 'ExerciseSession' fehlt mit Absicht: capacitor-health-connect 0.7 kann solche
// Eintraege nicht lesen (siehe getWorkouts). Jede Health-Connect-Berechtigung
// muss zusaetzlich im AndroidManifest stehen, sonst wird sie nie erteilt.
// 'Weight' fehlt, solange die App auf Android kein Gewicht liest (getWeight hat
// keinen Aufrufer) - Google lehnt ungenutzte Gesundheitsberechtigungen ab.
const ANDROID_READ_PERMISSIONS: RecordType[] = [
  'Steps', 'HeartRateSeries', 'RestingHeartRate',
  'ActiveCaloriesBurned', 'OxygenSaturation', 'RespiratoryRate', 'BloodPressure',
];

export const isNative = Capacitor.isNativePlatform();
export const isIOS = Capacitor.getPlatform() === 'ios';
export const isAndroid = Capacitor.getPlatform() === 'android';

export type HealthPlatform = 'ios' | 'android' | 'web' | string;

export interface HealthPermissionResult {
  platform: HealthPlatform;
  available: boolean;
  granted: boolean;
  reason?: string;
  grantedPermissions?: string[];
}

export interface HealthQueryOptions {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface HealthWeight {
  valueKg: number;
  date: Date;
  source?: string;
}

export interface HealthSteps {
  count: number;
  startDate: Date;
  endDate: Date;
}

export interface HealthSleep {
  startDate: Date;
  endDate: Date;
  durationHours: number;
  state?: string;
  source?: string;
}

export interface HealthHeartRate {
  bpm: number;
  date: Date;
  source?: string;
}

/** Ein Einzelwert (SpO2 in Prozent, Atemfrequenz in 1/min). */
export interface HealthSample {
  date: Date;
  value: number;
}

export interface HealthBloodPressure {
  date: Date;
  systolic: number;
  diastolic: number;
}

/** Ein Workout, wie es die Plattform aufgezeichnet hat (Uhr, Fitness-App). */
export interface HealthWorkout {
  /** Plattform-ID: HKWorkout-UUID bzw. Health-Connect-Record-ID. */
  externalId: string;
  /**
   * Rohname der Plattform. HealthKit: Anzeigename aus dem Plugin, z. B.
   * 'Traditional Strength Training'. Health Connect: ExerciseType als Zahl oder Name.
   */
  activityType: string;
  /** Numerischer Typ der Plattform (HKWorkoutActivityType.rawValue bzw. ExerciseType), falls bekannt. */
  activityId?: number | null;
  startDate: Date;
  endDate: Date;
  durationS: number;
  distanceM: number | null;
  kcal: number | null;
  avgHr: number | null;
  source?: string;
}

type HealthConnectReadRecordsResult = Awaited<ReturnType<typeof HealthConnect.readRecords>>;
type HealthConnectStoredRecord = HealthConnectReadRecordsResult['records'][number];
type HealthConnectWeightRecord = HealthConnectStoredRecord & Extract<HealthConnectRecord, { type: 'Weight' }>;
type HealthConnectStepsRecord = HealthConnectStoredRecord & Extract<HealthConnectRecord, { type: 'Steps' }>;
type HealthConnectHeartRateRecord = HealthConnectStoredRecord & Extract<HealthConnectRecord, { type: 'HeartRateSeries' }>;
type HealthConnectRestingHeartRateRecord = HealthConnectStoredRecord & Extract<HealthConnectRecord, { type: 'RestingHeartRate' }>;
type HealthConnectActiveEnergyRecord = HealthConnectStoredRecord & Extract<HealthConnectRecord, { type: 'ActiveCaloriesBurned' }>;
type HealthConnectOxygenRecord = HealthConnectStoredRecord & Extract<HealthConnectRecord, { type: 'OxygenSaturation' }>;
type HealthConnectRespiratoryRecord = HealthConnectStoredRecord & Extract<HealthConnectRecord, { type: 'RespiratoryRate' }>;
type HealthConnectBloodPressureRecord = HealthConnectStoredRecord & Extract<HealthConnectRecord, { type: 'BloodPressure' }>;

function platform(): HealthPlatform {
  return Capacitor.getPlatform();
}

function queryRange(options: HealthQueryOptions | undefined, fallbackDays: number) {
  const endDate = options?.endDate ?? new Date();
  const startDate = options?.startDate ?? new Date(endDate.getTime() - fallbackDays * DAY_MS);

  return { startDate, endDate, limit: options?.limit ?? 0 };
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

function sortByDateDesc<T>(items: T[], getDate: (item: T) => Date) {
  return [...items].sort((a, b) => getDate(b).getTime() - getDate(a).getTime());
}

function getHealthKitSource(sample: OtherData | SleepData | ActivityData) {
  return sample.source || sample.sourceBundleId || undefined;
}

async function queryHealthKit<T extends OtherData | SleepData | ActivityData>(sampleName: string, options?: HealthQueryOptions) {
  const { startDate, endDate, limit } = queryRange(options, 1);

  const response = await CapacitorHealthkit.queryHKitSampleType<T>({
    sampleName,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    limit,
  });

  return response.resultData ?? [];
}

async function readHealthConnectRecords<T extends HealthConnectStoredRecord>(
  type: RecordType,
  options?: HealthQueryOptions,
  fallbackDays = 1,
  /** Alle Seiten lesen (hoechstens MAX_HEALTH_CONNECT_PAGES) statt nur die erste. */
  allPages = false,
) {
  const { startDate, endDate, limit } = queryRange(options, fallbackDays);
  const records: T[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_HEALTH_CONNECT_PAGES; page += 1) {
    const response = await HealthConnect.readRecords({
      type,
      timeRangeFilter: {
        type: 'between',
        startTime: startDate,
        endTime: endDate,
      },
      ascendingOrder: false,
      pageSize: limit > 0 ? limit : 1000,
      ...(pageToken ? { pageToken } : {}),
    });

    records.push(...(response.records as T[]));
    pageToken = response.pageToken;
    if (!allPages || !pageToken) break;
  }

  return records;
}

export async function requestPermissions(): Promise<HealthPermissionResult> {
  if (!isNative) {
    return {
      platform: platform(),
      available: false,
      granted: false,
      reason: 'Health data is only available on native iOS and Android builds.',
    };
  }

  if (isIOS) {
    try {
      await CapacitorHealthkit.isAvailable();
      await CapacitorHealthkit.requestAuthorization({
        all: [],
        read: IOS_READ_PERMISSIONS,
        write: [],
      });

      return {
        platform: 'ios',
        available: true,
        granted: true,
      };
    } catch (error) {
      return {
        platform: 'ios',
        available: false,
        granted: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (isAndroid) {
    const { availability } = await HealthConnect.checkAvailability();

    if (availability !== 'Available') {
      return {
        platform: 'android',
        available: false,
        granted: false,
        reason: `Health Connect is ${availability}.`,
      };
    }

    const permissions = await HealthConnect.requestHealthPermissions({
      read: ANDROID_READ_PERMISSIONS,
      write: [],
    });

    return {
      platform: 'android',
      available: true,
      granted: permissions.hasAllPermissions,
      grantedPermissions: permissions.grantedPermissions,
    };
  }

  return {
    platform: platform(),
    available: false,
    granted: false,
    reason: 'Unsupported native platform.',
  };
}

export async function getWeight(options?: HealthQueryOptions): Promise<HealthWeight | null> {
  if (!isNative) return null;

  if (isIOS) {
    const samples = await queryHealthKit<OtherData>('weight', {
      ...options,
      limit: options?.limit ?? 0,
      startDate: options?.startDate ?? new Date(Date.now() - 365 * DAY_MS),
    });
    const latest = sortByDateDesc(samples, sample => toDate(sample.endDate))[0];

    if (!latest) return null;

    return {
      valueKg: latest.value,
      date: toDate(latest.endDate),
      source: getHealthKitSource(latest),
    };
  }

  if (isAndroid) {
    const records = await readHealthConnectRecords<HealthConnectWeightRecord>('Weight', {
      ...options,
      startDate: options?.startDate ?? new Date(Date.now() - 365 * DAY_MS),
    }, 365);
    const latest = sortByDateDesc(records, record => toDate(record.time))[0];

    if (!latest) return null;

    return {
      valueKg: latest.weight.value,
      date: toDate(latest.time),
      source: latest.metadata.dataOrigin,
    };
  }

  return null;
}

export async function getSteps(options?: HealthQueryOptions): Promise<HealthSteps | null> {
  if (!isNative) return null;

  const startDate = options?.startDate ?? startOfToday();
  const endDate = options?.endDate ?? new Date();

  if (isIOS) {
    const samples = await queryHealthKit<OtherData>('stepCount', {
      ...options,
      startDate,
      endDate,
    });

    return {
      count: samples.reduce((sum, sample) => sum + sample.value, 0),
      startDate,
      endDate,
    };
  }

  if (isAndroid) {
    const records = await readHealthConnectRecords<HealthConnectStepsRecord>('Steps', {
      ...options,
      startDate,
      endDate,
    });

    return {
      count: records.reduce((sum, record) => sum + record.count, 0),
      startDate,
      endDate,
    };
  }

  return null;
}

/**
 * Schritte je lokalem Tag und Quelle (Standard: die letzten 30 Tage); `start` ist der
 * Tagesbeginn. Quellen bleiben getrennt, damit Telefon und Uhr nicht doppelt zaehlen.
 */
export async function getStepsByDay(options?: HealthQueryOptions): Promise<{ start: Date; count: number; source?: string }[]> {
  if (!isNative) return [];

  const { startDate, endDate } = queryRange(options, 30);
  const range = { startDate, endDate };
  let samples: { start: Date; count: number; source?: string }[] = [];

  if (isIOS) {
    const rows = await queryHealthKit<OtherData>('stepCount', range);
    samples = rows.map(row => ({ start: toDate(row.startDate), count: row.value, source: getHealthKitSource(row) }));
  } else if (isAndroid) {
    const records = await readHealthConnectRecords<HealthConnectStepsRecord>('Steps', range, 30, true);
    samples = records.map(record => ({ start: toDate(record.startTime), count: record.count, source: record.metadata.dataOrigin }));
  }

  const byDay = new Map<string, { start: Date; count: number; source?: string }>();
  for (const sample of samples) {
    const key = `${localDay(sample.start)}|${sample.source ?? ''}`;
    const entry = byDay.get(key);
    if (entry) {
      entry.count += sample.count;
    } else {
      byDay.set(key, {
        start: new Date(sample.start.getFullYear(), sample.start.getMonth(), sample.start.getDate()),
        count: sample.count,
        source: sample.source,
      });
    }
  }

  return [...byDay.values()].sort((a, b) => b.start.getTime() - a.start.getTime());
}

export async function getSleep(options?: HealthQueryOptions): Promise<HealthSleep[]> {
  if (!isNative) return [];

  if (isIOS) {
    const samples = await queryHealthKit<SleepData>('sleepAnalysis', {
      ...options,
      startDate: options?.startDate ?? new Date(Date.now() - DAY_MS),
    });

    return sortByDateDesc(samples, sample => toDate(sample.endDate)).map(sample => ({
      startDate: toDate(sample.startDate),
      endDate: toDate(sample.endDate),
      durationHours: sample.duration,
      state: sample.sleepState,
      source: getHealthKitSource(sample),
    }));
  }

  // The current capacitor-health-connect release does not expose SleepSession records.
  return [];
}

export async function getHeartRate(options?: HealthQueryOptions): Promise<HealthHeartRate[]> {
  if (!isNative) return [];

  if (isIOS) {
    const samples = await queryHealthKit<OtherData>('heartRate', options);

    return sortByDateDesc(samples, sample => toDate(sample.endDate)).map(sample => ({
      bpm: sample.value,
      date: toDate(sample.endDate),
      source: getHealthKitSource(sample),
    }));
  }

  if (isAndroid) {
    const records = await readHealthConnectRecords<HealthConnectHeartRateRecord>('HeartRateSeries', options);
    const samples = records.flatMap(record =>
      record.samples.map(sample => ({
        bpm: sample.beatsPerMinute,
        date: toDate(sample.time),
        source: record.metadata.dataOrigin,
      })),
    );

    return sortByDateDesc(samples, sample => sample.date);
  }

  return [];
}

/** Das Plugin meldet fehlende Werte als -1; 0 ist bei kcal/Strecke ebenfalls „nicht gemessen". */
function positiveOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

async function averageHeartRateIOS(startDate: Date, endDate: Date): Promise<number | null> {
  try {
    const samples = await queryHealthKit<OtherData>('heartRate', { startDate, endDate });
    const values = samples.map(sample => sample.value).filter(value => value > 0);
    if (values.length === 0) return null;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  } catch {
    return null;
  }
}

/**
 * Workouts im Zeitraum (Standard: die letzten 30 Tage), neueste zuerst.
 *
 * iOS: HealthKit 'workoutType'. Strecke und kcal (aktive Energie) liefert das
 * Workout selbst; den Durchschnittspuls gibt das Plugin nicht mit, er wird aus
 * den Pulsmessungen im Workout-Fenster gemittelt.
 *
 * Android: leer. capacitor-health-connect 0.7 serialisiert beim Lesen nur
 * ActiveCaloriesBurned, Temperatur-/Blutwerte, HeartRateSeries, Height,
 * OxygenSaturation, RespiratoryRate, RestingHeartRate, Steps und Weight; bei
 * ExerciseSession oder Distance wirft der Kotlin-Teil innerhalb einer Coroutine
 * ohne catch — der Aufruf antwortet nie bzw. die App stuerzt ab. Deshalb wird
 * hier gar nicht erst gefragt.
 */
export async function getWorkouts(
  options?: HealthQueryOptions,
  /** Fuer welche Workouts der Durchschnittspuls nachgeschlagen wird (Standard: alle). */
  { withHeartRate = () => true }: { withHeartRate?: (externalId: string) => boolean } = {},
): Promise<HealthWorkout[]> {
  if (!isNative) return [];

  if (isIOS) {
    const { startDate, endDate, limit } = queryRange(options, 30);
    const samples = await queryHealthKit<ActivityData>('workoutType', { startDate, endDate, limit });
    const workouts: HealthWorkout[] = [];

    // Nacheinander statt parallel: pro Workout eine Pulsabfrage, HealthKit soll
    // beim Import nicht mit Dutzenden gleichzeitigen Queries geflutet werden.
    for (const sample of sortByDateDesc(samples, item => toDate(item.startDate))) {
      const start = toDate(sample.startDate);
      const end = toDate(sample.endDate);

      workouts.push({
        externalId: sample.uuid,
        activityType: sample.workoutActivityName,
        activityId: sample.workoutActivityId,
        startDate: start,
        endDate: end,
        // 'duration' kommt vom Plugin in Stunden.
        durationS: Math.round(sample.duration * 3600),
        distanceM: positiveOrNull(sample.totalDistance),
        kcal: positiveOrNull(sample.totalEnergyBurned),
        avgHr: withHeartRate(sample.uuid) ? await averageHeartRateIOS(start, end) : null,
        source: getHealthKitSource(sample),
      });
    }

    return workouts;
  }

  return [];
}

/** Ruhepuls-Tageswerte (Standard: die letzten 30 Tage), neueste zuerst. */
export async function getRestingHeartRate(options?: HealthQueryOptions): Promise<HealthHeartRate[]> {
  if (!isNative) return [];

  const { startDate, endDate, limit } = queryRange(options, 30);

  if (isIOS) {
    const samples = await queryHealthKit<OtherData>('restingHeartRate', { startDate, endDate, limit });

    return sortByDateDesc(samples, sample => toDate(sample.endDate)).map(sample => ({
      bpm: sample.value,
      date: toDate(sample.endDate),
      source: getHealthKitSource(sample),
    }));
  }

  if (isAndroid) {
    const records = await readHealthConnectRecords<HealthConnectRestingHeartRateRecord>(
      'RestingHeartRate',
      { startDate, endDate, limit },
      30,
    );

    return sortByDateDesc(records, record => toDate(record.time)).map(record => ({
      bpm: record.beatsPerMinute,
      date: toDate(record.time),
      source: record.metadata.dataOrigin,
    }));
  }

  return [];
}

/** SpO2 immer in Prozent: HealthKit liefert einen Bruch (0.97), Health Connect Prozent (97). */
export function spo2Percent(value: number): number {
  const percent = value <= 1 ? value * 100 : value;
  return Math.round(percent * 10) / 10;
}

function energyToKcal(energy: { unit: string; value: number }): number {
  switch (energy.unit) {
    case 'calories': return energy.value / 1000;
    case 'joules': return energy.value / 4184;
    case 'kilojoules': return energy.value / 4.184;
    default: return energy.value;
  }
}

/** Aktive Energie je Probe in kcal (Standard: die letzten 30 Tage), neueste zuerst. */
export async function getActiveEnergy(options?: HealthQueryOptions): Promise<{ start: Date; end: Date; kcal: number; source?: string }[]> {
  if (!isNative) return [];

  const { startDate, endDate } = queryRange(options, 30);
  const range = { startDate, endDate };

  if (isIOS) {
    const samples = await queryHealthKit<OtherData>('activeEnergyBurned', range);
    return sortByDateDesc(samples, sample => toDate(sample.endDate)).map(sample => ({
      start: toDate(sample.startDate),
      end: toDate(sample.endDate),
      kcal: sample.value,
      source: getHealthKitSource(sample),
    }));
  }

  if (isAndroid) {
    const records = await readHealthConnectRecords<HealthConnectActiveEnergyRecord>('ActiveCaloriesBurned', range, 30, true);
    return sortByDateDesc(records, record => toDate(record.endTime)).map(record => ({
      start: toDate(record.startTime),
      end: toDate(record.endTime),
      kcal: energyToKcal(record.energy),
      source: record.metadata.dataOrigin,
    }));
  }

  return [];
}

/** Sauerstoffsaettigung in Prozent (Standard: die letzten 30 Tage), neueste zuerst. */
export async function getOxygenSaturation(options?: HealthQueryOptions): Promise<HealthSample[]> {
  if (!isNative) return [];

  const { startDate, endDate } = queryRange(options, 30);
  const range = { startDate, endDate };

  if (isIOS) {
    const samples = await queryHealthKit<OtherData>('oxygenSaturation', range);
    return sortByDateDesc(samples, sample => toDate(sample.endDate)).map(sample => ({
      date: toDate(sample.endDate),
      value: spo2Percent(sample.value),
    }));
  }

  if (isAndroid) {
    const records = await readHealthConnectRecords<HealthConnectOxygenRecord>('OxygenSaturation', range, 30, true);
    return sortByDateDesc(records, record => toDate(record.time)).map(record => ({
      date: toDate(record.time),
      value: spo2Percent(record.percentage.value),
    }));
  }

  return [];
}

/** Atemfrequenz in 1/min (Standard: die letzten 30 Tage), neueste zuerst. */
export async function getRespiratoryRate(options?: HealthQueryOptions): Promise<HealthSample[]> {
  if (!isNative) return [];

  const { startDate, endDate } = queryRange(options, 30);
  const range = { startDate, endDate };

  if (isIOS) {
    const samples = await queryHealthKit<OtherData>('respiratoryRate', range);
    return sortByDateDesc(samples, sample => toDate(sample.endDate)).map(sample => ({
      date: toDate(sample.endDate),
      value: sample.value,
    }));
  }

  if (isAndroid) {
    const records = await readHealthConnectRecords<HealthConnectRespiratoryRecord>('RespiratoryRate', range, 30, true);
    return sortByDateDesc(records, record => toDate(record.time)).map(record => ({
      date: toDate(record.time),
      value: record.rate,
    }));
  }

  return [];
}

/** Blutdruck in mmHg (Standard: die letzten 30 Tage), neueste zuerst. */
export async function getBloodPressure(options?: HealthQueryOptions): Promise<HealthBloodPressure[]> {
  if (!isNative) return [];

  const { startDate, endDate } = queryRange(options, 30);
  const range = { startDate, endDate };

  if (isIOS) {
    // HealthKit liefert Systole und Diastole als getrennte Proben; ein Messvorgang
    // hat bei beiden dieselbe endDate.
    const [systolic, diastolic] = await Promise.all([
      queryHealthKit<OtherData>('bloodPressureSystolic', range),
      queryHealthKit<OtherData>('bloodPressureDiastolic', range),
    ]);
    const diastolicByEnd = new Map(diastolic.map(sample => [toDate(sample.endDate).getTime(), sample.value]));
    const pairs: HealthBloodPressure[] = [];

    for (const sample of systolic) {
      const date = toDate(sample.endDate);
      const dia = diastolicByEnd.get(date.getTime());
      if (dia !== undefined) pairs.push({ date, systolic: sample.value, diastolic: dia });
    }

    return sortByDateDesc(pairs, pair => pair.date);
  }

  if (isAndroid) {
    const records = await readHealthConnectRecords<HealthConnectBloodPressureRecord>('BloodPressure', range, 30, true);
    return sortByDateDesc(records, record => toDate(record.time)).map(record => ({
      date: toDate(record.time),
      systolic: record.systolic.value,
      diastolic: record.diastolic.value,
    }));
  }

  return [];
}

// Kein getHrv(): weder @perfood/capacitor-healthkit 1.3 (keine Sample-Art fuer
// heartRateVariabilitySDNN) noch capacitor-health-connect 0.7 (kein
// HeartRateVariabilityRmssd im Serializer) liefern Herzratenvariabilitaet.
