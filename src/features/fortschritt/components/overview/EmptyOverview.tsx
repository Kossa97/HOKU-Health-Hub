import { Link } from 'react-router-dom'
import { Plus, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function EmptyOverview({ onLogToday }: { onLogToday: () => void }) {
  const { t } = useTranslation()
  return (
    <section className="fg-card fg-surface" style={{ padding: '28px 20px', textAlign: 'center' }}>
      <div className="fg-glass" style={{
        width: 60,
        height: 60,
        borderRadius: 20,
        margin: '0 auto 18px',
        display: 'grid',
        placeItems: 'center',
        color: 'var(--fg-accent)',
      }}>
        <TrendingUp size={28} aria-hidden />
      </div>
      <h2 className="fg-h3" style={{ fontSize: '1.3rem', marginBottom: 8, textWrap: 'balance' }}>
        {t('fortschritt_empty_title')}
      </h2>
      <p style={{ margin: '0 auto 22px', maxWidth: '30ch', fontSize: '0.92rem', lineHeight: 1.5, color: 'var(--fg-text-2)' }}>
        {t('fortschritt_empty_body')}
      </p>

      <ol style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '0 0 22px', padding: 0, listStyle: 'none', textAlign: 'left' }}>
        <Step n={1} text={t('fortschritt_empty_step_substance')} />
        <Step n={2} text={t('fortschritt_empty_step_log')} />
      </ol>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="button" className="fg-btn fg-btn-primary" onClick={onLogToday}>
          <Plus size={20} strokeWidth={2.6} aria-hidden />
          {t('fortschritt_log_first_day')}
        </button>
        <Link to="/my-stack" className="fg-btn fg-btn-glass fg-glass" style={{ textDecoration: 'none' }}>
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
      padding: '12px 14px',
      borderRadius: 16,
      background: 'rgba(255,255,255,0.05)',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
    }}>
      <span style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(0,204,245,0.14)',
        color: 'var(--fg-accent)',
        fontSize: '0.8rem',
        fontWeight: 800,
      }}>
        {n}
      </span>
      <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--fg-text)' }}>{text}</span>
    </li>
  )
}

export function NoSubstancesBanner() {
  const { t } = useTranslation()
  return (
    <section className="fg-card fg-surface">
      <p style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 600, lineHeight: 1.5, color: 'var(--fg-text-2)' }}>
        {t('fortschritt_no_substances_banner')}
      </p>
      <Link to="/my-stack" className="fg-btn fg-btn-glass fg-glass" style={{ textDecoration: 'none' }}>
        {t('fortschritt_create_cycle')}
      </Link>
    </section>
  )
}
