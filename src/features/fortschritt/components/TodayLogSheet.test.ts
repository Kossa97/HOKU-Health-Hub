import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('TodayLogSheet save flow', () => {
  it('waits for refreshed progress data before closing after save', () => {
    const source = readFileSync(new URL('./TodayLogSheet.tsx', import.meta.url), 'utf8')

    expect(source).toContain('onSaved: () => void | Promise<void>')
    expect(source).toContain('await onSaved()')
    expect(source.indexOf('await onSaved()')).toBeLessThan(source.indexOf('onClose()'))
  })

  it('persists the last saved values across progress page remounts', () => {
    const source = readFileSync(new URL('./TodayLogSheet.tsx', import.meta.url), 'utf8')

    expect(source).toContain('SAVED_VALUES_STORAGE_PREFIX')
    expect(source).toContain('localStorage.getItem')
    expect(source).toContain('localStorage.setItem')
    expect(source.indexOf('readStoredSavedValues')).toBeLessThan(source.indexOf('loadLogFormValues(logs, weightLogs, date, savedValues)'))
  })

  it('saves measurements only from typed values, after daily values and weight', () => {
    const source = readFileSync(new URL('./TodayLogSheet.tsx', import.meta.url), 'utf8')

    expect(source).toContain('measurementRowsToSave(user.id, date, parsed.values)')
    expect(source).not.toMatch(/measurementRowsToSave\([^)]*lastMeasurementUpTo/)
    expect(source).toContain(".from('body_measurements')")
    expect(source).toContain("onConflict: 'user_id,measured_on,site'")
    expect(source.indexOf(".from('weight_logs')")).toBeLessThan(source.indexOf(".from('body_measurements')"))
    expect(source.indexOf(".from('body_measurements')")).toBeLessThan(source.indexOf('await onSaved()'))
  })

  it('blocks saving on invalid measurements and treats a typed site as a value', () => {
    const source = readFileSync(new URL('./TodayLogSheet.tsx', import.meta.url), 'utf8')

    expect(source).toContain("t('umfaenge_invalid')")
    expect(source).toContain('!hasWellness && !hasWeight && !hasMeasurements')
    expect(source.indexOf("t('umfaenge_invalid')")).toBeLessThan(source.indexOf('setSaving(true)'))
  })

  it('keeps the sheet open with umfaenge_save_failed and clears typed text on date change', () => {
    const source = readFileSync(new URL('./TodayLogSheet.tsx', import.meta.url), 'utf8')

    expect(source).toContain("t('umfaenge_save_failed')")
    expect(source).toContain('partiallySavedRef.current = true')
    expect(source).toMatch(/setTyped\(\{\}\)/)
  })

  it('saves muscle mass next to body fat, checks 10–150 kg before writing', () => {
    const source = readFileSync(new URL('./TodayLogSheet.tsx', import.meta.url), 'utf8')

    expect(source).toContain("label={t('fortschritt_metric_muscle_mass')}")
    expect(source.indexOf("label={t('fortschritt_metric_body_fat_short')}"))
      .toBeLessThan(source.indexOf("label={t('fortschritt_metric_muscle_mass')}"))
    expect(source).toContain('min={MUSCLE_MASS_MIN_KG}')
    expect(source).toContain('max={MUSCLE_MASS_MAX_KG}')
    expect(source).toContain("t('fortschritt_muscle_mass_invalid')")
    expect(source.indexOf("t('fortschritt_muscle_mass_invalid')")).toBeLessThan(source.indexOf('setSaving(true)'))
    expect(source).toContain('upsertDaily({ ...payload, muscle_mass_kg: muscleMass })')
    expect(source).toContain('isMissingColumn(error) && muscleMass == null')
  })
})
