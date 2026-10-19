import type { PeptipediaView } from '../content/types'
import { Link } from 'react-router-dom'
import { peptipediaDetailPath, type PeptipediaMode } from '../routing'
import { peptipediaText } from '../content/legacyLabels'
import { CATEGORY_LABEL_KEYS, STATUS_LABEL_KEYS, STATUS_TONES } from '../display'

export function PeptideSummary({ peptide, mode = 'public' }: { peptide: PeptipediaView; mode?: PeptipediaMode }) {
  const t = peptipediaText(peptide.locale)
  const approvedRegions = [...new Set(peptide.approvals?.filter(approval => approval.status === 'approved').map(approval => approval.region))]
  return (
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {peptide.blend && <span className="lg-tag" data-tone="accent">Blend</span>}
          <span className="lg-tag">
            {t(CATEGORY_LABEL_KEYS[peptide.category])}
          </span>
          <span className="lg-tag" data-tone={STATUS_TONES[peptide.researchStatus]}>
            {t(STATUS_LABEL_KEYS[peptide.researchStatus])}{approvedRegions?.length ? ` · ${approvedRegions.join('/')}` : ''}
          </span>
        </div>

        <h1 className="lg-large-title break-words">
          {peptide.name}
        </h1>
        {peptide.fullName && (
          <p className="mt-0.5 mb-3 text-[15px] text-[var(--lg-text-3)]">
            {peptide.fullName}
          </p>
        )}
        <p className="text-[15px] text-[var(--lg-text-2)] leading-relaxed">{peptide.tldr}</p>
        {!!peptide.approvals?.length && <div className="mt-4">
          <p className="mb-2 text-[13px] font-semibold text-[var(--lg-text-3)]">{peptide.locale === 'de' ? 'Zulassungen' : 'Approvals'}</p>
          <div className="flex flex-wrap gap-2">{peptide.approvals.map(approval => <span
            key={`${approval.region}-${approval.product}`}
            title={`${approval.product}: ${approval.indication}`}
            className="lg-tag"
            data-tone={approval.status === 'approved' ? 'good' : 'warn'}
          >{approval.region} · {approval.status === 'approved' ? (peptide.locale === 'de' ? 'Zugelassen' : 'Approved') : (peptide.locale === 'de' ? 'Antrag zurückgezogen' : 'Application withdrawn')}</span>)}</div>
        </div>}
        {peptide.blend && <div className="lg-surface lg-flat mt-4 p-4">
          <h2 className="mb-2 text-[13px] font-semibold text-[var(--lg-text-3)]">{peptide.locale === 'de' ? 'Bestandteile laut Katalog' : 'Components listed in the catalogue'}</h2>
          <ul className="flex flex-wrap gap-2">{peptide.blend.components.map(component => <li key={component.name} className="lg-tag !whitespace-normal !py-1 leading-snug">
            {component.slug ? <Link className="text-[var(--lg-accent-text)]" to={peptipediaDetailPath(peptide.locale, component.slug, mode)}>{component.name}</Link> : <span>{component.name}</span>}
          </li>)}</ul>
          <p className="text-[13px] text-[var(--lg-text-2)] mt-3 leading-snug">{peptide.locale === 'de' ? 'Ein Blend-Name ist keine standardisierte Rezeptur. Zusammensetzung und Verhältnis können je nach Produkt abweichen; Daten zu Einzelstoffen belegen nicht die Mischung.' : 'A blend name is not a standardized formula. Ingredients and ratios may vary by product; evidence on individual compounds does not establish the blend’s effects.'}</p>
        </div>}
      </div>
  )
}
