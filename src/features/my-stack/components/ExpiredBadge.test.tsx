// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExpiredBadge } from './ExpiredBadge'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const werte = Object.entries(options ?? {}).map(([name, wert]) => `${name}=${String(wert)}`)
      return werte.length > 0 ? `${key}(${werte.join(',')})` : key
    },
  }),
}))

afterEach(cleanup)

const css = readFileSync(resolve(__dirname, '../../../index.css'), 'utf8')
const block = css.slice(css.indexOf('/* ── Abgelaufen-Abzeichen'), css.indexOf('/* ═══'))

describe('ExpiredBadge', () => {
  it('schreibt den ganzen Satz aus — heute, ein Tag, mehrere Tage', () => {
    const { rerender } = render(<ExpiredBadge daysSince={3} />)
    expect(screen.getByText('my_stack_expired_full_days(n=3)')).toBeTruthy()
    rerender(<ExpiredBadge daysSince={1} />)
    expect(screen.getByText('my_stack_expired_full_day')).toBeTruthy()
    rerender(<ExpiredBadge daysSince={0} />)
    expect(screen.getByText('my_stack_expired_full_today')).toBeTruthy()
  })

  it('still: ohne Rahmen und Flaeche, alarmieren tut nur das Symbol', () => {
    render(<ExpiredBadge daysSince={3} />)
    const abzeichen = document.querySelector<HTMLElement>('[data-expired-badge]')!
    expect(abzeichen.className).not.toMatch(/\bborder\b|\bbg-|rounded|tyd-expired-badge/)
    expect(document.querySelector('svg')!.getAttribute('class')).toContain('tyd-expired-icon')
  })

  it('das Symbol blinkt endlos, bei weniger Bewegung steht es still', () => {
    expect(block).toMatch(/\.tyd-expired-icon\s*\{\s*animation:[^;]*\b6s\b[^;]*\binfinite\b/)
    const reduziert = block.slice(block.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduziert).toMatch(/\.tyd-expired-icon,\s*\.tyd-alarm-knopf,[^{]*\{ animation: none !important; \}/)
  })
})

describe('ExpiredBadge im Wechsel (Karussell)', () => {
  const regeln = (selektor: string) => {
    const treffer = block.match(new RegExp(`${selektor.replace(/[.:]/g, m => `\\${m}`)}\\s*\\{([^}]*)\\}`))
    return treffer?.[1] ?? ''
  }

  it('Abzeichen mit Rand; „Abgelaufen!" und „seit n Tagen" uebereinander, damit nichts springt', () => {
    render(<ExpiredBadge daysSince={3} variante="wechsel" />)
    const abzeichen = document.querySelector<HTMLElement>('[data-expired-badge="wechsel"]')!
    expect(abzeichen.className).toContain('tyd-expired-badge')
    expect(abzeichen.className).toMatch(/\bborder\b/)
    const alarm = screen.getByText('my_stack_expired')
    const seit = screen.getByText('my_stack_expired_since_days(n=3)')
    expect(alarm.className).toContain('tyd-expired-text-alarm')
    expect(seit.className).toContain('tyd-expired-text-since')
    expect(alarm.className).toContain('row-start-1')
    expect(seit.className).toContain('row-start-1')
  })

  it('alle Teile laufen im selben endlosen 6-Sekunden-Takt, der zweite Text um einen halben versetzt', () => {
    for (const teil of ['.tyd-expired-badge::after', '.tyd-expired-icon', '.tyd-expired-text-alarm', '.tyd-expired-text-since']) {
      expect(regeln(teil), teil).toMatch(/animation:[^;]*\b6s\b[^;]*\binfinite\b/)
    }
    expect(regeln('.tyd-expired-text-since')).toMatch(/tyd-expired-text [^;]*-3s/)
  })

  it('bei weniger Bewegung steht still „seit n Tagen"', () => {
    const reduziert = block.slice(block.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduziert).toContain('.tyd-expired-text-alarm { display: none !important; }')
    expect(reduziert).toContain('.tyd-expired-text-since { opacity: 1 !important; transform: none !important; }')
  })

  it('liest beides zusammen vor; heute und ein Tag in eigenen Worten', () => {
    const { unmount } = render(<ExpiredBadge daysSince={3} variante="wechsel" />)
    expect(screen.getByText('my_stack_expired_aria(since=my_stack_expired_since_days(n=3))').className).toContain('sr-only')
    unmount()
    const zweit = render(<ExpiredBadge daysSince={0} variante="wechsel" />)
    expect(screen.getByText('my_stack_expired_since_today')).toBeTruthy()
    zweit.unmount()
    render(<ExpiredBadge daysSince={1} variante="wechsel" />)
    expect(screen.getByText('my_stack_expired_since_day')).toBeTruthy()
  })
})
