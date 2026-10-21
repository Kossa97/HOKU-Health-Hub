/**
 * Auswahl hinter dem „+" der Blutwerte: Dokument oder Foto (Werte liest die
 * KI aus — der Import fragt vorher nach der Einwilligung) oder manuelle Eingabe.
 */
import { useTranslation } from 'react-i18next'
import { Camera, ChevronRight, FileText, PenLine, Sparkles, type LucideIcon } from 'lucide-react'
import { CYAN, MUTED, TEXT } from '../styles'
import { SheetGriff } from '../../../components/ui/SheetGriff'

export type AddChoice = 'document' | 'photo' | 'manual'

interface Props {
  onPick: (choice: AddChoice) => void
  onClose: () => void
}

const OPTIONS: Array<{ key: AddChoice; icon: LucideIcon; title: string; desc: string; ki?: boolean }> = [
  { key: 'document', icon: FileText, title: 'bw_add_document', desc: 'bw_add_document_desc', ki: true },
  { key: 'photo', icon: Camera, title: 'bw_add_photo', desc: 'bw_add_photo_desc', ki: true },
  { key: 'manual', icon: PenLine, title: 'bw_add_manual_entry', desc: 'bw_add_manual_desc' },
]

export function AddSheet({ onPick, onClose }: Props) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-[var(--tyd-popup-top)]" data-app-modal onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bw-add-title"
        className="lg-sheet w-full max-w-lg px-4 pb-4 pt-2"
        onClick={e => e.stopPropagation()}
      >
        <SheetGriff className="mb-3" onClose={onClose} />
        <h2 id="bw-add-title" className="lg-title2 mb-3 px-1">{t('bw_add_title')}</h2>
        <div className="lg-group lg-rows">
          {OPTIONS.map(({ key, icon: Icon, title, desc, ki }) => (
            <button
              key={key}
              type="button"
              onClick={() => onPick(key)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-white/[0.06]"
            >
              <span className="lg-icon-tile relative !h-9 !w-9" style={{ background: ki ? '#0a84ff' : '#636366' }}>
                <Icon size={18} aria-hidden="true" />
                {/* KI-Sterne: diese Wege lesen die Werte per KI aus */}
                {ki && (
                  <Sparkles
                    aria-hidden="true"
                    data-bw-ki-badge
                    size={14}
                    strokeWidth={1.5}
                    fill="currentColor"
                    className="absolute -right-1.5 -top-1.5"
                    style={{ color: CYAN }}
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold" style={{ color: TEXT }}>{t(title)}</span>
                <span className="block text-[13px] leading-snug" style={{ color: 'var(--lg-text-2)' }}>{t(desc)}</span>
              </span>
              <ChevronRight size={18} aria-hidden="true" style={{ color: MUTED }} />
            </button>
          ))}
        </div>
        <button type="button" data-quiet className="lg-gray-btn mt-3 w-full !min-h-12 !text-[17px]" data-app-back-close onClick={onClose}>{t('cancel')}</button>
      </div>
    </div>
  )
}
