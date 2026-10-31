import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronRight } from 'lucide-react'
import { LANGUAGES, setLanguage } from '../i18n'
import type { LanguageCode } from '../i18n'
import { useAuth } from '../context/AuthContext'

// Pro Nutzer: wer schon einmal gewählt hat, sieht die Auswahl nicht wieder.
const pickedKey = (uid: string | undefined) => `tyd_lang_picked${uid ? `_${uid}` : ''}`

const currentCode = (lang: string | undefined): LanguageCode =>
  LANGUAGES.find(l => l.code === lang?.split('-')[0])?.code ?? 'en'

/** Sprachauswahl beim ersten Start — Deutsch oder Englisch. */
export function LanguageGate() {
  const { user, loading } = useAuth()
  const { i18n, t } = useTranslation()

  const key = pickedKey(user?.id)
  const [doneFor, setDoneFor] = useState<string | null>(null)
  const [selected, setSelected] = useState<LanguageCode>(() => currentCode(i18n.language))

  // Erst nach dem Auth-Check entscheiden, sonst blitzt die Auswahl beim
  // falschen Nutzer auf.
  if (loading || doneFor === key || localStorage.getItem(key)) return null

  const choose = (code: LanguageCode) => {
    setSelected(code)
    setLanguage(code)
  }

  const finish = () => {
    setLanguage(selected)
    localStorage.setItem(key, '1')
    setDoneFor(key)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="language-gate-title"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-4"
      style={{
        background: 'rgba(3, 4, 16, 0.97)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div
        className="w-full max-w-md"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '24px 20px 20px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        }}
      >
        <h1
          id="language-gate-title"
          className="text-center font-medium mb-1"
          style={{ fontSize: 20, color: 'var(--text)', letterSpacing: '-0.01em' }}
        >
          {t('lang_gate_title')}
        </h1>
        <p
          className="text-center mb-6"
          style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}
        >
          {t('lang_gate_subtitle')}
        </p>

        <div role="radiogroup" aria-labelledby="language-gate-title" className="grid grid-cols-2 gap-3 mb-6">
          {LANGUAGES.map(lang => {
            const isSelected = lang.code === selected
            return (
              <button
                key={lang.code}
                type="button"
                role="radio"
                aria-checked={isSelected}
                lang={lang.code}
                onClick={() => choose(lang.code)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '20px 12px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  border: `1px solid ${isSelected ? 'var(--accent-border)' : 'var(--border)'}`,
                  background: isSelected ? 'var(--accent-weak)' : 'transparent',
                  color: isSelected ? 'var(--text)' : 'var(--text-dim)',
                  fontWeight: 500,
                  fontSize: 16,
                  transition: 'background-color 160ms, border-color 160ms, color 160ms',
                }}
              >
                <span>{lang.name}</span>
                {isSelected && (
                  <span style={{ position: 'absolute', top: 8, insetInlineEnd: 8, display: 'flex', color: 'var(--lg-accent-text)' }} aria-hidden="true">
                    <Check size={16} strokeWidth={1.5} />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={finish}
          className="lg-btn lg-btn-primary"
          style={{ width: '100%' }}
        >
          {t('lang_gate_continue')}
          <ChevronRight size={18} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
