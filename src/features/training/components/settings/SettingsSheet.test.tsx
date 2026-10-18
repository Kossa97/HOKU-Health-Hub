// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TrainingData } from '../../hooks/useTrainingData'
import { DEFAULT_TRAINING_SETTINGS, type TrainingSettings } from '../../types'
import { SettingsSheet } from './SettingsSheet'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: 'de', language: 'de' } }),
}))

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: toastMock }))

const healthMock = vi.hoisted(() => ({
  isNative: false, isIOS: false, isAndroid: false,
  requestPermissions: vi.fn(),
}))
vi.mock('../../../../lib/health', () => healthMock)

function makeData(overrides: { settings?: Partial<TrainingSettings>; glp1Names?: string[] } = {}) {
  const data = {
    settings: { ...DEFAULT_TRAINING_SETTINGS, ...overrides.settings },
    sessions: [],
    customExercises: [],
    context: { glp1Names: overrides.glp1Names ?? [] },
    updateSettings: vi.fn(async () => {}),
    importSessions: vi.fn(async (incoming: unknown[]) => incoming.length),
    addCustomExercise: vi.fn(async (exercise: { name: string }) => ({ ...exercise, id: `id-${exercise.name}` })),
    syncHealthWorkouts: vi.fn(async () => ({ created: 2, enriched: 1 })),
  }
  return data as typeof data & TrainingData
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SettingsSheet', () => {
  it('zeigt alle Bereiche und speichert eine Einstellung sofort', async () => {
    const data = makeData()
    render(<SettingsSheet data={data} onClose={() => {}} />)

    expect(screen.getByRole('dialog', { name: 'Trainingseinstellungen' })).toBeTruthy()
    for (const heading of ['Allgemein', 'Apple Health / Health Connect', 'GLP-1-Ansicht', 'Import aus Hevy oder Strong', 'Export', 'Privatsphäre']) {
      expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
    }

    fireEvent.click(screen.getByRole('button', { name: 'lb' }))
    expect(data.updateSettings).toHaveBeenCalledWith({ ...DEFAULT_TRAINING_SETTINGS, unit: 'lb' })

    fireEvent.click(screen.getByRole('button', { name: '0,5 kg' }))
    expect(data.updateSettings).toHaveBeenLastCalledWith(expect.objectContaining({ platesKg: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5] }))

    fireEvent.click(screen.getByRole('button', { name: '2 min' }))
    expect(data.updateSettings).toHaveBeenLastCalledWith(expect.objectContaining({ defaultRestS: 120 }))

    // Export ohne Trainings ist gesperrt.
    expect((screen.getByRole('button', { name: 'Als CSV exportieren' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('meldet einen Speicherfehler per toast', async () => {
    const data = makeData()
    data.updateSettings.mockRejectedValueOnce(new Error('offline'))
    render(<SettingsSheet data={data} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Einstellung konnte nicht gespeichert werden.'))
  })

  it('verweist im Browser beim Health-Schalter auf die App und fragt keine Berechtigung an', () => {
    const data = makeData()
    render(<SettingsSheet data={data} onClose={() => {}} />)
    expect(screen.getAllByText('Nur in der App für iPhone und Android verfügbar.').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('switch', { name: 'Daten von der Uhr übernehmen' }))
    expect(healthMock.requestPermissions).not.toHaveBeenCalled()
    expect(data.updateSettings).not.toHaveBeenCalled()
  })

  it('zeigt bei GLP-1 automatisch den erkannten Stack-Eintrag', () => {
    render(<SettingsSheet data={makeData({ glp1Names: ['Tirzepatid'] })} onClose={() => {}} />)
    expect(screen.getByText('Im Stack erkannt: Tirzepatid. Die Ansicht ist an.')).toBeTruthy()
  })

  it('importiert eine Strong-Datei: Vorschau, eigene Uebungen anlegen, unknown-IDs ersetzen', async () => {
    const data = makeData()
    render(<SettingsSheet data={data} onClose={() => {}} />)

    const csv = [
      'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
      '2026-09-30 18:00:00,Evening,48m,Deadlift (Barbell),1,140,5,,,,,',
      '2026-09-30 18:00:00,Evening,48m,Meine Spezialübung,1,30,12,,,,,',
      '2026-10-02 18:00:00,Morning,30m,Deadlift (Barbell),1,150,3,,,,,',
    ].join('\n')
    const file = new File([csv], 'strong.csv', { type: 'text/csv' })
    fireEvent.change(screen.getByTestId('training-import-file'), { target: { files: [file] } })

    expect(await screen.findByText('Erkannt: Export aus Strong')).toBeTruthy()
    expect(screen.getByText('In welcher Einheit hast du in Strong gewogen?')).toBeTruthy()
    expect(screen.getByText('2 Trainings')).toBeTruthy()
    expect(screen.getByText('Meine Spezialübung')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Importieren' }))
    await waitFor(() => expect(data.importSessions).toHaveBeenCalledTimes(1))

    expect(data.addCustomExercise).toHaveBeenCalledWith({
      name: 'Meine Spezialübung', category: 'strength', equipment: 'other',
      tracking: 'weight_reps', primary: [], secondary: [],
    })
    const imported = data.importSessions.mock.calls[0][0] as Array<{ exercises: Array<{ exerciseId: string }> }>
    const ids = imported.flatMap(s => s.exercises.map(e => e.exerciseId))
    expect(ids).toContain('custom:id-Meine Spezialübung')
    expect(ids.some(id => id.startsWith('unknown:'))).toBe(false)
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('2 Trainings importiert (Duplikate übersprungen).'))
  })

  it('zeigt bei einer fremden Datei nur einen Hinweis, keine Parser-Texte', async () => {
    render(<SettingsSheet data={makeData()} onClose={() => {}} />)
    const file = new File(['a,b,c\n1,2,3'], 'other.csv', { type: 'text/csv' })
    fireEvent.change(screen.getByTestId('training-import-file'), { target: { files: [file] } })
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Diese Datei erkennen wir nicht')
  })
})
