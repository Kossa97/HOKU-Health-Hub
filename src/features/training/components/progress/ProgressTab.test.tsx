// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { TrainingData } from '../../hooks/useTrainingData'
import type { CustomExercise, SessionKind, TrainingSession, TrainingSet } from '../../types'
import { DEFAULT_TRAINING_SETTINGS } from '../../types'
import { ProgressTab } from './ProgressTab'
import { exerciseSummaries, muscleBalance, trendOf, weeklyModel, REST_KEY } from './progressModel'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en', resolvedLanguage: 'en' } }),
}))

// jsdom misst nichts: Charts bekommen eine feste Groesse, damit Balken, Linie und Marker wirklich zeichnen.
vi.mock('recharts', async importOriginal => {
  const actual = await importOriginal<typeof import('recharts')>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) =>
      isValidElement(children) ? cloneElement(children as ReactElement<{ width: number; height: number }>, { width: 360, height: 220 }) : null,
  }
})

beforeAll(() => {
  // ResponsiveContainer braucht ResizeObserver; jsdom hat keinen.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

afterEach(cleanup)

const DAY = 24 * 60 * 60 * 1000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString()
const dateKey = (n: number) => daysAgo(n).slice(0, 10)

const LONG_NAME = 'Einarmiges Kurzhantelrudern auf der Schrägbank mit Pause am Brustkorb und extra langem Namen'

const custom: CustomExercise[] = [
  { id: 'bench', name: 'Test Bench Press', category: 'strength', equipment: 'barbell', tracking: 'weight_reps', primary: ['chest'], secondary: ['triceps'] },
  { id: 'plank', name: 'Test Plank', category: 'mobility', equipment: 'bodyweight', tracking: 'duration', primary: ['abs'], secondary: [] },
  { id: 'row', name: LONG_NAME, category: 'strength', equipment: 'dumbbell', tracking: 'weight_reps', primary: ['upper_back'], secondary: ['biceps'] },
]

const work = (weightKg: number, reps: number): TrainingSet => ({ type: 'normal', weightKg, reps, done: true })

function session(id: string, ago: number, kind: SessionKind, exercises: TrainingSession['exercises']): TrainingSession {
  return {
    id, kind, title: `Session ${id}`, startedAt: daysAgo(ago), endedAt: null, durationS: 3600,
    distanceM: null, kcal: null, avgHr: null, rpe: null, notes: null, routineId: null,
    exercises, source: 'manual', externalId: null,
  }
}

const sessions: TrainingSession[] = [
  session('s1', 1, 'strength', [
    { exerciseId: 'custom:bench', sets: [{ type: 'warmup', weightKg: 40, reps: 10, done: true }, work(100, 5), work(100, 4)] },
    { exerciseId: 'custom:plank', sets: [{ type: 'normal', durationS: 90, done: true }] },
  ]),
  session('s2', 8, 'strength', [
    { exerciseId: 'custom:bench', sets: [work(95, 5), work(95, 5)] },
    { exerciseId: 'custom:row', sets: [work(30, 10)] },
  ]),
  session('s3', 15, 'strength', [{ exerciseId: 'custom:bench', sets: [work(90, 6)] }]),
  session('s4', 3, 'run', []),
  session('s5', 20, 'yoga', []),
].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))

function makeData(overrides: Partial<TrainingData> = {}): TrainingData {
  return {
    state: 'ready',
    sessions,
    routines: [],
    customExercises: custom,
    settings: DEFAULT_TRAINING_SETTINGS,
    context: {
      weights: [], latestWeightKg: null, glp1Names: [], glp1Doses: [], wellnessToday: null, health: {},
      markers: [
        { date: dateKey(10), kind: 'substance_start', label: 'Testosteron Enantat' },
        { date: dateKey(5), kind: 'bloodwork', label: '' },
        { date: dateKey(400), kind: 'substance_end', label: 'Ausserhalb' },
      ],
    },
    glp1Active: false,
    reload: vi.fn(), saveSession: vi.fn(), removeSession: vi.fn(), saveRoutine: vi.fn(),
    removeRoutine: vi.fn(), addCustomExercise: vi.fn(), updateSettings: vi.fn(),
    importSessions: vi.fn(), syncHealthWorkouts: vi.fn(),
    ...overrides,
  } as TrainingData
}

describe('ProgressTab', () => {
  it('zeigt Wochen, Muskelbalance und die Übungsliste mit Beispieldaten', () => {
    render(<ProgressTab data={makeData()} />)

    expect(screen.getByText('Last 12 weeks')).toBeTruthy()
    // Gestapelte Balken sind gezeichnet (eigene Form mit Abstand und runder Kante).
    expect(document.querySelectorAll('.recharts-bar-rectangle path').length).toBeGreaterThan(0)
    expect(screen.getByText('5 sessions in 12 weeks')).toBeTruthy()
    expect(screen.getByText('Muscle balance · 7 days')).toBeTruthy()
    expect(screen.getByText('Chest')).toBeTruthy()
    // Brust: 2 Arbeitssaetze in den letzten 7 Tagen (Aufwaermsatz zaehlt nicht).
    expect(screen.getByTitle('Sets: 2')).toBeTruthy()

    const buttons = screen.getAllByRole('button', { name: /Test Bench Press|Test Plank|Einarmiges/ })
    // Zuletzt gemacht zuerst: Bench und Plank (gestern), dann Rudern (vor 8 Tagen).
    expect(buttons).toHaveLength(3)
    expect(buttons[2].textContent).toContain('Einarmiges')
    expect(screen.getByText('e1RM 116.7 kg')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Rising over the last 4 sessions' })).toBeTruthy()
  })

  it('filtert die Übungsliste über die Suche', () => {
    render(<ProgressTab data={makeData()} />)
    fireEvent.change(screen.getByLabelText('Search exercises'), { target: { value: 'plank' } })
    expect(screen.getByRole('button', { name: /Test Plank/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Test Bench Press/ })).toBeNull()

    fireEvent.change(screen.getByLabelText('Search exercises'), { target: { value: 'zzz' } })
    expect(screen.getByText('No exercise matches “zzz”.')).toBeTruthy()
  })

  it('zeigt ohne Einheiten einen Leerzustand', () => {
    render(<ProgressTab data={makeData({ sessions: [] })} />)
    expect(screen.getByText('No progress to show yet')).toBeTruthy()
    expect(screen.queryByText('Last 12 weeks')).toBeNull()
  })

  it('öffnet das Detail-Sheet mit Rekorden, Markern und Einheiten', () => {
    render(<ProgressTab data={makeData()} />)
    fireEvent.click(screen.getByRole('button', { name: /Test Bench Press/ }))

    const dialog = screen.getByRole('dialog', { name: 'Test Bench Press' })
    const sheet = within(dialog)
    expect(sheet.getByText('Records')).toBeTruthy()
    expect(sheet.getByText('Best e1RM')).toBeTruthy()
    expect(sheet.getAllByText('116.7 kg').length).toBeGreaterThan(0)
    expect(sheet.getByText('Heaviest weight')).toBeTruthy()
    expect(sheet.getByText('100 kg')).toBeTruthy()
    expect(sheet.getByText('Best volume')).toBeTruthy()
    expect(sheet.getByText('950 kg')).toBeTruthy()
    expect(sheet.getByText('All sessions (3)')).toBeTruthy()

    // Kennzahl-Umschalter
    expect(sheet.getByRole('button', { name: 'e1RM' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(sheet.getByRole('button', { name: 'Volume' }))
    expect(sheet.getByRole('button', { name: 'Volume' }).getAttribute('aria-pressed')).toBe('true')

    // Marker im Zeitraum: Start und Blutwerte, das Ende von vor 400 Tagen nicht.
    expect(sheet.getByText('Start: Testosteron Enantat')).toBeTruthy()
    // Im Chart selbst: gekuerztes Label an der senkrechten Linie.
    expect(dialog.querySelector('.recharts-line')).toBeTruthy()
    expect(sheet.getByText('Testosteron E…')).toBeTruthy()
    expect(sheet.queryByText('End: Ausserhalb')).toBeNull()
    const bloodChip = sheet.getByRole('button', { name: 'Bloodwork' })
    expect(bloodChip.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(bloodChip)
    expect(bloodChip.getAttribute('aria-pressed')).toBe('false')

    expect(sheet.getByText(/Epley/)).toBeTruthy()
    fireEvent.click(sheet.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('zeigt bei Zeit-Übungen Zeit statt e1RM', () => {
    render(<ProgressTab data={makeData()} />)
    fireEvent.click(screen.getByRole('button', { name: /Test Plank/ }))
    const sheet = within(screen.getByRole('dialog'))
    expect(sheet.getByText('Longest time')).toBeTruthy()
    expect(sheet.queryByText('Best e1RM')).toBeNull()
  })
})

describe('progressModel', () => {
  it('faltet seltene Arten unter „Weitere"', () => {
    const kinds: SessionKind[] = ['strength', 'strength', 'run', 'run', 'cycle', 'yoga', 'hiit']
    const many = kinds.map((kind, i) => session(`k${i}`, i, kind, []))
    const model = weeklyModel(many, new Date())
    expect(model.series).toEqual(['strength', 'run', 'cycle', REST_KEY])
    expect(model.weeks).toHaveLength(12)
    expect(model.totalSessions).toBe(7)
  })

  it('zählt Muskelsätze der letzten 7 Tage, sortiert', () => {
    const rows = muscleBalance(sessions, custom, new Date())
    expect(rows[0]).toEqual({ muscle: 'chest', sets: 2 })
    expect(rows.find(r => r.muscle === 'triceps')?.sets).toBe(1)
    expect(rows.some(r => r.muscle === 'upper_back')).toBe(false)
  })

  it('erkennt den Trend über die letzten 4 Einheiten', () => {
    const [bench] = exerciseSummaries(sessions, 'en', custom).filter(s => s.id === 'custom:bench')
    expect(bench.metrics[0]).toBe('e1rm')
    expect(trendOf(bench.history, 'e1rm')).toBe('up')
  })
})
