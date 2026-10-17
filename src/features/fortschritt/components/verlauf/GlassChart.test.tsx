// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GlassChart, type ChartBand } from './GlassChart'

afterEach(cleanup)
// jsdom kennt Pointer-Capture nicht
HTMLElement.prototype.setPointerCapture ??= () => {}

const range = { from: '2026-01-01', to: '2026-03-01' }
const points = [
  { date: '2026-01-01', value: 90 },
  { date: '2026-01-20', value: 88 },
  { date: '2026-02-10', value: 86 },
  { date: '2026-03-01', value: 84 },
]
const band = (key: string, start: string, end: string | null, name = key): ChartBand => ({
  key, substanceId: key, name, color: '#3987e5', start, end,
})

function renderChart(bands: ChartBand[], onScrub = vi.fn()) {
  const view = render(
    <GlassChart points={points} range={range} color="#f59e0b" bands={bands} newBandSubstance={null} ariaLabel="Gewicht" onScrub={onScrub} />,
  )
  const chart = view.getByRole('img', { name: 'Gewicht' })
  // jsdom misst nichts: Breite = viewBox-Breite, damit Pixel und Diagramm übereinstimmen
  chart.getBoundingClientRect = () => ({ left: 0, top: 0, width: 360, height: 224, right: 360, bottom: 224, x: 0, y: 0, toJSON: () => ({}) })
  return { ...view, chart }
}

const bandRects = (container: HTMLElement) => [...container.querySelectorAll('rect.fg-band')]

describe('GlassChart', () => {
  it('ein Zyklus füllt die ganze Höhe hinter der Kurve', () => {
    const { container } = renderChart([band('a', '2026-01-10', null)])
    const [rect] = bandRects(container)
    expect(Number(rect.getAttribute('height'))).toBeCloseTo(224 - 8 - 26, 0)
  })

  it('parallele Zyklen teilen sich die Höhe — je mehr, desto dünner', () => {
    const { container } = renderChart([
      band('a', '2026-01-05', null),
      band('b', '2026-01-15', '2026-02-20'),
      band('c', '2026-01-25', null),
    ])
    const heights = bandRects(container).map(r => Number(r.getAttribute('height')))
    expect(heights).toHaveLength(3)
    const expected = (224 - 8 - 26 - 2 * 3) / 3
    for (const h of heights) expect(h).toBeCloseTo(expected, 0)
    const ys = new Set(bandRects(container).map(r => r.getAttribute('y')))
    expect(ys.size).toBe(3)
  })

  it('nacheinander laufende Zyklen teilen sich eine Bahn', () => {
    const { container } = renderChart([band('a', '2026-01-02', '2026-01-20'), band('b', '2026-02-01', null)])
    const ys = new Set(bandRects(container).map(r => r.getAttribute('y')))
    expect(ys.size).toBe(1)
  })

  it('markiert Starts im Zeitraum mit Linie und Punkt, Starts davor nicht', () => {
    const { container } = renderChart([band('in', '2026-02-01', null), band('before', '2025-11-01', null)])
    expect(container.querySelectorAll('circle[r="4"]')).toHaveLength(1)
  })

  it('Ablesen rastet am Zyklusstart ein und meldet ihn', () => {
    const onScrub = vi.fn()
    const { chart } = renderChart([band('bpc', '2026-01-31', null, 'BPC-157')], onScrub)
    // 2026-01-31 liegt bei 30/59 der Zeichenbreite (324 px); 3 px daneben antippen
    const x = (30 / 59) * 324 + 3
    fireEvent.pointerDown(chart, { clientX: x, pointerId: 1, pointerType: 'touch' })
    expect(onScrub).toHaveBeenLastCalledWith(expect.objectContaining({ startOf: 'BPC-157', date: '2026-01-31' }))
    fireEvent.pointerUp(chart, { pointerId: 1 })
    expect(onScrub).toHaveBeenLastCalledWith(null)
  })

  it('ohne Start in der Nähe zeigt Ablesen den nächsten Messpunkt', () => {
    const onScrub = vi.fn()
    const { chart } = renderChart([], onScrub)
    fireEvent.pointerDown(chart, { clientX: 324, pointerId: 1, pointerType: 'touch' })
    expect(onScrub).toHaveBeenLastCalledWith({ index: 3, startOf: null, date: '2026-03-01' })
  })
})
