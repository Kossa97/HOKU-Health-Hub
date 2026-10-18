import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import type { PeptipediaView, PeptipediaSource } from '../content/types'
import { PEPTIPEDIA_UI_COPY } from '../content/uiCopy'
import type { PeptipediaLocale } from '../content/types'

function EvidenceRow({
  label,
  value,
  detail,
}: {
  label: string
  value: ReactNode
  detail?: string
}) {
  return (
    <div className="grid gap-0.5 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-[13px] text-[var(--lg-text-3)]">
        {label}
      </dt>
      <dd className="text-[16px] text-[var(--lg-text)] leading-snug">
        <div>{value}</div>
        {detail && <p className="mt-1 text-[13px] leading-snug text-[var(--lg-text-2)]">{detail}</p>}
      </dd>
    </div>
  )
}

function SectionCard({ label, children }: { label: string; children: ReactNode }) {
  return <section>
    <h2 className="lg-group-title">{label}</h2>
    <div className="lg-surface lg-flat p-4">{children}</div>
  </section>
}

/** Abschnitt als gruppierte Liste: Zeilen bringen ihr Polster mit, Trennlinien kommen von .lg-rows. */
function SectionGroup({ label, children, footer }: { label: string; children: ReactNode; footer?: ReactNode }) {
  return <section>
    <h2 className="lg-group-title">{label}</h2>
    {children}
    {footer && <p className="mx-4 mt-2 text-[13px] leading-snug text-[var(--lg-text-3)]">{footer}</p>}
  </section>
}

function SourceLinks({ sources, locale }: { sources: PeptipediaSource[]; locale: PeptipediaLocale }) {
  const copy = PEPTIPEDIA_UI_COPY[locale].sources
  if (!sources.length) return null
  return <ul className="mt-3 overflow-hidden rounded-[16px] bg-[var(--lg-surface-2)] lg-rows">{sources.map(source => <li key={source.id} className="px-4 py-3">
    <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1.5 text-[15px] leading-snug text-[var(--lg-accent-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lg-accent)] rounded-sm break-words">
      <span>{source.title}</span><ExternalLink size={13} className="shrink-0 mt-1" />
    </a>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="lg-tag !min-h-[22px] !px-2 !text-[12px]" data-tone="accent">{copy.kind[source.kind]}</span>
      <span className="text-[13px] text-[var(--lg-text-3)]">{source.year}</span>
    </div>
    <p className="mt-1.5 text-[13px] text-[var(--lg-text-2)]">{source.publisherOrAuthors}</p>
    <p className="mt-0.5 text-[12px] text-[var(--lg-text-3)]">{copy.accessed}: <time dateTime={source.accessedAt}>{source.accessedAt}</time></p>
    {source.kind === 'catalog' && <p className="mt-1.5 text-[12px] text-[var(--lg-warn-text)]">{copy.catalogueNote}</p>}
  </li>)}</ul>
}

function TextList({ items, empty }: { items: string[]; empty: string }) {
  return items.length ? <ul className="space-y-2">{items.map(item => <li key={item} className="flex gap-2.5 text-[15px] text-[var(--lg-text-2)] leading-relaxed"><span className="text-[var(--lg-text-3)] shrink-0">·</span><span>{item}</span></li>)}</ul> : <p className="text-[15px] text-[var(--lg-text-2)] leading-relaxed">{empty}</p>
}

export function OverviewPanel({ peptide }: { peptide: PeptipediaView }) {
  const copy = PEPTIPEDIA_UI_COPY[peptide.locale]
  const matrix = copy.evidence
  const approvals = peptide.approvals?.filter(approval => approval.status === 'approved') ?? []
  return <div className="space-y-6">
    <SectionCard label={copy.headings.researchAreas}><div className="flex flex-wrap gap-2">{peptide.researchAreas.map(area => <span key={area} className="lg-tag !font-medium !whitespace-normal !py-1 leading-snug">{area}</span>)}</div></SectionCard>
    <SectionGroup label={matrix.heading} footer={matrix.note}>
      <dl className="lg-group lg-rows lg-flat relative">
        <EvidenceRow label={matrix.dimensions.identity} value={matrix.identity[peptide.identity.status]} detail={peptide.identity.description[peptide.locale]} />
        <EvidenceRow label={matrix.dimensions.human} value={matrix.human[peptide.evidenceMatrix.human]} />
        <EvidenceRow label={matrix.dimensions.replication} value={matrix.replication[peptide.evidenceMatrix.replication]} />
        <EvidenceRow label={matrix.dimensions.endpoints} value={matrix.endpoints[peptide.evidenceMatrix.endpoints]} />
        <EvidenceRow label={matrix.dimensions.safety} value={matrix.safety[peptide.evidenceMatrix.safety]} />
        <EvidenceRow label={matrix.dimensions.approval} value={approvals.length
          ? <div className="flex flex-wrap gap-2">{approvals.map(approval => <span key={`${approval.region}-${approval.product}`} title={`${approval.product}: ${approval.indication}`} className="lg-tag" data-tone="good">{approval.region} · {peptide.locale === 'de' ? 'Zugelassen' : 'Approved'}</span>)}</div>
          : matrix.noApproval} />
      </dl>
    </SectionGroup>
    {peptide.overviewFacts.map(fact => <SectionCard key={fact.id} label={fact.label}><p className="text-[15px] text-[var(--lg-text)] leading-relaxed">{fact.value}</p><SourceLinks locale={peptide.locale} sources={peptide.sources.filter(source => fact.sourceIds.includes(source.id))} /></SectionCard>)}
    <SectionCard label={copy.headings.researchGaps}><TextList items={peptide.researchGaps} empty={copy.empty.list} /></SectionCard>
  </div>
}

export function MechanismPanel({ peptide }: { peptide: PeptipediaView }) {
  return <SectionCard label={PEPTIPEDIA_UI_COPY[peptide.locale].tabs.mechanism}><p className="text-[15px] text-[var(--lg-text)] leading-relaxed">{peptide.mechanism}</p><SourceLinks locale={peptide.locale} sources={peptide.sources.filter(source => peptide.mechanismSourceIds.includes(source.id))} /></SectionCard>
}

export function ProtocolsPanel({ peptide }: { peptide: PeptipediaView }) {
  const copy = PEPTIPEDIA_UI_COPY[peptide.locale]
  const labels = peptide.locale === 'de'
    ? { populationOrModel: 'Population / Modell', route: 'Verabreichung', amount: 'Menge laut Quelle', frequency: 'Häufigkeit', duration: 'Dauer', objective: 'Fragestellung', outcome: 'Ergebnis / Einordnung' }
    : { populationOrModel: 'Population / model', route: 'Route', amount: 'Amount reported', frequency: 'Frequency', duration: 'Duration', objective: 'Objective', outcome: 'Outcome / context' }
  if (!peptide.protocols.length) return <SectionCard label={copy.tabs.protocols}><p className="text-[15px] text-[var(--lg-text-2)]">{copy.empty.protocols}</p></SectionCard>
  return <div className="space-y-6">{peptide.protocols.map(protocol => <SectionCard key={protocol.id} label={copy.protocolEvidence[protocol.evidenceType]}>
    <dl className="space-y-3">{(Object.keys(labels) as Array<keyof typeof labels>).map(field => <div key={field}>
      <dt className="text-[13px] text-[var(--lg-text-3)] mb-0.5">{labels[field]}</dt><dd className="text-[15px] text-[var(--lg-text)] leading-relaxed">{protocol[field]}</dd>
    </div>)}</dl>
    <SourceLinks locale={peptide.locale} sources={peptide.sources.filter(source => protocol.sourceIds.includes(source.id))} />
  </SectionCard>)}</div>
}

export function SafetyPanel({ peptide }: { peptide: PeptipediaView }) {
  const copy = PEPTIPEDIA_UI_COPY[peptide.locale]
  return <div className="space-y-6">{(['sideEffects', 'contraindications', 'interactions'] as const).map(field => <SectionCard key={field} label={copy.headings[field]}><TextList items={peptide[field]} empty={copy.empty.list} /></SectionCard>)}
    <SectionCard label={copy.headings.researchGaps}><TextList items={peptide.researchGaps} empty={copy.empty.list} /><SourceLinks locale={peptide.locale} sources={peptide.sources.filter(source => peptide.safetySourceIds.includes(source.id))} /></SectionCard>
  </div>
}

export function SourcesPanel({ peptide }: { peptide: PeptipediaView }) {
  const copy = PEPTIPEDIA_UI_COPY[peptide.locale]
  const versionLabel = peptide.locale === 'de' ? 'Fassung' : 'Version'
  return <SectionCard label={copy.tabs.sources}><p className="text-[13px] text-[var(--lg-text-3)]">{copy.reviewed}: <time dateTime={peptide.reviewedAt}>{peptide.reviewedAt}</time> · {versionLabel} {peptide.contentVersion}</p><SourceLinks locale={peptide.locale} sources={peptide.sources} /></SectionCard>
}
