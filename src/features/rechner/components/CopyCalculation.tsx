import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function CopyCalculation({ text }: { text: string }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')

  const copy = async () => {
    setStatus('copying')
    try {
      await navigator.clipboard.writeText(text)
      setStatus('copied')
    } catch {
      setStatus('error')
    }
  }

  return <div className="rechner-copy">
    <button type="button" className="rechner-button rechner-copy-button" onClick={copy} disabled={status === 'copying'}>
      {status === 'copied' ? <Check strokeWidth={1.5} size={16} aria-hidden="true" /> : <Copy strokeWidth={1.5} size={16} aria-hidden="true" />}
      {t(status === 'copying' ? 'rechner_copy_pending' : 'rechner_copy')}
    </button>
    <p className="rechner-muted" role="status">
      {status === 'copied' ? t('rechner_copy_success') : status === 'error' ? t('rechner_copy_error') : ''}
    </p>
    {status === 'error' && <label className="rechner-field" htmlFor="dose-copy-summary">
      <span>{t('rechner_copy_summary')}</span>
      <textarea id="dose-copy-summary" className="rechner-input" readOnly rows={8} value={text}
        onFocus={event => event.currentTarget.select()} />
    </label>}
  </div>
}
