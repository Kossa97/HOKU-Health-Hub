import { Link } from 'react-router-dom'
import { Plus, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function EmptyOverview({ onLogToday }: { onLogToday: () => void }) {
  const { t } = useTranslation()
  return (
    <section className="lg-card lg-surface" style={{ padding: '28px 20px', textAlign: 'center' }}>
      <div className="lg-glass" style={{
        width: 56,
        height: 56,
        borderRadius: 14,
        margin: '0 auto 16px',
        display: 'grid',
        placeItems: 'center',
        color: 'var(--fg-text-2)',
      }}>
        <TrendingUp size={24} strokeWidth={1.5} aria-hidden />
      </div>
      <h2 className="lg-h3" style={{ fontSize: '1.25rem', marginBottom: 8, textWrap: 'balance' }}>
        {t('fortschritt_empty_title')}
      </h2>
      <p style={{ margin: '0 auto 24px', maxWidth: '30ch', fontSize: '0.92rem', lineHeight: 1.5, color: 'var(--fg-text-2)' }}>
        {t('fortschritt_empty_body')}
      </p>

      <ol style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '0 0 24px', padding: 0, listStyle: 'none', textAlign: 'left' }}>
        <Step n={1} text={t('fortschritt_empty_step_substance')} />
        <Step n={2} text={t('fortschritt_empty_step_log')} />
      </ol>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" className="lg-btn lg-btn-primary" onClick={onLogToday}>
          <Plus size={18} strokeWidth={2} aria-hidden />
          {t('fortschritt_log_first_day')}
        </button>
        <Link to="/my-stack" className="lg-btn lg-btn-glass lg-glass" style={{ textDecoration: 'none' }}>
          {t('fortschritt_create_cycle')}
        </Link>
      </div>
    </section>
  )
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      borderRadius: 12,
      background: 'var(--lg-fill, rgba(255,255,255,0.05))',
      boxShadow: 'inset 0 0 0 1px var(--fg-hair)',
    }}>
      <span style={{
        width: 24,
        flexShrink: 0,
        fontFamily: 'var(--font-mono)',
        fontSize: '0.8rem',
        fontWeight: 400,
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--fg-text-3)',
      }}>
        {String(n).padStart(2, '0')}
      </span>
      <span style={{ fontSize: '0.92rem', fontWeight: 500, color: 'var(--fg-text)' }}>{text}</span>
    </li>
  )
}

export function NoSubstancesBanner() {
  const { t } = useTranslation()
  return (
    <section className="lg-card lg-surface">
      <p style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 400, lineHeight: 1.5, color: 'var(--fg-text-2)' }}>
        {t('fortschritt_no_substances_banner')}
      </p>
      <Link to="/my-stack" className="lg-btn lg-btn-glass lg-glass" style={{ textDecoration: 'none' }}>
        {t('fortschritt_create_cycle')}
      </Link>
    </section>
  )
}
