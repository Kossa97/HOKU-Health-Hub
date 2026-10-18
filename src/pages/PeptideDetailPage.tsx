import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, Info } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { usePeptipediaHead } from '../features/peptipedia/usePeptipediaHead'
import { getPublishedPeptide } from '../features/peptipedia/content'
import type { PeptipediaLocale } from '../features/peptipedia/content/types'
import { PEPTIPEDIA_UI_COPY } from '../features/peptipedia/content/uiCopy'
import { PeptideSummary } from '../features/peptipedia/components/PeptideSummary'
import { PeptipediaTabs } from '../features/peptipedia/components/PeptipediaTabs'
import { OverviewPanel, MechanismPanel, ProtocolsPanel, SafetyPanel, SourcesPanel } from '../features/peptipedia/components/PeptidePanels'
import { PeptideCalculatorPanel } from '../features/peptipedia/components/PeptideCalculatorPanel'
import { peptipediaTabs, TAB_HASHES, peptipediaListPath, tabFromHash, type PeptipediaMode } from '../features/peptipedia/routing'

const subscribeToHydration = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

export function PeptideDetailPage({ locale = 'de', mode = 'public' }: { locale?: PeptipediaLocale; mode?: PeptipediaMode }) {
  const { slug = '' } = useParams<{ slug: string }>()
  usePeptipediaHead(locale, slug, mode === 'public')
  const location = useLocation()
  const navigate = useNavigate()
  // Server output starts at Overview; read the fragment after hydration.
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot)
  const requestedTab = tabFromHash(locale, hydrated ? location.hash : '')
  const tabs = peptipediaTabs(mode)
  const activeTab = tabs.includes(requestedTab) ? requestedTab : 'overview'
  const peptide = getPublishedPeptide(slug, locale)
  const copy = PEPTIPEDIA_UI_COPY[locale]
  if (!peptide) return <div className="text-center py-16"><h1 className="lg-title2 mb-3">{copy.notFound.title}</h1><p className="text-[15px] text-[var(--lg-text-2)] mb-4">{copy.notFound.text}</p><Link to={peptipediaListPath(locale, mode)} className="font-semibold text-[var(--lg-accent-text)]">{copy.navigation.backToLibrary}</Link></div>
  const calculator = peptide.calculatorUnsupportedReason
    ? <div className="lg-surface lg-flat p-5 text-[15px] text-[var(--lg-text-2)] leading-relaxed">{peptide.calculatorUnsupportedReason === 'activity_units'
      ? (locale === 'de' ? 'Dieses Präparat wird in biologischen Aktivitätseinheiten beschrieben. Der mg-/µg-Rechner kann diese nicht zuverlässig umrechnen. Spritzen-Skaleneinheiten sind keine Wirkstoff-Aktivitätseinheiten.' : 'This preparation is described in biological activity units. The mg/µg calculator cannot reliably convert them. Syringe scale units are not drug activity units.')
      : (locale === 'de' ? 'Dies ist eine komplexe Mischung, kein definierter Einzelstoff. Der Einzelstoff-Rechner ist für dieses Präparat nicht geeignet.' : 'This is a complex mixture, not a defined individual compound. The single-compound calculator is not suitable for this preparation.')}</div>
    : peptide.blend
    ? <div className="lg-surface lg-flat p-5 text-[15px] text-[var(--lg-text-2)] leading-relaxed">{locale === 'de' ? 'Dieser Rechner ist für Einzelstoffe ausgelegt. Die Gesamtmenge eines Blends ist keine Einzelstoffdosis. Ohne getrennte Konzentrationen und ein verifiziertes Mischungsverhältnis wird hier keine Berechnung angeboten.' : 'This calculator is designed for individual compounds. A blend’s total amount is not an individual ingredient dose. No calculation is offered without separate concentrations and a verified mixing ratio.'}</div>
    : <PeptideCalculatorPanel key={slug} locale={locale} />
  const panels = { overview: <OverviewPanel peptide={peptide} />, mechanism: <MechanismPanel peptide={peptide} />, protocols: <ProtocolsPanel peptide={peptide} />, calculator, safety: <SafetyPanel peptide={peptide} />, sources: <SourcesPanel peptide={peptide} /> }
  return <div className="max-w-2xl mx-auto space-y-5 pb-10 min-w-0">
    <Link to={peptipediaListPath(locale, mode)} className="lg-glass lg-btn lg-btn-glass lg-btn-compact w-fit max-w-full !pl-2.5 !pr-4 !gap-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lg-accent)]"><ChevronLeft size={22} strokeWidth={2.4} aria-hidden="true" /><span className="truncate">{copy.navigation.backToLibrary}</span></Link>
    <PeptideSummary peptide={peptide} mode={mode} />
    <div className="flex items-start gap-2.5 rounded-[18px] bg-[var(--lg-surface-2)] px-3.5 py-2.5"><Info size={15} className="text-[var(--lg-text-3)] shrink-0 mt-px" /><p className="text-[13px] text-[var(--lg-text-2)] leading-snug">{copy.disclaimer}</p></div>
    {peptide.identity.status !== 'confirmed' && <div role="alert" className="flex items-start gap-3 rounded-[20px] bg-[var(--lg-surface-2)] px-4 py-3.5">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--lg-warn-text)]" />
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-[var(--lg-warn-text)]">{copy.identityWarning[peptide.identity.status].title}</h2>
        <p className="mt-1 text-[13px] leading-snug text-[var(--lg-text)]">{copy.identityWarning[peptide.identity.status].explanation}</p>
        <p className="mt-2 text-[13px] leading-snug text-[var(--lg-text-2)]">{peptide.identity.description[locale]}</p>
      </div>
    </div>}
    <PeptipediaTabs locale={locale} mode={mode} activeTab={activeTab} onSelect={id => navigate({ pathname: location.pathname, search: location.search, hash: TAB_HASHES[locale][id] })} />
    {tabs.map(id => <section key={id} role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={activeTab !== id} tabIndex={0} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lg-accent)] rounded-[24px]">{panels[id]}</section>)}
  </div>
}
