import { useState } from 'react'
import { BookHeart, Plus, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SymptomChip } from '../../../pages/tagebuch/SymptomChip'
import { chipLabel, kindColor, symptomByKey, type SymptomKind } from '../../../pages/tagebuch/chips'
import { useVorschauHoku } from '../MockupApp'

/**
 * Tagebuch wie in der App (pages/Tagebuch.tsx): Liste mit Chips je Eintrag,
 * „Neu" öffnet ein Blatt mit Chips zum Antippen. Beispieldaten im Gerät.
 */
interface Chip { key: string; kind: SymptomKind; severity: number; dauer?: string }
interface Eintrag { id: number; titel: 'tagebuch_beschreibung_1' | 'tagebuch_beschreibung_2' | 'tagebuch_beschreibung_neu'; wann: 'tagebuch_heute' | 'tagebuch_gestern'; zeit: string; chips: Chip[] }
const AUSWAHL = ['more_energy', 'better_focus', 'slept_better', 'faster_recovery', 'less_hunger', 'less_joint_pain'] as const
const AUSWAHL_NW = ['redness', 'nausea', 'headache', 'fatigue', 'bloating', 'itching'] as const
const START: Eintrag[] = [
  { id: 1, titel: 'tagebuch_beschreibung_1', wann: 'tagebuch_heute', zeit: '10:12', chips: [{ key: 'more_energy', kind: 'effect', severity: 4, dauer: '3 h' }, { key: 'better_focus', kind: 'effect', severity: 3 }] },
  { id: 2, titel: 'tagebuch_beschreibung_2', wann: 'tagebuch_gestern', zeit: '21:40', chips: [{ key: 'faster_recovery', kind: 'effect', severity: 4 }, { key: 'nausea', kind: 'side_effect', severity: 2, dauer: '30 min' }] },
]

export function TagebuchScreen() {
  const { t, i18n } = useTranslation()
  const hoku = useVorschauHoku()
  const lang = i18n.language ?? 'de'
  const [eintraege, setEintraege] = useState(START)
  const [filter, setFilter] = useState<'all' | 'effect' | 'side_effect'>('all')
  const [offen, setOffen] = useState(false)
  const [gewaehlt, setGewaehlt] = useState<Chip[]>([])
  const label = (key: string) => chipLabel({ key, customLabel: null }, lang)
  const kindVon = (key: string): SymptomKind => symptomByKey(key)?.kind ?? 'effect'

  const umschalten = (key: string) => {
    setGewaehlt(g => (g.some(c => c.key === key) ? g.filter(c => c.key !== key) : [...g, { key, kind: kindVon(key), severity: 3 }]))
  }
  const speichern = () => {
    if (!gewaehlt.length) return
    setEintraege(e => [{ id: Date.now(), titel: 'tagebuch_beschreibung_neu', wann: 'tagebuch_heute', zeit: `${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2, '0')}`, chips: gewaehlt }, ...e])
    setGewaehlt([]); setOffen(false)
    window.setTimeout(() => hoku.freude('tagebuch_gespeichert'), 350)
  }
  const sichtbar = eintraege.map(e => ({ ...e, chips: e.chips.filter(c => filter === 'all' || c.kind === filter) })).filter(e => e.chips.length)

  return (
    <>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 4px' }}>
        <h1 style={{ margin: 0, fontSize: 34, lineHeight: '41px', fontWeight: 700, letterSpacing: '0.011em', color: 'var(--text)' }}>{hoku.t('tagebuch_titel')}</h1>
        <button type="button" className="lg-btn-primary lg-press" onClick={() => setOffen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 16px', borderRadius: 999, border: 0, font: 'inherit', fontSize: 16, fontWeight: 700 }}>
          <Plus size={18} strokeWidth={2.4} /> {hoku.t('tagebuch_neu')}
        </button>
      </header>
      <div className="lg-seg" data-equal="true" style={{ display: 'flex', padding: 3, borderRadius: 999, background: 'var(--lg-fill)' }}>
        {(['tagebuch_liste', 'tagebuch_auswertung'] as const).map((k, i) => (
          <button key={k} type="button" aria-pressed={i === 0} style={{ flex: 1, minHeight: 36, border: 0, borderRadius: 999, font: 'inherit', fontSize: 15, fontWeight: 600, background: i === 0 ? 'var(--lg-fill-selected)' : 'transparent', color: i === 0 ? 'var(--lg-text)' : 'var(--lg-text-2)' }}>{hoku.t(k)}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', margin: '-6px 0 -4px' }}>
        {([['all', 'tagebuch_alle'], ['effect', 'tagebuch_wirkungen'], ['side_effect', 'tagebuch_nebenwirkungen']] as const).map(([val, k]) => (
          <button key={val} type="button" aria-pressed={filter === val} onClick={() => setFilter(val)}
            style={{ flexShrink: 0, minHeight: 36, padding: '0 14px', border: 0, borderRadius: 999, font: 'inherit', fontSize: 14, fontWeight: 500, background: filter === val ? 'var(--lg-fill-selected)' : 'var(--lg-fill)', color: filter === val ? 'var(--lg-text)' : 'var(--lg-text-2)' }}>
            {hoku.t(k)}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} aria-hidden="true" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--lg-text-3)' }} />
          <input type="search" readOnly placeholder={hoku.t('tagebuch_suchen')} aria-label={hoku.t('tagebuch_suchen')}
            style={{ width: '100%', minHeight: 44, borderRadius: 999, border: 0, background: 'var(--lg-fill)', padding: '10px 16px 10px 40px', font: 'inherit', fontSize: 16, color: 'var(--lg-text)', outline: 'none' }} />
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 14px', borderRadius: 999, background: 'var(--lg-fill)', fontSize: 15, color: 'var(--lg-text)' }}>{hoku.t('tagebuch_neueste')} ⌄</span>
      </div>

      {sichtbar.length === 0 && (
        <div className="lg-surface lg-flat" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--lg-text-2)' }}>
          <BookHeart size={30} aria-hidden="true" style={{ margin: '0 auto 8px', color: 'var(--lg-text-3)' }} />
          <p style={{ margin: 0 }}>{t('noch_keine_eintraege', { defaultValue: 'Noch keine Einträge' })}</p>
        </div>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sichtbar.map(e => (
          <li key={e.id} className="lg-surface lg-flat" style={{ borderRadius: 22, padding: '14px 16px' }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--lg-text)' }}>{hoku.t(e.titel)}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', marginTop: 4, fontSize: 13, color: 'var(--lg-text-2)' }}>
              <span>{hoku.t(e.wann)}, {e.zeit}</span>
              <span style={{ color: 'var(--lg-accent-text, var(--accent))' }}>BPC-157</span>
              <span>{hoku.t('tagebuch_nach')}</span>
            </div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(['effect', 'side_effect'] as const).map(kind => {
                const chips = e.chips.filter(c => c.kind === kind)
                if (!chips.length) return null
                return (
                  <div key={kind}>
                    <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: kindColor(kind) }}>{hoku.t(kind === 'effect' ? 'tagebuch_wirkungen' : 'tagebuch_nebenwirkungen')}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {chips.map(c => <SymptomChip key={c.key} small selected kind={c.kind} label={label(c.key)} iconKey={c.key} severity={c.severity} duration={c.dauer} />)}
                    </div>
                  </div>
                )
              })}
            </div>
          </li>
        ))}
      </ul>

      {offen && (
        <div data-app-modal role="dialog" aria-label={hoku.t('tagebuch_neu')} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.55)' }} onClick={() => setOffen(false)}>
          <div className="lg-sheet" onClick={e => e.stopPropagation()} style={{ background: 'var(--lg-sheet-solid, #141416)', borderRadius: '28px 28px 0 0', padding: '14px 18px 28px', boxShadow: '0 -16px 48px rgba(0,0,0,0.55)' }}>
            <div aria-hidden="true" style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--lg-fill-selected)', margin: '0 auto 14px' }} />
            <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 700, color: 'var(--lg-text)' }}>{hoku.t('tagebuch_frage')}</h2>
            {([['tagebuch_wirkungen', AUSWAHL], ['tagebuch_nebenwirkungen', AUSWAHL_NW]] as const).map(([k, keys]) => (
              <div key={k} style={{ marginBottom: 14 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: kindColor(k === 'tagebuch_wirkungen' ? 'effect' : 'side_effect') }}>{hoku.t(k)}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {keys.map(key => {
                    const c = gewaehlt.find(g => g.key === key)
                    return <SymptomChip key={key} kind={kindVon(key)} label={label(key)} iconKey={key} selected={!!c} severity={c?.severity} onClick={() => umschalten(key)} />
                  })}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button type="button" className="lg-press" onClick={() => setOffen(false)} style={{ flex: 1, minHeight: 48, borderRadius: 14, border: 0, background: 'var(--lg-fill)', color: 'var(--lg-text)', font: 'inherit', fontSize: 16, fontWeight: 600 }}>{hoku.t('tagebuch_abbrechen')}</button>
              <button type="button" className="lg-btn-primary lg-press" disabled={!gewaehlt.length} onClick={speichern} style={{ flex: 1, minHeight: 48, borderRadius: 14, border: 0, font: 'inherit', fontSize: 16, fontWeight: 700, opacity: gewaehlt.length ? 1 : 0.5 }}>{hoku.t('tagebuch_speichern')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
