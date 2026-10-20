// Unauthentifizierte Preview-Route für das PDF-Muster-Modal (wie /__vialpreview).
import { useState } from 'react'
import { ProtocolPdfModal } from '../components/ProtocolPdfModal'
import type { ProtocolData } from '../lib/protocolPdf/types'

const DEMO_DATA: ProtocolData = {
  profile: {
    display_name: 'Max Muster',
    username: 'max',
    age: 32,
    gender: 'männlich',
    height_cm: 182,
    weight_kg: 84,
  },
  cycles: [
    {
      id: 'c1',
      name: 'Zyklus',
      stack_item_name: 'BPC-157',
      dose: 250,
      unit: 'mcg',
      method: 'SC',
      frequency: 'Täglich',
      start_date: '2026-01-01',
      end_date: null,
      active: true,
    },
  ],
  doseLogs: [
    { stack_item_id: 'p1', logged_at: '2026-06-01T08:00:00Z', taken: true },
    { stack_item_id: 'p1', logged_at: '2026-06-02T08:00:00Z', taken: false },
    { stack_item_id: 'p1', logged_at: '2026-06-03T08:00:00Z', taken: true },
  ],
  weightLogs: [
    { logged_at: '2026-06-01T08:00:00Z', weight_kg: 84 },
    { logged_at: '2026-06-15T08:00:00Z', weight_kg: 82.5 },
    { logged_at: '2026-06-29T08:00:00Z', weight_kg: 81.2 },
  ],
  // Leer gelassen: ausgegraute Sektion + Toast „keine Daten“ im Modal testbar.
  bloodwork: [],
  effects: [
    {
      type: 'effect',
      description: 'Bessere Regeneration',
      severity: 4,
      stack_item_name: 'BPC-157',
      occurred_at: '2026-06-10T08:00:00Z',
    },
  ],
  reviews: [{ stack_item_name: 'BPC-157', rating: 5, experience: 'gut' }],
  dailyLogs: [
    { log_date: '2026-06-01', energie: 6, schlaf: 7, wohlbefinden: 6, libido: 5 },
    { log_date: '2026-06-15', energie: 8, schlaf: 8, wohlbefinden: 7, libido: 7 },
  ],
  stackItemNames: new Map([['p1', 'BPC-157']]),
}

export function PdfPreview() {
  const [open, setOpen] = useState(true)
  // ?variant=page zeigt die Vollseite wie unter /protokoll statt des Modals.
  const asPage = new URLSearchParams(window.location.search).get('variant') === 'page'

  if (asPage) {
    return (
      <div className="min-h-screen px-3 pt-4">
        <ProtocolPdfModal
          userId="__pdf_preview__"
          initialRange={{ from: '2026-06-01', to: '2026-06-30' }}
          uiLang="de"
          previewData={DEMO_DATA}
          variant="page"
          onClose={() => {}}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-200">
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-xl font-bold text-white">PDF-Muster Preview</h1>
        <p className="text-sm text-slate-400">
          Demo ohne Login — Muster Arzt / Coach / Forum + Häkchen. Daten sind Fake-Fixtures.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setOpen(true)}
        >
          Modal öffnen
        </button>
      </div>

      {open && (
        <ProtocolPdfModal
          userId="__pdf_preview__"
          initialRange={{ from: '2026-06-01', to: '2026-06-30' }}
          uiLang="de"
          previewData={DEMO_DATA}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
