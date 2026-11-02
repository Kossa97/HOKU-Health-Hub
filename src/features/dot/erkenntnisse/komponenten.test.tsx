// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Fund } from '../../../../supabase/functions/_shared/erkenntnisse/typen.ts'
import type { GespeicherterFund, Woche } from './erkenntnisseService'
import { FundDetail } from './FundDetail'
import { FundKarte } from './FundKarte'
import { WochenKarte } from './WochenKarte'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'de', resolvedLanguage: 'de' }, t: (key: string) => key }),
}))

afterEach(cleanup)

const namen = { uebung: () => 'Kniebeuge' }
const h1: Fund = {
  id: 'H1', schluessel: 'H1:vor_grenze', bezug: null, richtung: 'neutral', datenlage: 'deutlich', staerke: 0.5,
  zeitraum: { von: '2026-09-21', bis: '2026-11-01' },
  werte: { gruppe_a: 'vor_grenze', gruppe_b: 'ab_grenze', mittel_a: 431, mittel_b: 381, n_a: 11, n_b: 9, differenz: 50, einheit: 'min', grenze: 21 },
}
const t7: Fund = {
  id: 'T7', schluessel: 'T7:tagebuch:14', bezug: null, richtung: 'positiv', datenlage: 'deutlich', staerke: 0.6,
  zeitraum: { von: '2026-10-19', bis: '2026-11-01' }, werte: { tage: 14 },
}
const fH1: GespeicherterFund = { id: 'f1', fund: h1, datenlage: 'deutlich' }
const fT7: GespeicherterFund = { id: 'f2', fund: t7, datenlage: 'hinweis' }
const woche = (funde: GespeicherterFund[]): Woche => ({ woche: '2026-11-01', tageEingeflossen: 6, gelesen: false, funde })

describe('WochenKarte', () => {
  it('ohne Funde: ehrliche Zeile mit der Zahl der Tage', () => {
    render(<WochenKarte woche={woche([])} funde={[]} namen={namen} onOeffnen={() => {}} />)
    expect(screen.getByText('Diese Woche nichts Neues. 6 Tage deiner Daten sind eingeflossen.')).toBeTruthy()
  })

  it('mit Funden: zeigt ihre Sätze, Tippen öffnet den Fund', () => {
    const onOeffnen = vi.fn()
    render(<WochenKarte woche={woche([fH1, fT7])} funde={[fH1, fT7]} namen={namen} onOeffnen={onOeffnen} />)
    expect(screen.getByText('Wenn du vor 21 Uhr trainierst, schläfst du in der Nacht danach im Schnitt 50 min länger.')).toBeTruthy()
    expect(screen.getByText('14 Tage am Stück Tagebuch geführt.')).toBeTruthy()
    expect(screen.queryByText(/nichts Neues/)).toBeNull()
    fireEvent.click(screen.getByText('14 Tage am Stück Tagebuch geführt.'))
    expect(onOeffnen).toHaveBeenCalledWith(fT7)
  })
})

describe('FundKarte', () => {
  it('zeigt Titel und Satz, Tippen öffnet', () => {
    const onOeffnen = vi.fn()
    render(<FundKarte eintrag={fH1} namen={namen} onOeffnen={onOeffnen} />)
    expect(screen.getByText('Schlaf und Trainingszeit')).toBeTruthy()
    fireEvent.click(screen.getByRole('button'))
    expect(onOeffnen).toHaveBeenCalledTimes(1)
  })
})

describe('FundDetail', () => {
  it('zeigt Satz, Beleg und Zeitraum; „Nicht hilfreich" ruft den Handler', () => {
    const onNichtHilfreich = vi.fn()
    render(<FundDetail eintrag={fH1} namen={namen} onNichtHilfreich={onNichtHilfreich} onSchliessen={() => {}} />)
    expect(screen.getByText('Wenn du vor 21 Uhr trainierst, schläfst du in der Nacht danach im Schnitt 50 min länger.')).toBeTruthy()
    expect(screen.getByText('11 gegen 9 Trainingstage, 431 gegen 381 min. Zusammenhang, kein Beweis.')).toBeTruthy()
    expect(screen.getByText(/21\. Sept?\.? 2026 – 1\. Nov\.? 2026/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Nicht hilfreich' }))
    expect(onNichtHilfreich).toHaveBeenCalledTimes(1)
  })
})
