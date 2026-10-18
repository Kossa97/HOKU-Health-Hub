import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { FlaskConical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ConsentChecks } from '../features/compliance/components/ConsentChecks'
import { MedicalNotice } from '../features/compliance/components/MedicalNotice'
import { LegalLinks } from '../features/compliance/components/LegalLinks'
import { KEINE_ZUSTIMMUNG, vollstaendig, zustimmungsZeile } from '../features/compliance/lib/consent'

export function Auth() {
  const { session } = useAuth()
  const { t } = useTranslation()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [zustimmung, setZustimmung] = useState(KEINE_ZUSTIMMUNG)

  if (session) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (mode === 'register') {
      if (!vollstaendig(zustimmung)) {
        setLoading(false)
        return toast.error(t('consent_required'))
      }
      // Die Zustimmung steht auch in den Konto-Metadaten: muss die E-Mail
      // erst bestaetigt werden, darf das Profil noch nicht geschrieben werden
      // — dann uebernimmt die Zustimmungsseite sie beim ersten Start.
      const felder = zustimmungsZeile(new Date())
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username, ...felder } } })
      if (error) {
        toast.error(error.message)
      } else if (data.user) {
        await supabase.from('profiles').upsert({ id: data.user.id, username, ...felder })
        toast.success(t('account_created'))
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) toast.error(t('wrong_credentials'))
    }

    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-3 grid h-[72px] w-[72px] place-items-center rounded-[18px] bg-[linear-gradient(180deg,#0a84ff,#00a9d4)] shadow-[0_10px_30px_rgba(0,204,245,0.25)]">
            <FlaskConical className="text-white" size={36} />
          </div>
          <h1 className="lg-large-title">TYD</h1>
          <p className="text-[var(--lg-text-2)] text-[15px] mt-0.5">{t('auth_title')}</p>
        </div>

        <div className="card">
          <div className="flex rounded-full bg-[var(--lg-fill)] p-0.5 mb-6">
            <button
              type="button"
              aria-pressed={mode === 'login'}
              className={`flex-1 min-h-9 rounded-full text-[14px] font-semibold transition-colors ${mode === 'login' ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)] shadow-[0_3px_8px_rgba(0,0,0,0.25)]' : 'text-[var(--lg-text-2)]'}`}
              onClick={() => setMode('login')}
            >
              {t('auth_tab_login')}
            </button>
            <button
              type="button"
              aria-pressed={mode === 'register'}
              className={`flex-1 min-h-9 rounded-full text-[14px] font-semibold transition-colors ${mode === 'register' ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)] shadow-[0_3px_8px_rgba(0,0,0,0.25)]' : 'text-[var(--lg-text-2)]'}`}
              onClick={() => setMode('register')}
            >
              {t('auth_tab_register')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label">{t('username')} *</label>
                <input className="input" placeholder={t('username_placeholder')} value={username} onChange={e => setUsername(e.target.value)} required />
              </div>
            )}
            <div>
              <label className="label">{t('email')}</label>
              <input className="input" type="email" placeholder={t('email_placeholder')} value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">{t('password')}</label>
              <input className="input" type="password" placeholder={t('password_placeholder')} value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            {mode === 'register' && <ConsentChecks value={zustimmung} onChange={setZustimmung} />}
            <button className="lg-btn lg-btn-primary w-full mt-2" type="submit" disabled={loading} data-auth-submit>
              {loading ? t('loading') : mode === 'login' ? t('auth_tab_login') : t('create_account')}
            </button>
          </form>
        </div>

        <p className="text-center text-[var(--lg-text-3)] text-[13px] mt-6">
          {t('research_only')}
        </p>
        <MedicalNotice className="mt-4" />
        <LegalLinks className="mt-4" />
      </div>
    </div>
  )
}
