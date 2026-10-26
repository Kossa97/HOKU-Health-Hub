import { useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { Trash2, Archive, AlertTriangle } from 'lucide-react'
import { type Peptide } from './model'


/**
 * Substanz entfernen: archivieren (alle Daten bleiben) oder endgueltig loeschen.
 * Endgueltig nimmt die Bewertungen mit (die Datenbank loescht sie mit der
 * Substanz) — das steht dabei, mit Anzahl, statt still zu passieren.
 */
export function DeleteSubstanceDialog({
  deletePromptPeptide,
  deletePromptFromArchive,
  deletingPeptide,
  setDeletePromptFromArchive,
  setDeletePromptPeptide,
  archiveCloseButtonRef,
  archivePeptide,
  hardDeletePeptide,
}: {
  deletePromptPeptide: Peptide | null
  deletePromptFromArchive: boolean
  deletingPeptide: boolean
  setDeletePromptFromArchive: Dispatch<SetStateAction<boolean>>
  setDeletePromptPeptide: Dispatch<SetStateAction<Peptide | null>>
  archiveCloseButtonRef: RefObject<HTMLButtonElement | null>
  archivePeptide: (p: Peptide) => Promise<void>
  hardDeletePeptide: (p: Peptide) => Promise<void>
}) {
  const { t } = useTranslation()
  const bewertungen = useBewertungsZahl(deletePromptPeptide?.id ?? null)
  return (
    <>
      {deletePromptPeptide && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[var(--tyd-popup-top)]"
          data-app-modal
          data-archive-delete-confirmation={deletePromptFromArchive ? '' : undefined}
          onClick={() => {
            if (deletingPeptide) return
            setDeletePromptFromArchive(false)
            setDeletePromptPeptide(null)
            window.requestAnimationFrame(() => archiveCloseButtonRef.current?.focus())
          }}
        >
          <div
            className="w-full max-w-md rounded-[28px] bg-[#1c1c1e] p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-peptide-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="lg-icon-tile !h-10 !w-10 !rounded-xl bg-[#ff9f0a]">
                <AlertTriangle size={20} />
              </span>
              <div className="min-w-0">
                <h2 id="delete-peptide-title" className="text-[20px] font-bold text-[var(--lg-text)]">{t('substanz_entfernen_title')}</h2>
                <p className="mt-0.5 truncate text-[15px] text-[var(--lg-text-3)]">{deletePromptPeptide.name}</p>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-[20px] bg-[#2c2c2e] [&>*+*]:border-t [&>*+*]:border-[var(--lg-separator)]">
              {!deletePromptFromArchive && (
                <div className="px-4 py-3">
                  <p className="flex items-center gap-1.5 text-[15px] font-semibold text-[#64d2ff]">
                    <Archive size={15} /> {t('archivieren_behalten')}
                  </p>
                  <p className="mt-1 text-[13px] leading-snug text-[var(--lg-text-2)]">{t('archivieren_behalten_desc')}</p>
                </div>
              )}
              <div className="px-4 py-3">
                <p className="flex items-center gap-1.5 text-[15px] font-semibold text-[#ff6961]">
                  <Trash2 size={15} /> {t('endgueltig_loeschen')}
                </p>
                <p className="mt-1 text-[13px] leading-snug text-[var(--lg-text-2)]">{t('endgueltig_loeschen_desc')}</p>
                {bewertungen !== null && bewertungen > 0 && (
                  <p data-delete-reviews className="mt-1 text-[13px] font-semibold text-[#ff6961]">
                    {bewertungen === 1
                      ? t('review_substance_delete_one')
                      : t('review_substance_delete_many', { n: bewertungen })}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {!deletePromptFromArchive && (
                <button
                  type="button"
                  onClick={() => archivePeptide(deletePromptPeptide)}
                  disabled={deletingPeptide}
                  className="lg-btn lg-btn-primary w-full disabled:opacity-50"
                >
                  <Archive size={16} /> {t('archivieren_behalten')}
                </button>
              )}
              <button
                type="button"
                autoFocus={deletePromptFromArchive}
                onClick={() => hardDeletePeptide(deletePromptPeptide)}
                disabled={deletingPeptide}
                className="lg-btn lg-btn-danger w-full disabled:opacity-50"
              >
                <Trash2 size={16} /> {t('endgueltig_loeschen')}
              </button>
              <button
                type="button"
                onClick={() => { setDeletePromptFromArchive(false); setDeletePromptPeptide(null); window.requestAnimationFrame(() => archiveCloseButtonRef.current?.focus()) }}
                data-app-back-close
                disabled={deletingPeptide}
                className="lg-gray-btn w-full !min-h-12 !text-[17px] disabled:opacity-50" data-quiet
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Wie viele Bewertungen an der Substanz haengen; null, solange unbekannt. */
function useBewertungsZahl(stackItemId: string | null): number | null {
  const [zahl, setZahl] = useState<{ id: string; n: number } | null>(null)
  useEffect(() => {
    if (!stackItemId) return
    let aktuell = true
    void supabase.from('reviews').select('id').eq('stack_item_id', stackItemId).then(({ data, error }) => {
      if (aktuell && !error) setZahl({ id: stackItemId, n: data?.length ?? 0 })
    })
    return () => { aktuell = false }
  }, [stackItemId])
  return zahl && zahl.id === stackItemId ? zahl.n : null
}
