import { Link, Outlet, useLocation } from 'react-router-dom'
import type { PeptipediaLocale } from './content/types'
import { peptipediaListPath } from './routing'

export function PeptipediaPublicLayout({ locale }: { locale: PeptipediaLocale }) {
  const location = useLocation()
  const otherLocale = locale === 'de' ? 'en' : 'de'
  const suffix = location.pathname.slice(peptipediaListPath(locale).length)
  const alternate = peptipediaListPath(otherLocale) + suffix
  return <div lang={locale} dir="ltr" className="min-h-screen bg-black text-[var(--lg-text-2)]">
    <header className="sticky top-0 z-30 h-14 bg-black/80 backdrop-blur-xl border-b border-[var(--lg-separator)]" style={{ borderBottomWidth: '0.5px' }}>
      <nav aria-label={locale === 'de' ? 'Hauptnavigation' : 'Main navigation'} className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between gap-4">
        <Link to={peptipediaListPath(locale)} className="text-[17px] font-semibold text-[var(--lg-text)]">Peptipedia</Link>
        <div className="flex items-center gap-4 text-[15px] text-[var(--lg-text-2)]"><Link to={alternate} hrefLang={otherLocale} lang={otherLocale}>{otherLocale === 'en' ? 'English' : 'Deutsch'}</Link><Link to="/auth" className="font-semibold text-[var(--lg-accent-text)]">{locale === 'de' ? 'Zur App' : 'Open app'}</Link></div>
      </nav>
    </header>
    <main className="max-w-6xl mx-auto px-4 pt-6 pb-10 min-w-0"><Outlet /></main>
  </div>
}
