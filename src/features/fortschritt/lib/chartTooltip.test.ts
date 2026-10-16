import { describe, expect, it } from 'vitest'
import {
  buildSnapAnchors,
  buildTooltipSnapDates,
  cycleStartsAtHover,
  metricValueAtDate,
  nearestVisibleMetricPoint,
  nearestSnapHoverDate,
  resolveChartTooltipContent,
  resolveFluidChartHover,
  resolveFluidCursorX,
  resolveTooltipCycleStarts,
  usesReducedMetricPoints,
} from './chartTooltip'

describe('chartTooltip', () => {
  const bands = [
    { id: 'a', startDate: '2026-01-23', x1: Date.parse('2026-01-23T12:00:00'), startVisible: true },
    { id: 'b', startDate: '2026-01-23', x1: Date.parse('2026-01-23T12:00:00'), startVisible: true },
    { id: 'c', startDate: '2026-04-12', x1: Date.parse('2026-04-12T12:00:00'), startVisible: true },
  ]

  const chartData = [
    { date: '2026-02-15', ts: Date.parse('2026-02-15T12:00:00'), value: 87 },
    { date: '2026-04-12', ts: Date.parse('2026-04-12T12:00:00'), value: 84 },
  ]

  it('finds overlapping cycle starts on the same day', () => {
    const starts = cycleStartsAtHover(bands, '2026-01-23')
    expect(starts.map(s => s.id)).toEqual(['a', 'b'])
  })

  it('resolves cursor date from inverse scale', () => {
    const aprilTs = Date.parse('2026-04-12T12:00:00')
    const xScale = (value: number) => {
      if (value === aprilTs) return 130
      return 0
    }
    const snap = nearestSnapHoverDate(130, ['2026-04-12'], xScale)
    expect(snap?.dateIso).toBe('2026-04-12')
  })

  it('reads metric value for cursor date, not another day', () => {
    expect(metricValueAtDate(chartData, '2026-04-12')).toBe(84)
    expect(metricValueAtDate(chartData, '2026-02-15')).toBe(87)
  })

  it('tooltip cycle starts use only the cursor date', () => {
    const starts = resolveTooltipCycleStarts(bands, '2026-04-12')
    expect(starts.map(s => s.id)).toEqual(['c'])
  })

  it('shows metric and cycle start together only on the same date', () => {
    const content = resolveChartTooltipContent({
      hoverDateIso: '2026-04-12',
      bands,
      metricData: chartData,
    })

    expect(content?.dateIso).toBe('2026-04-12')
    expect(content?.metricValue).toBe(84)
    expect(content?.starts.map(s => s.id)).toEqual(['c'])
  })

  it('does not mix metric from another day with cycle starts', () => {
    const content = resolveChartTooltipContent({
      hoverDateIso: '2026-01-23',
      bands,
      metricData: chartData,
    })

    expect(content?.dateIso).toBe('2026-01-23')
    expect(content?.metricValue).toBeNull()
    expect(content?.starts.map(s => s.id)).toEqual(['a', 'b'])
  })

  it('shows only the metric when no cycles start on that day', () => {
    const content = resolveChartTooltipContent({
      hoverDateIso: '2026-02-15',
      bands,
      metricData: chartData,
    })

    expect(content?.metricValue).toBe(87)
    expect(content?.starts).toEqual([])
  })

  it('merges metric dates with visible cycle start dates', () => {
    const dates = buildTooltipSnapDates(
      ['2026-02-15', '2026-04-12'],
      [
        { startDate: '2026-01-23', startVisible: true },
        { startDate: '2026-04-12', startVisible: true },
      ],
    )
    expect(dates).toEqual(['2026-01-23', '2026-02-15', '2026-04-12'])
  })

  it('nimmt Zyklus-Starts ausserhalb des Fensters nicht als Einrast-Punkt', () => {
    const dates = buildTooltipSnapDates(
      ['2026-03-05'],
      [
        // Zyklus begann im Januar, das Fenster startet erst im Maerz.
        { startDate: '2026-01-01', startVisible: false },
        { startDate: '2026-03-10', startVisible: true },
      ],
    )
    expect(dates).toEqual(['2026-03-05', '2026-03-10'])
  })

  it('zaehlt einen aufs Fenster geklemmten Balkenanfang nicht als Zyklus-Start', () => {
    // Zyklus lief seit Januar; beim Wischen liegt sein Balkenanfang auf dem
    // linken Fensterrand (01.03.) — dort beginnt aber kein Zyklus.
    const clamped = [{
      id: 'alt',
      startDate: '2026-01-01',
      x1: Date.parse('2026-03-01T12:00:00'),
      startVisible: false,
    }]
    expect(cycleStartsAtHover(clamped, '2026-03-01')).toEqual([])
    expect(resolveTooltipCycleStarts(clamped, '2026-03-01')).toEqual([])
  })

  it('uebernimmt die Skala-Pixel unveraendert als Anker', () => {
    // Die Recharts-Achsenskala hat die Range [offset.left, offset.left + width],
    // liefert also bereits absolute Pixel. Wer plotArea.x addiert, zaehlt den
    // Plot-Offset doppelt und schiebt alle Anker nach rechts.
    const febTs = Date.parse('2026-02-15T12:00:00')
    const xScale = (value: number) => (value === febTs ? 54 : 0)
    const anchors = buildSnapAnchors(['2026-02-15'], xScale)
    expect(anchors[0].x).toBe(54)
  })

  it('keeps cursor free far from anchors and blends near snap points', () => {
    const xScale = (value: number) => {
      if (value === Date.parse('2026-02-15T12:00:00')) return 50
      if (value === Date.parse('2026-04-12T12:00:00')) return 130
      return 0
    }
    const anchors = buildSnapAnchors(['2026-02-15', '2026-04-12'], xScale)

    const free = resolveFluidCursorX(95, anchors)
    expect(free.x).toBe(95)
    expect(free.snapStrength).toBe(0)

    const snapped = resolveFluidCursorX(58, anchors)
    expect(snapped.x).toBeGreaterThan(50)
    expect(snapped.x).toBeLessThan(58)
    expect(snapped.snapStrength).toBeGreaterThan(0)
  })

  it('resolves fluid hover with inverse scale between snap points', () => {
    const febTs = Date.parse('2026-02-15T12:00:00')
    const aprilTs = Date.parse('2026-04-12T12:00:00')
    const xScale = (value: number) => {
      if (value === febTs) return 50
      if (value === aprilTs) return 130
      return 0
    }
    const xInverseScale = (pixelX: number) => febTs + ((pixelX - 50) / 80) * (aprilTs - febTs)
    const hover = resolveFluidChartHover(
      95,
      ['2026-02-15', '2026-04-12'],
      xScale,
      xInverseScale,
    )

    expect(hover?.fluidX).toBe(95)
    expect(hover?.snapStrength).toBe(0)
    expect(hover?.dateIso).toMatch(/^2026-03/)
  })

  it('snaps hover to nearest cycle or metric date by pixel distance', () => {
    const aprilTs = Date.parse('2026-04-12T12:00:00')
    const febTs = Date.parse('2026-02-15T12:00:00')
    const xScale = (value: number) => {
      if (value === aprilTs) return 130
      if (value === febTs) return 50
      return 0
    }
    const snap = nearestSnapHoverDate(55, ['2026-02-15', '2026-04-12'], xScale)
    expect(snap?.dateIso).toBe('2026-02-15')
  })

  it('uses reduced points only for weight and body fat in 3m', () => {
    const DAY = 24 * 3_600_000
    expect(usesReducedMetricPoints('weight', 90 * DAY)).toBe(true)
    expect(usesReducedMetricPoints('body_fat', 90 * DAY)).toBe(true)
    expect(usesReducedMetricPoints('weight', 30 * DAY)).toBe(false)
    expect(usesReducedMetricPoints('body_fat', 30 * DAY)).toBe(false)
    expect(usesReducedMetricPoints('Vitamin D', 90 * DAY)).toBe(false)
  })

  describe('nearest visible metric point', () => {
    const points = [
      { date: '2026-04-01', ts: Date.parse('2026-04-01T12:00:00'), value: 90 },
      { date: '2026-04-10', ts: Date.parse('2026-04-10T12:00:00'), value: 88 },
      { date: '2026-04-20', ts: Date.parse('2026-04-20T12:00:00'), value: 86 },
    ]

    it('selects the nearest real point without interpolation', () => {
      const result = nearestVisibleMetricPoint(
        points,
        Date.parse('2026-04-17T12:00:00'),
        Date.parse('2026-04-01T12:00:00'),
        Date.parse('2026-04-30T12:00:00'),
      )
      expect(result).toEqual(points[2])
    })

    it('selects the older point when distances are equal', () => {
      const result = nearestVisibleMetricPoint(
        points.slice(0, 2),
        Date.parse('2026-04-06T00:00:00'),
        Date.parse('2026-04-01T12:00:00'),
        Date.parse('2026-04-10T12:00:00'),
      )
      expect(result).toEqual(points[0])
    })

    it('ignores points outside the visible window', () => {
      const result = nearestVisibleMetricPoint(
        points,
        Date.parse('2026-04-11T12:00:00'),
        Date.parse('2026-04-15T12:00:00'),
        Date.parse('2026-04-30T12:00:00'),
      )
      expect(result).toEqual(points[2])
    })

    it('returns null when the visible window has no valid points', () => {
      expect(nearestVisibleMetricPoint(
        points,
        Date.parse('2026-05-10T12:00:00'),
        Date.parse('2026-05-01T12:00:00'),
        Date.parse('2026-05-31T12:00:00'),
      )).toBeNull()
    })
  })
  it('returns the nearest visible real metric point in reduced mode', () => {
    const metricData = [
      { date: '2026-04-10', ts: Date.parse('2026-04-10T12:00:00'), value: 88 },
      { date: '2026-04-20', ts: Date.parse('2026-04-20T12:00:00'), value: 86 },
    ]
    const content = resolveChartTooltipContent({
      hoverDateIso: '2026-04-18',
      hoverTs: Date.parse('2026-04-18T12:00:00'),
      bands: [],
      metricData,
      nearestMetric: true,
      viewStart: Date.parse('2026-04-01T12:00:00'),
      viewEnd: Date.parse('2026-04-30T12:00:00'),
    })

    expect(content?.dateIso).toBe('2026-04-18')
    expect(content?.metricDateIso).toBe('2026-04-20')
    expect(content?.metricTs).toBe(metricData[1].ts)
    expect(content?.metricValue).toBe(86)
  })

  it('keeps cycle hover date while exposing a different real metric date', () => {
    const content = resolveChartTooltipContent({
      hoverDateIso: '2026-04-12',
      hoverTs: Date.parse('2026-04-12T12:00:00'),
      bands: [{
        id: 'cycle',
        startDate: '2026-04-12',
        x1: Date.parse('2026-04-12T12:00:00'),
        startVisible: true,
      }],
      metricData: [{
        date: '2026-04-10',
        ts: Date.parse('2026-04-10T12:00:00'),
        value: 88,
      }],
      nearestMetric: true,
      viewStart: Date.parse('2026-04-01T12:00:00'),
      viewEnd: Date.parse('2026-04-30T12:00:00'),
    })

    expect(content?.dateIso).toBe('2026-04-12')
    expect(content?.metricDateIso).toBe('2026-04-10')
    expect(content?.starts.map(start => start.id)).toEqual(['cycle'])
  })
})
