import { describe, expect, it } from 'vitest'
import { inWochenfolge, rhythmFromStorage } from './intakeRhythm'

describe('inWochenfolge', () => {
  it('ordnet Wochentage nach der Woche, nicht nach dem Antippen', () => {
    expect(inWochenfolge(['Fr', 'Mo'])).toEqual(['Mo', 'Fr'])
    expect(inWochenfolge(['So', 'x', 'Di'])).toEqual(['Di', 'So', 'x'])
  })

  it('gespeicherte Tage bleiben, wie sie sind — sonst saehe ein unveraenderter Plan geaendert aus', () => {
    const rhythmus = rhythmFromStorage({ frequency: 'Wochentage wählen', schedule_days: ['Fr', 'Mo'] } as never)
    expect(rhythmus.kind === 'weekdays' && rhythmus.weekdays).toEqual(['Fr', 'Mo'])
  })
})
