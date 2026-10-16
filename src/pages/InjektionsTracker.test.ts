import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('InjektionsTracker fullscreen map layout', () => {
  it('lets the tracker window fill the app viewport without outer margins', () => {
    const source = readFileSync(new URL('./InjektionsTracker.tsx', import.meta.url), 'utf8')

    expect(source).toContain('className="fixed inset-0 z-30 overflow-hidden"')
    expect(source).toContain("const TRACKER_FULLSCREEN_HEIGHT = '100dvh'")
    expect(source).toContain('borderRadius: 0')
    expect(source).toContain('height={TRACKER_FULLSCREEN_HEIGHT}')
    expect(source).toContain('minHeight={TRACKER_FULLSCREEN_HEIGHT}')
  })

  it('keeps the fullscreen map fixed to the viewport with safe-area overlay spacing', () => {
    const source = readFileSync(new URL('./InjektionsTracker.tsx', import.meta.url), 'utf8')
      + readFileSync(new URL('../components/injection3d/InjectionTrackerChrome.tsx', import.meta.url), 'utf8')

    expect(source).not.toContain("marginTop: 'calc(-1 * env(safe-area-inset-top))'")
    expect(source).toContain("top: 'calc(16px + env(safe-area-inset-top))'")
    expect(source).not.toContain("top: 'calc(8px + env(safe-area-inset-top))'")
  })
  it('uses two separate floating action buttons instead of a persistent bottom bar', () => {
    const source = readFileSync(new URL('../components/injection3d/InjectionTrackerTabs.tsx', import.meta.url), 'utf8')

    expect(source).toContain('injection-floating-actions')
    expect(source).toContain('left-4')
    expect(source).toContain('right-4')
    expect(source).toContain("bottom: 'calc(14px + env(safe-area-inset-bottom))'")
    expect(source).not.toContain('absolute bottom-4 left-4 right-4')
    expect(source).not.toContain("style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}")
    expect(source).toContain("openSheet('open')")
    expect(source).toContain("openSheet('history')")
    expect(source).not.toContain('role="tablist"')
    expect(source).not.toContain('aria-expanded={expanded}')
  })

  it('opens selected tracker content in a compact overlay sheet', () => {
    const source = readFileSync(new URL('../components/injection3d/InjectionTrackerTabs.tsx', import.meta.url), 'utf8')

    expect(source).toContain('activeSheet')
    expect(source).toContain('setActiveSheet(null)')
    expect(source).toContain('max-h-[48dvh]')
    expect(source).toContain('InjectionHistorySheet')
  })
  it('opens open intakes as a fullscreen workflow with filters and selection', () => {
    const tabs = readFileSync(new URL('../components/injection3d/InjectionTrackerTabs.tsx', import.meta.url), 'utf8')
    const tracker = readFileSync(new URL('./InjektionsTracker.tsx', import.meta.url), 'utf8')

    expect(tabs).toContain("activeSheet === 'open'")
    expect(tabs).toContain('className="fixed inset-0 z-[60] flex min-h-dvh flex-col overflow-hidden overscroll-y-contain"')
    expect(tabs).toContain('openCycleFilter')
    expect(tabs).toContain('openDaysFilter')
    expect(tabs).toContain('OPEN_DAYS_OPTIONS')
    expect(tabs).toContain('onSelectOpenIntake(intake)')
    expect(tracker).toContain('selectedTargetIntakeKey')
    expect(tracker).toContain('onSelectOpenIntake={selectOpenIntakeForInjection}')
  })

  it('uses one scroll container for the embedded history sheet', () => {
    const source = readFileSync(new URL('../components/injection3d/InjectionHistorySheet.tsx', import.meta.url), 'utf8')

    expect(source).toContain("embedded ? 'space-y-3' : 'max-h-[48vh] space-y-3 overflow-y-auto pr-1'")
  })

  it('keeps the embedded history sheet header compact', () => {
    const historySource = readFileSync(new URL('../components/injection3d/InjectionHistorySheet.tsx', import.meta.url), 'utf8')
    const tabsSource = readFileSync(new URL('../components/injection3d/InjectionTrackerTabs.tsx', import.meta.url), 'utf8')

    expect(historySource).toContain('{!embedded && (')
    expect(historySource).toContain('export function HistoryDaysSelect')
    expect(tabsSource).toContain("activeSheet === 'history'")
    expect(tabsSource).toContain('<HistoryDaysSelect')
    expect(tabsSource).toContain('className="mb-2 flex items-center gap-3"')
  })

  it('passes tracker sheet state into focus requests for visible-area camera framing', () => {
    const source = readFileSync(new URL('./InjektionsTracker.tsx', import.meta.url), 'utf8')

    expect(source).toContain('trackerSheetOpen')
    expect(source).toContain('sheetOpen: trackerSheetOpen')
    expect(source).toContain('onSheetOpenChange={setTrackerSheetOpen}')
  })

  it('shows a compact active pin chip with only substance and age', () => {
    const source = readFileSync(new URL('./InjektionsTracker.tsx', import.meta.url), 'utf8')

    expect(source).toContain('activeLog')
    expect(source).toContain('getInjectionPinSubstance(activeLog)')
    expect(source).toContain('formatInjectionPinAge(activeLog.logged_at)')
    expect(source).toContain('injection-active-pin-chip')
  })

  it('hides floating tracker actions while confirming a new injection position', () => {
    const source = readFileSync(new URL('./InjektionsTracker.tsx', import.meta.url), 'utf8')

    expect(source).toContain('const showPositionActions = draftPin && !showLogSheet')
    expect(source).toContain('{showPositionActions && (')
    expect(source).toContain('{!showPositionActions && (')
    expect(source).toContain('setTrackerSheetOpen(false)')
  })

  it('keeps the home injection hero focused on opening the tracker', () => {
    const hero = readFileSync(new URL('../components/injection3d/InjectionTrackerHero.tsx', import.meta.url), 'utf8')
    const home = readFileSync(new URL('./Home.tsx', import.meta.url), 'utf8')

    expect(hero).toContain('className="btn-primary flex min-h-11 w-full items-center justify-center gap-2"')
    expect(hero).not.toContain('MapPin')
    expect(hero).not.toContain('Syringe')
    expect(hero).not.toContain('lastLabel')
    expect(hero).not.toContain('sevenDayCount')
    expect(hero).not.toContain('hasDueInjectable')
    expect(hero).not.toContain('onLogToday')
    expect(home).not.toContain('onLogToday')
    expect(home).not.toContain('hasDueInjectable={')
  })

  it('prevents horizontal scrolling in the injection save sheet', () => {
    const logSheet = readFileSync(new URL('../components/injection3d/InjectionLogSheet.tsx', import.meta.url), 'utf8')

    expect(logSheet).toContain('overflow-hidden overflow-x-hidden overscroll-y-contain')
    expect(logSheet).toContain('overflow-y-auto overflow-x-hidden overscroll-y-contain')
    expect(logSheet).toContain('grid min-w-0 grid-cols-2')
    expect(logSheet).toContain('className="min-w-0"')
    expect(logSheet).toContain('btn-primary min-h-11 min-w-0 flex-1')
  })
  it('uses German umlauts in injection tracker copy', () => {
    const de = readFileSync(new URL('../i18n/locales/de.json', import.meta.url), 'utf8')
    const hero = readFileSync(new URL('../components/injection3d/InjectionTrackerHero.tsx', import.meta.url), 'utf8')
    const tabs = readFileSync(new URL('../components/injection3d/InjectionTrackerTabs.tsx', import.meta.url), 'utf8')
    const tracker = readFileSync(new URL('./InjektionsTracker.tsx', import.meta.url), 'utf8')
    const intro = readFileSync(new URL('../components/injection3d/InjectionIntroSheet.tsx', import.meta.url), 'utf8')
    const logSheet = readFileSync(new URL('../components/injection3d/InjectionLogSheet.tsx', import.meta.url), 'utf8')

    const deJson = JSON.parse(de) as Record<string, string>
    const deValues = Object.entries(deJson)
      .filter(([key]) => key.startsWith('injection_') || key.startsWith('inj_'))
      .map(([, value]) => String(value))
      .join('\n')
    const combined = [deValues, hero, tabs, tracker, intro, logSheet].join('\n')
    expect(combined).toContain('3D-Injektionstracker Pro')
    expect(combined).toContain('Tracke deine Injektionen pr\u00e4zise und einfach auf einem 3D-Torso')
    expect(combined).toContain('3D Tracker \u00f6ffnen')
    expect(combined).toContain('ausw\u00e4hlen')
    expect(combined).toContain('Position \u00fcbernehmen')
    expect(combined).not.toMatch(/Praezises|oeffnen|auswaehlen|uebernehmen|bestaetigt|faellig|Schliessen|schliessen|Zurueck|Rueckwirkend|Aelteste|hinzufuegen|spaeter|gedrueckt|kuerzlichen|fuer|moeglich/)
    expect(combined).not.toMatch(/[\uFFFD\u00c3\u00c2]/)
  })
  it('shows the preselected intake on the map while placing a pin', () => {
    const source = readFileSync(new URL('./InjektionsTracker.tsx', import.meta.url), 'utf8')

    expect(source).toContain('activeTargetIntake')
    expect(source).toContain('injection-selected-intake-chip')
    expect(source).toContain('Ausgew\u00e4hlt')
    expect(source).toContain('activeTargetIntake.stackItemName')
  })

  it('skips cycle/manual selection and the intake list for a fixed target intake', () => {
    const logSheet = readFileSync(new URL('../components/injection3d/InjectionLogSheet.tsx', import.meta.url), 'utf8')

    expect(logSheet).toContain('hasFixedTargetIntake')
    expect(logSheet).toContain('{!hasFixedTargetIntake && (')
    expect(logSheet).toContain("{mode === 'intake' && !hasFixedTargetIntake && (")
    expect(logSheet).toContain('selectedIntakeCard')
  })

  it('adds a camera reset button for the default full-torso view', () => {
    const source = readFileSync(new URL('./InjektionsTracker.tsx', import.meta.url), 'utf8')

    expect(source).toContain('cameraResetRequestId')
    expect(source).toContain('setCameraResetRequestId')
    expect(source).toContain("aria-label={String(t('injection_camera_reset'")
    expect(source).toContain('Minimize2')
    expect(source).not.toContain('<RefreshCw size={17}')
    expect(source).toContain('resetRequestId={cameraResetRequestId}')
  })
})
