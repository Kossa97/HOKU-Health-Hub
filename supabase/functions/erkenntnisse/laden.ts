// Rein: macht aus Datenbankzeilen (unbekannte Form) die Rohdaten der Erkenntnis-Engine
// und baut aus gespeicherten Funden die Kandidatenliste fürs Wochen-Update.
// Nur relative .ts-Importe, keine Deno-APIs: läuft auch in Vitest.

import type { Gespeichert } from '../_shared/erkenntnisse/auswahl.ts'
import type { Datenlage, Fund, Rohdaten, Training } from '../_shared/erkenntnisse/typen.ts'
import { lokalerTag, tageZwischen } from '../_shared/erkenntnisse/zeit.ts'

export interface Zeilen {
  health: unknown[]
  daily: unknown[]
  effects: unknown[]
  food: unknown[]
  training: unknown[]
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/

type Objekt = Record<string, unknown>

function istObjekt(x: unknown): x is Objekt {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function istTag(x: unknown): x is string {
  return typeof x === 'string' && DATUM.test(x)
}

// lokalerTag wirft bei ungültigen Zeitpunkten einen RangeError: solche Zeilen fliegen hier raus.
function istZeitpunkt(x: unknown): x is string {
  return typeof x === 'string' && !Number.isNaN(Date.parse(x))
}

function zahlOderNull(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null
}

function zuUebungen(exercises: unknown): Training['exercises'] {
  if (!Array.isArray(exercises)) return []
  const uebungen: Training['exercises'] = []
  for (const u of exercises) {
    if (!istObjekt(u) || typeof u.exerciseId !== 'string' || !Array.isArray(u.sets)) continue
    const saetze = u.sets.filter(istObjekt).map((s) => ({
      type: typeof s.type === 'string' ? s.type : undefined,
      weightKg: zahlOderNull(s.weightKg),
      reps: zahlOderNull(s.reps),
    }))
    uebungen.push({ exerciseId: u.exerciseId, sets: saetze })
  }
  return uebungen
}

export function zuRohdaten(zeilen: Zeilen): Rohdaten {
  const roh: Rohdaten = { health: [], tagebuch: [], effekte: [], essen: [], trainings: [] }

  for (const z of zeilen.health) {
    if (!istObjekt(z) || !istTag(z.day)) continue
    roh.health.push({ day: z.day, sleep_min: zahlOderNull(z.sleep_min) })
  }
  for (const z of zeilen.daily) {
    if (!istObjekt(z) || !istTag(z.log_date)) continue
    roh.tagebuch.push({ log_date: z.log_date, energie: zahlOderNull(z.energie) })
  }
  for (const z of zeilen.effects) {
    if (!istObjekt(z) || !istZeitpunkt(z.occurred_at)) continue
    roh.effekte.push({ occurred_at: z.occurred_at })
  }
  for (const z of zeilen.food) {
    if (!istObjekt(z) || !istTag(z.log_date) || typeof z.source !== 'string') continue
    const protein = zahlOderNull(z.protein_g)
    if (protein === null) continue
    roh.essen.push({ log_date: z.log_date, protein_g: protein, source: z.source })
  }
  for (const z of zeilen.training) {
    if (!istObjekt(z) || !istZeitpunkt(z.started_at) || typeof z.kind !== 'string') continue
    roh.trainings.push({ startedAt: z.started_at, kind: z.kind, exercises: zuUebungen(z.exercises) })
  }
  return roh
}

/** Anzahl lokaler Tage in [von, bis] mit mindestens einem Datenpunkt (Schlaf, Tagebuch, Effekt, Essen, Training). */
export function tageMitDaten(roh: Rohdaten, zone: string, von: string, bis: string): number {
  const mitDaten = new Set<string>()
  for (const h of roh.health) if (h.sleep_min !== null) mitDaten.add(h.day)
  for (const l of roh.tagebuch) mitDaten.add(l.log_date)
  for (const e of roh.effekte) mitDaten.add(lokalerTag(e.occurred_at, zone))
  for (const e of roh.essen) mitDaten.add(e.log_date)
  for (const t of roh.trainings) mitDaten.add(lokalerTag(t.startedAt, zone))
  return tageZwischen(von, bis).filter((tag) => mitDaten.has(tag)).length
}

/** Eine Zeile aus hoku_funde, wie sie die Function liest. */
export interface FundZeile {
  id: string
  schluessel: string
  fund: unknown
  datenlage: unknown
  gueltig: boolean
  gemeldet_datenlage: unknown
  ausgeblendet_am: unknown
}

function istDatenlage(x: unknown): x is Datenlage {
  return x === 'hinweis' || x === 'deutlich'
}

export function alsGespeichert(z: FundZeile): Gespeichert | null {
  if (!istDatenlage(z.datenlage)) return null
  return {
    id: z.id,
    schluessel: z.schluessel,
    datenlage: z.datenlage,
    gueltig: z.gueltig,
    gemeldet_datenlage: istDatenlage(z.gemeldet_datenlage) ? z.gemeldet_datenlage : null,
    ausgeblendet: z.ausgeblendet_am !== null && z.ausgeblendet_am !== undefined,
  }
}

/** Kandidaten fürs Wochen-Update aus den gespeicherten Funden; Zeilen mit unbrauchbarem Fund fallen weg. */
export function baueKandidaten(zeilen: FundZeile[]): { id: string; fund: Fund; gespeichert: Gespeichert }[] {
  const kandidaten: { id: string; fund: Fund; gespeichert: Gespeichert }[] = []
  for (const z of zeilen) {
    const gespeichert = alsGespeichert(z)
    if (!gespeichert || !istObjekt(z.fund)) continue
    // Die Spalte datenlage ist maßgeblich (wird bei jedem Lauf mitgeschrieben)
    kandidaten.push({ id: z.id, fund: { ...(z.fund as unknown as Fund), datenlage: gespeichert.datenlage }, gespeichert })
  }
  return kandidaten
}
