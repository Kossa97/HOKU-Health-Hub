import { useTranslation } from 'react-i18next'
import { LEGAL_DOCS, hatPlatzhalter, legalLang, teileAbsatz, type LegalPageKey } from '../legal/texts'

/** Ein Rechtstext; offene Platzhalter sind gelb hervorgehoben. */
export function LegalDocument({ page, headingId }: { page: LegalPageKey; headingId?: string }) {
  const { t, i18n } = useTranslation()
  const doc = LEGAL_DOCS[page][legalLang(i18n.resolvedLanguage ?? i18n.language)]
  return (
    <article data-legal-page={page} className="text-[var(--lg-text-2)]">
      <h1 id={headingId} className="lg-title2 !text-[26px] !leading-tight">{doc.title}</h1>
      <p className="mt-1 text-[13px] text-[var(--lg-text-3)]">{doc.updated}</p>
      {hatPlatzhalter(doc) && (
        <p data-legal-draft className="mt-3 rounded-[14px] bg-[var(--lg-surface-2)] px-4 py-2.5 text-[13px] text-[var(--lg-warn-text)]">
          {t('legal_draft')}
        </p>
      )}
      <div className="mt-5 flex flex-col gap-5">
        {doc.sections.map(section => (
          <section key={section.heading}>
            <h2 className="text-[17px] font-medium text-[var(--lg-text)]">{section.heading}</h2>
            <div className="mt-1.5 flex flex-col gap-2 text-[15px] leading-relaxed">
              {section.paragraphs.map((absatz, i) => (
                <p key={i}>
                  {teileAbsatz(absatz).map((teil, j) => teil.platzhalter
                    ? <mark key={j} data-legal-placeholder className="rounded bg-amber-400/20 px-1 text-amber-200">{teil.text}</mark>
                    : <span key={j}>{teil.text}</span>)}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  )
}
