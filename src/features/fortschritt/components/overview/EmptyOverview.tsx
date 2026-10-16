import { Link } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { panel } from '../../styles'

interface Props {
  onLogToday: () => void
}

export function EmptyOverview({ onLogToday }: Props) {
  const { t } = useTranslation()
  return (
    <section style={{ ...panel, padding: '28px 20px', textAlign: 'center' }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: 18,
        margin: '0 auto 16px',
        background: 'var(--accent-weak)',
        border: '1px solid var(--accent-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <TrendingUp size={28} color="var(--accent)" />
      </div>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>
        {t('fortschritt_empty_title')}
      </h2>
      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
        {t('fortschritt_empty_body')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20, textAlign: 'left' }}>
        <Step n={1} text={t('fortschritt_empty_step_substance')} />
        <Step n={2} text={t('fortschritt_empty_step_log')} />
      </div>

      <Link
        to="/my-stack"
        className="btn-primary"
        style={{ display: 'block', width: '100%', marginBottom: 10, textAlign: 'center' }}
      >
        {t('fortschritt_create_cycle')}
      </Link>
      <button type="button" className="btn-secondary" style={{ width: '100%' }} onClick={onLogToday}>
        {t('fortschritt_log_first_day')}
      </button>
    </section>
  )
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      borderRadius: 14,
      background: 'var(--surface-input)',
      border: '1px solid var(--border)',
    }}>
      <span style={{
        width: 24,
        height: 24,
        borderRadius: 8,
        background: 'var(--accent-weak)',
        color: 'var(--accent)',
        fontSize: '0.72rem',
        fontWeight: 900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {n}
      </span>
      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dim)' }}>{text}</span>
    </div>
  )
}

export function NoSubstancesBanner() {
  const { t } = useTranslation()
  return (
    <section style={{
      ...panel,
      padding: '14px 16px',
      borderColor: 'rgba(0,204,245,0.2)',
      background: 'rgba(0,204,245,0.05)',
    }}>
      <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dim)', lineHeight: 1.45, marginBottom: 10 }}>
        {t('fortschritt_no_substances_banner')}
      </p>
      <Link to="/my-stack" style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent)' }}>
        {t('fortschritt_create_cycle')}
      </Link>
    </section>
  )
}
