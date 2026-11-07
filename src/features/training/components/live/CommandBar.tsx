import { useState } from 'react'
import { ArrowUp, HelpCircle, Mic, X } from 'lucide-react'
import { useTrainingText } from '../../i18n'
import { useSpracheingabe, type SpracheFehler } from '../../../dot/chat/useSpracheingabe'

/**
 * Die Leiste unten im laufenden Training: tippen („80 kg 8") oder das
 * Mikrofon gedrückt halten und sprechen. Erkannt wird auf dem Gerät (Apple
 * bzw. Google), die Befehle versteht die App selbst — ohne KI und für alle.
 * Gibt es keine Spracherkennung (z. B. in manchen App-Ansichten), fehlt nur
 * das Mikrofon; das Diktat der Tastatur geht trotzdem.
 */
export function CommandBar({ onCommand, onMicError }: {
  onCommand: (text: string) => void
  onMicError: (error: SpracheFehler) => void
}) {
  const { tt, lang } = useTrainingText()
  const [text, setText] = useState('')
  const [help, setHelp] = useState(false)
  const sprache = useSpracheingabe(lang, onCommand, onMicError)
  const hasText = text.trim().length > 0 && !sprache.hoert

  const submit = () => {
    const value = text.trim()
    if (!value) return
    setText('')
    onCommand(value)
  }

  const live = sprache.hoert ? (sprache.zwischen || tt('voice_listening')) : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {help && (
        <div id="tyd-voice-help" style={{ position: 'relative', borderRadius: 14, background: 'var(--lg-surface-2)', border: '1px solid var(--lg-separator)', padding: '10px 40px 10px 12px', fontSize: 14, lineHeight: 1.55, color: 'var(--lg-text-2)' }}>
          <div>{tt('voice_help_1')}</div>
          <div>{tt('voice_help_2')}</div>
          <div>{tt('voice_help_3')}</div>
          <div>{tt('voice_help_4')}</div>
          <button type="button" onClick={() => setHelp(false)} aria-label={tt('voice_help_close')} className="tyd-train-press" style={{ position: 'absolute', top: 2, right: 2, width: 40, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lg-text-3)' }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}
      <form
        onSubmit={e => { e.preventDefault(); submit() }}
        style={{ display: 'flex', gap: 8, alignItems: 'center' }}
      >
        <div style={{ flex: 1, minWidth: 0, minHeight: 48, borderRadius: 24, background: 'var(--lg-fill)', display: 'flex', alignItems: 'center', gap: 4, padding: '0 4px 0 4px' }}>
          <button
            type="button"
            onClick={() => setHelp(h => !h)}
            aria-label={tt('voice_help')}
            aria-expanded={help}
            aria-controls="tyd-voice-help"
            className="tyd-train-press"
            style={{ width: 40, height: 40, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: help ? 'var(--accent)' : 'var(--lg-text-3)' }}
          >
            <HelpCircle size={20} aria-hidden="true" />
          </button>
          <input
            value={sprache.hoert ? live : text}
            onChange={e => setText(e.target.value)}
            placeholder={tt('voice_placeholder')}
            aria-label={tt('voice_input_label')}
            maxLength={120}
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="off"
            readOnly={sprache.hoert}
            style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', color: 'var(--lg-text)', fontSize: 16, outline: 'none', padding: '0 4px' }}
          />
          {hasText && (
            <button type="submit" aria-label={tt('voice_send')} className="tyd-train-press" style={{ width: 40, height: 40, borderRadius: 20, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent)', color: 'var(--accent-contrast)' }}>
              <ArrowUp size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        {sprache.verfuegbar && (
          <button
            type="button"
            aria-label={tt('voice_hold')}
            aria-pressed={sprache.hoert}
            // Halten und sprechen; loslassen schickt ab. Tastatur: einmal tippen startet, nochmal beendet.
            onPointerDown={e => {
              if (e.button !== 0) return
              // Loslassen neben dem Knopf zählt auch; ohne aktiven Zeiger (Hilfstechnik) geht es ohne
              try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* kein aktiver Zeiger */ }
              sprache.starten()
            }}
            onPointerUp={() => sprache.beenden()}
            onPointerCancel={() => sprache.beenden()}
            onClick={e => {
              if (e.detail !== 0) return
              if (sprache.hoert) sprache.beenden()
              else sprache.starten()
            }}
            onContextMenu={e => e.preventDefault()}
            className="tyd-train-press"
            style={{
              width: 56, height: 56, borderRadius: 28, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: sprache.hoert ? '#ff453a' : 'var(--accent)', color: sprache.hoert ? '#fff' : 'var(--accent-contrast)',
              boxShadow: sprache.hoert ? '0 0 0 8px rgba(255,69,58,0.22)' : 'none',
              transform: sprache.hoert ? 'scale(1.06)' : 'none', transition: 'transform 160ms cubic-bezier(.23,1,.32,1), box-shadow 160ms',
              touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
            }}
          >
            <Mic size={24} aria-hidden="true" />
          </button>
        )}
      </form>
    </div>
  )
}
