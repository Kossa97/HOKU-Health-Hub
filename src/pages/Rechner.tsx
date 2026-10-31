import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeftRight, Syringe } from 'lucide-react'
import { PageShell } from '../components/ui/DesignSystem'
import { useAuth } from '../context/AuthContext'
import { DoseCalculator } from '../features/rechner/components/DoseCalculator'
import { UnitConverter } from '../features/rechner/components/UnitConverter'
import { MedicalNotice } from '../features/compliance/components/MedicalNotice'
import '../features/rechner/rechner.css'

export function Rechner() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [mode, setMode] = useState<'dose' | 'units'>('dose')
  return <PageShell className="rechner-page" style={{ gap: 12 }}>
    <h1 className="rechner-hero lg-large-title min-w-0 truncate">{t('rechner_title')}</h1>
    <div className="rechner-segments" role="group" aria-label={t('rechner_mode')}>
      {([
        { id: 'dose', label: t('rechner_dose_tab'), icon: Syringe },
        { id: 'units', label: t('rechner_units_tab'), icon: ArrowLeftRight },
      ] as const).map(({ id, label, icon: Icon }) => <button key={id} type="button"
        aria-pressed={mode === id} aria-controls={`rechner-${id}`} onClick={() => setMode(id)}>
        <Icon size={18} strokeWidth={1.5} aria-hidden="true" />{label}
      </button>)}
    </div>
    <MedicalNotice />
    <div id="rechner-dose" className="rechner-dose-pane" hidden={mode !== 'dose'}><DoseCalculator key={user?.id ?? 'anonymous'} /></div>
    <div id="rechner-units" className="rechner-units-pane" hidden={mode !== 'units'}><UnitConverter />
      <p className="rechner-muted rechner-disclaimer">{t('info_disclaimer')}</p>
    </div>
  </PageShell>
}
