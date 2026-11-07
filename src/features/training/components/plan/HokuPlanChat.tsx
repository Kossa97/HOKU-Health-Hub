import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUp, Mic, Square } from 'lucide-react'
import { useAuth } from '../../../../context/AuthContext'
import { useDotText } from '../../../dot/texte'
import { frageCoach, setzeCoachEinwilligung, type CoachFehler, type CoachNachricht } from '../../../dot/chat/coachService'
import { useSpracheingabe, type SpracheFehler } from '../../../dot/chat/useSpracheingabe'
import { useTrainingText } from '../../i18n'
import type { TrainingData } from '../../hooks/useTrainingData'
import { trainingKontext, type HokuPlan } from '../../lib/hokuPlan'
import { Button, TrainingSheet } from '../ui'
import { HokuPlanPreview } from './HokuPlanPreview'

/**
 * „Plan mit Hoku": ein kleines Gespräch nur fürs Training. Tippen oder
 * sprechen (Spracherkennung des Geräts); Hoku fragt höchstens kurz nach und
 * entwirft dann einen Plan (`plan_entwerfen` in der Edge Function `coach`).
 * Der Entwurf öffnet sich als Vorschau; gespeichert wird erst dort. An Hoku
 * gehen nur der Übungskatalog, die Namen der vorhandenen Pläne und der
 * aktuelle Entwurf — keine Verlaufs- oder Gesundheitsdaten.
 */

const FEHLER: Record<CoachFehler, 'chat_fehler' | 'chat_kein_zugang' | 'chat_grenze' | 'chat_offline'> = {
  consent_required: 'chat_fehler', no_access: 'chat_kein_zugang', limit_reached: 'chat_grenze', offline: 'chat_offline', server_error: 'chat_fehler',
}

export function HokuPlanChat({ data, onClose, onSaved }: {
  data: TrainingData
  onClose: () => void
  onSaved: (planName: string) => void
}) {
  const { tt, lang } = useTrainingText()
  const { dt } = useDotText()
  const { user } = useAuth()
  const [verlauf, setVerlauf] = useState<CoachNachricht[]>([])
  const [eingabe, setEingabe] = useState('')
  const [denkt, setDenkt] = useState(false)
  const [einwilligung, setEinwilligung] = useState(false)
  const [entwurf, setEntwurf] = useState<HokuPlan | null>(null)
  const [vorschau, setVorschau] = useState(false)
  const faden = useRef<HTMLDivElement>(null)
  const arbeitet = useRef(false)

  useEffect(() => { faden.current?.scrollTo({ top: faden.current.scrollHeight }) }, [verlauf, denkt])

  const planNamen = [...new Set(data.routines.map(r => r.folder).filter((f): f is string => !!f)), ...data.plans.map(p => p.name)]

  async function fragen(text: string) {
    const frage = text.trim()
    if (!frage || arbeitet.current || !user) return
    arbeitet.current = true
    setEingabe('')
    const neu: CoachNachricht[] = [...verlauf, { rolle: 'ich', text: frage }]
    setVerlauf(neu)
    setDenkt(true)
    const kontext = {
      training: trainingKontext(lang, data.customExercises, planNamen, data.settings.unit),
      ...(entwurf ? { aktueller_entwurf: entwurf } : {}),
    }
    const antwort = await frageCoach(neu, kontext, 'training', lang)
    setDenkt(false)
    arbeitet.current = false
    if (!antwort.ok) {
      if (antwort.fehler === 'consent_required') { setEinwilligung(true); setVerlauf(neu.slice(0, -1)); setEingabe(frage); return }
      setVerlauf(v => [...v, { rolle: 'dot', text: dt(FEHLER[antwort.fehler]), lokal: true }])
      return
    }
    const plan = antwort.plaene[0]
    setVerlauf(v => [
      ...v,
      ...(antwort.text ? [{ rolle: 'dot' as const, text: antwort.text }] : []),
      ...(plan ? [{ rolle: 'dot' as const, text: dt('plan_vorbereitet', { name: plan.name, anzahl: plan.workouts.length }), plan }] : []),
    ])
    if (plan) { setEntwurf(plan); setVorschau(true) }
  }

  const sprache = useSpracheingabe(lang, text => { void fragen(text) }, (f: SpracheFehler) => {
    const key = f === 'verweigert' ? 'mikro_verweigert' : f === 'nichts' ? 'mikro_nichts' : 'mikro_fehler'
    setVerlauf(v => [...v, { rolle: 'dot', text: dt(key), lokal: true }])
  })

  async function zustimmen() {
    if (!user) return
    try {
      await setzeCoachEinwilligung(user.id, true)
      setEinwilligung(false)
      if (eingabe.trim()) void fragen(eingabe)
    } catch {
      setVerlauf(v => [...v, { rolle: 'dot', text: dt('einw_fehler'), lokal: true }])
    }
  }

  if (vorschau && entwurf) {
    return (
      <HokuPlanPreview
        data={data}
        plan={entwurf}
        onClose={() => setVorschau(false)}
        onSaved={onSaved}
        onAskChange={aktuell => { setEntwurf(aktuell); setVorschau(false) }}
      />
    )
  }

  const hatText = eingabe.trim().length > 0 && !sprache.hoert

  return (
    <TrainingSheet title={tt('hoku_title')} onClose={onClose} tall busy={denkt}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: '100%' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--lg-text-3)' }}>{tt('hoku_not_saved')}</p>
        <div ref={faden} role="log" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          <Bubble hoku>{tt('hoku_intro')}</Bubble>
          {verlauf.map((n, i) => (
            <Bubble key={i} hoku={n.rolle === 'dot'}>
              {n.text}
              {n.plan && (
                <button type="button" onClick={() => { setEntwurf(n.plan!); setVorschau(true) }} className="tyd-train-press" style={{ display: 'block', marginTop: 8, minHeight: 36, padding: '0 14px', borderRadius: 18, background: 'var(--accent)', color: 'var(--accent-contrast)', fontWeight: 700, fontSize: 14 }}>
                  {tt('hoku_show_plan')}
                </button>
              )}
            </Bubble>
          ))}
          {denkt && <p style={{ margin: 0, fontSize: 14, color: 'var(--lg-text-3)' }}>{tt('hoku_thinking')}</p>}
        </div>

        {einwilligung && (
          <div role="dialog" aria-label={dt('einw_titel')} style={{ borderRadius: 16, background: 'var(--lg-surface-2)', border: '1px solid var(--lg-separator)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <strong>{dt('einw_titel')}</strong>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: 'var(--lg-text-2)' }}>{tt('hoku_consent_needed')} {dt('einw_text')}</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.5, color: 'var(--lg-text-3)' }}>
              <li>{dt('einw_punkt_1')}</li><li>{dt('einw_punkt_2')}</li><li>{dt('einw_punkt_3')}</li>
            </ul>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => { void zustimmen() }} style={{ flex: 1 }}>{dt('einw_ja')}</Button>
              <Button tone="ghost" onClick={() => setEinwilligung(false)} style={{ flex: 1 }}>{dt('einw_nein')}</Button>
            </div>
          </div>
        )}

        <form
          onSubmit={e => { e.preventDefault(); void fragen(eingabe) }}
          style={{ position: 'sticky', bottom: 0, display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0 4px', background: 'var(--lg-sheet-solid)' }}
        >
          <input
            value={sprache.hoert ? sprache.zwischen : eingabe}
            onChange={e => setEingabe(e.target.value)}
            placeholder={sprache.hoert ? dt('mikro_hoert') : tt('hoku_placeholder')}
            aria-label={tt('hoku_placeholder')}
            maxLength={500}
            enterKeyHint="send"
            readOnly={sprache.hoert}
            disabled={denkt}
            style={{ flex: 1, minWidth: 0, minHeight: 46, borderRadius: 23, border: 'none', padding: '0 16px', background: 'var(--lg-fill)', color: 'var(--lg-text)', fontSize: 16, outline: 'none' }}
          />
          {hatText || !sprache.verfuegbar ? (
            <button type="submit" aria-label={tt('hoku_send')} disabled={!hatText || denkt} className="tyd-train-press" style={roundButton(hatText && !denkt)}>
              <ArrowUp size={20} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              aria-label={sprache.hoert ? dt('mikro_fertig') : dt('mikro_start')}
              aria-pressed={sprache.hoert}
              disabled={denkt}
              onClick={() => (sprache.hoert ? sprache.beenden() : sprache.starten())}
              className="tyd-train-press"
              style={{ ...roundButton(true), background: sprache.hoert ? '#ff453a' : 'var(--accent)', color: sprache.hoert ? '#fff' : 'var(--accent-contrast)' }}
            >
              {sprache.hoert ? <Square size={16} fill="currentColor" aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
            </button>
          )}
        </form>
      </div>
    </TrainingSheet>
  )
}

function Bubble({ hoku, children }: { hoku: boolean; children: ReactNode }) {
  return (
    <div style={{
      alignSelf: hoku ? 'flex-start' : 'flex-end', maxWidth: '85%', padding: '10px 13px', borderRadius: 18, fontSize: 15, lineHeight: 1.4,
      background: hoku ? 'var(--lg-fill)' : 'var(--accent)', color: hoku ? 'var(--lg-text)' : 'var(--accent-contrast)',
      borderBottomLeftRadius: hoku ? 6 : 18, borderBottomRightRadius: hoku ? 18 : 6, whiteSpace: 'pre-wrap',
    }}>
      {children}
    </div>
  )
}

const roundButton = (active: boolean) => ({
  width: 46, height: 46, borderRadius: 23, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: active ? 'var(--accent)' : 'var(--lg-fill)', color: active ? 'var(--accent-contrast)' : 'var(--lg-text-3)',
}) as const
