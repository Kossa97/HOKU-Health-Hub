import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import toast from 'react-hot-toast'
import {
  Activity, BedDouble, ChevronRight, Droplets, Footprints,
  HeartPulse, Pencil, Plus, Scale, Shield, FileText, type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { alterAm } from '../features/blutwerte/lib/referenzbereiche'
import { altfelderAus, geburtsdatumGueltig, geschlechtAusAltangabe, type BioSex } from '../features/blutwerte/lib/bioProfile'
import { getHeartRate, getSleep, getSteps, isNative, requestPermissions } from '../lib/health'
import { SheetGriff } from '../components/ui/SheetGriff'
import { HealthDailyTiles } from '../features/wearables/components/HealthDailyTiles'

// ─── Typen ───────────────────────────────────────────────────────────────────

interface WeightLog {
  id: string
  user_id: string
  logged_at: string
  weight_kg: number | string
  created_at: string | null
}

/**
 * Alter und Geschlecht kommen aus Geburtsdatum und biologischem Geschlecht —
 * dieselben Angaben wie bei den Blutwerten. Die alten Felder `age`/`gender`
 * werden nur noch gelesen, solange die neuen fehlen.
 */
interface HealthProfile {
  birthDate: string | null
  sex: BioSex | null
  legacyAge: number | null
  legacyGender: string
  height_cm: number | null
  notes: string
}

interface WeightForm {
  logged_at: string
  weight_kg: string
}

interface ProfileForm {
  birthDate: string
  sex: '' | BioSex
  height_cm: string
  notes: string
}

interface DeviceMetric {
  key: string
  icon: LucideIcon
  value: string
  label: string
  color: string
  loading?: boolean
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

const todayStr = () => format(new Date(), 'yyyy-MM-dd')
const fmtDate  = (d: string) => format(new Date(`${d}T00:00:00`), 'dd.MM.yyyy')
const fmtNum   = (v: number | string, digits = 1) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits }).format(n) : String(v)
}

function calcBMI(weightKg: number, heightCm: number): number {
  return weightKg / Math.pow(heightCm / 100, 2)
}

function bmiLabel(bmi: number): { text: string; color: string } {
  if (bmi < 18.5) return { text: 'Untergewicht',  color: 'var(--lg-warn-text)' }
  if (bmi < 25)   return { text: 'Normalgewicht', color: 'var(--lg-good-text)' }
  if (bmi < 30)   return { text: 'Übergewicht',   color: 'var(--lg-warn-text)' }
  return           { text: 'Adipositas',           color: 'var(--lg-bad-text)' }
}

// Deurenberg-Formel: Körperfett % aus BMI + Alter + Geschlecht
function estimateBodyFat(bmi: number, age: number, sex: BioSex | null): number | null {
  if (!age || !sex) return null
  const sexFactor = sex === 'female' ? 1 : 0
  return 1.20 * bmi + 0.23 * age - 10.8 * (1 - sexFactor) - 5.4
}

// Idealgewicht nach Devine-Formel
function idealWeightRange(heightCm: number, sex: BioSex | null): { min: number; max: number } | null {
  if (!heightCm || !sex) return null
  const over152 = Math.max(0, heightCm - 152.4)
  const base = sex === 'female' ? 45.5 : 50.0
  const mid  = base + 0.906 * over152
  return { min: Math.round((mid - 5) * 10) / 10, max: Math.round((mid + 5) * 10) / 10 }
}

/** Feldbeschriftung im Sheet: 13 px, ohne Versalien wie in iOS */
const fieldLabel = 'mb-1.5 block pl-1 text-[13px] text-[var(--lg-text-3)]'

// ─── Sparkline ───────────────────────────────────────────────────────────────

function WeightSparkline({ entries }: { entries: WeightLog[] }) {
  const points = useMemo(() => {
    const values = entries.slice(0, 10).reverse().map(e => Number(e.weight_kg)).filter(Number.isFinite)
    if (values.length === 0) return ''
    if (values.length === 1) return `8,42 132,42`
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    return values.map((v, i) => {
      const x = 8 + (i / (values.length - 1)) * 124
      const y = 74 - ((v - min) / range) * 48
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }, [entries])

  if (!points) return (
    <div className="flex h-20 items-center justify-center text-[13px] text-[var(--lg-text-3)]">
      Noch keine Verlaufdaten
    </div>
  )

  return (
    <svg viewBox="0 0 140 84" className="h-20 w-full overflow-visible" role="img" aria-label="Gewichtsverlauf">
      <defs>
        <linearGradient id="weightLine" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#00ccf5" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <path d="M8 74 H132" stroke="var(--lg-separator)" strokeWidth="0.5" />
      <polyline points={points} fill="none" stroke="url(#weightLine)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.split(' ').map(point => {
        const [x, y] = point.split(',')
        return <circle key={point} cx={x} cy={y} r="3.5" fill="#000" stroke="var(--accent)" strokeWidth="2" />
      })}
    </svg>
  )
}

// ─── Device-Karte ─────────────────────────────────────────────────────────────

function DeviceCard({ metric }: { metric: DeviceMetric }) {
  return (
    <div className="lg-surface flex min-h-[124px] flex-col justify-between gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="lg-icon-tile" style={{ background: metric.color }}>
          <metric.icon size={17} strokeWidth={2.4} aria-hidden="true" />
        </span>
        {!isNative && <Shield size={14} className="text-[var(--lg-text-4)]" aria-hidden="true" />}
      </div>
      <div>
        <p className={`font-semibold leading-tight ${!isNative ? 'text-[15px] text-[var(--lg-text-2)]' : 'text-[22px] text-[var(--lg-text)]'}`}>
          {!isNative ? 'Nur in der App verfügbar' : metric.loading ? '...' : metric.value}
        </p>
        <p className="mt-1 text-[13px] text-[var(--lg-text-3)]">{metric.label}</p>
      </div>
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function Health() {
  const { user } = useAuth()

  // Gewicht
  const [weightLogs,    setWeightLogs]    = useState<WeightLog[]>([])
  const [loadingWeight, setLoadingWeight] = useState(true)
  const [showWeightForm,setShowWeightForm]= useState(false)
  const [weightForm,    setWeightForm]    = useState<WeightForm>({ logged_at: todayStr(), weight_kg: '' })
  const [savingWeight,  setSavingWeight]  = useState(false)

  // Körperprofil
  const [healthProfile, setHealthProfile] = useState<HealthProfile>({ birthDate: null, sex: null, legacyAge: null, legacyGender: '', height_cm: null, notes: '' })
  const [showProfileForm, setShowProfileForm] = useState(false)
  const [profileForm,   setProfileForm]   = useState<ProfileForm>({ birthDate: '', sex: '', height_cm: '', notes: '' })
  const [savingProfile, setSavingProfile] = useState(false)

  // Device
  const [loadingDevice, setLoadingDevice] = useState(isNative)
  const [stepsToday,    setStepsToday]    = useState('—')
  const [heartRate,     setHeartRate]     = useState('—')
  const [sleepHours,    setSleepHours]    = useState('—')

  // ── Gewicht laden ────────────────────────────────────────────────────────
  const loadWeights = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('weight_logs').select('*').eq('user_id', user.id)
      .order('logged_at', { ascending: false }).order('created_at', { ascending: false }).limit(30)
    if (error) toast.error('Gewichtseinträge konnten nicht geladen werden')
    else setWeightLogs((data ?? []) as WeightLog[])
    setLoadingWeight(false)
  }, [user])

  // ── Profil laden ─────────────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('profiles').select('birth_date, bio_sex, age, gender, height_cm, notes').eq('id', user.id).single()
    if (data) setHealthProfile({
      birthDate: data.birth_date ?? null,
      sex: data.bio_sex === 'male' || data.bio_sex === 'female' ? data.bio_sex : null,
      legacyAge: data.age ?? null,
      legacyGender: data.gender ?? '',
      height_cm: data.height_cm ?? null,
      notes: data.notes ?? '',
    })
  }, [user])

  useEffect(() => { void loadWeights() }, [loadWeights])
  useEffect(() => { void loadProfile() }, [loadProfile])

  // ── Device-Daten laden (nur nativ) ───────────────────────────────────────
  useEffect(() => {
    if (!isNative) return
    let cancelled = false
    async function load() {
      try {
        const perms = await requestPermissions()
        if (!perms.granted) return
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        const [steps, hrs, sleep] = await Promise.all([
          getSteps({ startDate: todayStart, endDate: new Date() }),
          getHeartRate({ startDate: subDays(new Date(), 1), endDate: new Date(), limit: 20 }),
          getSleep({ startDate: subDays(todayStart, 1), endDate: new Date() }),
        ])
        if (cancelled) return
        setStepsToday(steps ? fmtNum(steps.count, 0) : '—')
        setHeartRate(hrs[0] ? `${fmtNum(hrs[0].bpm, 0)} bpm` : '—')
        const totalH = sleep.filter(s => s.state !== 'InBed').reduce((s, e) => s + e.durationHours, 0)
        setSleepHours(totalH > 0 ? `${fmtNum(totalH, 1)} h` : '—')
      } catch { if (!cancelled) toast.error('Device-Daten konnten nicht geladen werden') }
      finally  { if (!cancelled) setLoadingDevice(false) }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // ── Gewicht speichern ────────────────────────────────────────────────────
  const saveWeight = async () => {
    const kg = Number(weightForm.weight_kg.replace(',', '.'))
    if (!weightForm.logged_at) return toast.error('Bitte ein Datum eintragen')
    if (!Number.isFinite(kg) || kg <= 0) return toast.error('Bitte ein gültiges Gewicht eintragen')
    if (!user) return
    setSavingWeight(true)
    const { error } = await supabase.from('weight_logs').insert({ user_id: user.id, logged_at: weightForm.logged_at, weight_kg: kg })
    if (error) toast.error('Gewicht konnte nicht gespeichert werden')
    else { toast.success('Gewicht gespeichert'); setShowWeightForm(false); setWeightForm({ logged_at: todayStr(), weight_kg: '' }); loadWeights() }
    setSavingWeight(false)
  }

  // ── Profil speichern ─────────────────────────────────────────────────────
  // Schreibt Geburtsdatum und biologisches Geschlecht; die alten Felder
  // age/gender werden passend mitgeschrieben, damit ein Leeren auch leer bleibt.
  const saveProfile = async () => {
    if (!user) return
    if (profileForm.birthDate && !geburtsdatumGueltig(profileForm.birthDate, todayStr())) {
      return toast.error('Bitte ein gültiges Geburtsdatum eintragen')
    }
    setSavingProfile(true)
    const bio = { birthDate: profileForm.birthDate || null, sex: profileForm.sex || null }
    const alt = altfelderAus(bio, todayStr())
    const next = {
      birth_date: bio.birthDate,
      bio_sex: bio.sex,
      ...alt,
      height_cm: profileForm.height_cm ? parseFloat(profileForm.height_cm) : null,
      notes: profileForm.notes || null,
    }
    const { error } = await supabase.from('profiles').update(next).eq('id', user.id)
    if (error) toast.error('Konnte nicht gespeichert werden')
    else {
      toast.success('Körperprofil aktualisiert')
      setHealthProfile(p => ({
        ...p,
        birthDate: next.birth_date,
        sex: next.bio_sex,
        legacyAge: alt.age,
        legacyGender: alt.gender ?? '',
        height_cm: next.height_cm,
        notes: profileForm.notes,
      }))
      setShowProfileForm(false)
    }
    setSavingProfile(false)
  }

  const openProfileForm = () => {
    setProfileForm({
      birthDate: healthProfile.birthDate ?? '',
      // Ohne neue Angabe die alte vorschlagen; gespeichert wird erst beim Speichern.
      sex: healthProfile.sex ?? geschlechtAusAltangabe(healthProfile.legacyGender) ?? '',
      height_cm: healthProfile.height_cm != null ? String(healthProfile.height_cm) : '',
      notes: healthProfile.notes ?? '',
    })
    setShowProfileForm(true)
  }

  // ── Berechnete Werte ────────────────────────────────────────────────────
  const latestWeight = weightLogs[0]
  const currentKg    = latestWeight ? Number(latestWeight.weight_kg) : null
  const bmi          = currentKg && healthProfile.height_cm ? calcBMI(currentKg, healthProfile.height_cm) : null
  const bmiInfo      = bmi ? bmiLabel(bmi) : null
  // Neue Angaben zuerst, sonst die alten (bis jemand das Profil neu speichert)
  const age          = alterAm(healthProfile.birthDate, todayStr()) ?? healthProfile.legacyAge
  const sex          = healthProfile.sex ?? geschlechtAusAltangabe(healthProfile.legacyGender)
  const sexLabel     = sex === 'male' ? 'Männlich' : sex === 'female' ? 'Weiblich'
    : healthProfile.legacyGender === 'divers' ? 'Divers' : null
  const bodyFat      = bmi && age ? estimateBodyFat(bmi, age, sex) : null
  const idealRange   = healthProfile.height_cm ? idealWeightRange(healthProfile.height_cm, sex) : null

  const deviceMetrics: DeviceMetric[] = [
    { key: 'steps', icon: Footprints, value: stepsToday,  label: 'Schritte heute',    color: '#0a84ff', loading: loadingDevice },
    { key: 'heart', icon: HeartPulse, value: heartRate,   label: 'Herzrate',          color: '#ff375f', loading: loadingDevice },
    { key: 'sleep', icon: BedDouble,  value: sleepHours,  label: 'Schlaf letzte Nacht', color: '#5e5ce6', loading: loadingDevice },
    { key: 'hrv',   icon: Activity,   value: '—',         label: 'HRV',               color: '#30d158', loading: false },
  ]

  const openWeightForm = () => {
    setWeightForm({ logged_at: todayStr(), weight_kg: latestWeight ? String(latestWeight.weight_kg) : '' })
    setShowWeightForm(true)
  }

  return (
    <div className="space-y-7 pb-4">
      <header>
        <h1 className="lg-large-title">Health</h1>
        <p className="mt-0.5 text-[15px] text-[var(--lg-text-2)]">Deine Körperdaten</p>
      </header>

      {/* ── Gewicht ──────────────────────────────────────────────────────── */}
      <section className="lg-surface p-5">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-1.5 text-[15px] font-semibold text-[var(--lg-text-2)]">
              <Scale size={16} className="text-[var(--lg-accent-text)]" aria-hidden="true" />
              Gewicht
            </div>
            {loadingWeight ? (
              <p className="text-[34px] font-bold leading-tight text-[var(--lg-text-3)]">...</p>
            ) : latestWeight ? (
              <>
                <p className="text-[44px] font-bold leading-none tracking-[-0.03em] text-[var(--lg-text)] tabular-nums">
                  {fmtNum(latestWeight.weight_kg)} <span className="text-[17px] font-semibold tracking-normal text-[var(--lg-text-2)]">kg</span>
                </p>
                <p className="mt-2 text-[13px] text-[var(--lg-text-3)]">Letzter Eintrag {fmtDate(latestWeight.logged_at)}</p>
              </>
            ) : (
              <p className="text-[28px] font-bold leading-tight text-[var(--lg-text-3)]">Noch kein Wert</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Gewicht eintragen"
            className="lg-btn lg-btn-tint !min-h-11 !w-11 shrink-0 !rounded-full !p-0"
            onClick={openWeightForm}
          >
            <Plus size={22} strokeWidth={2.6} />
          </button>
        </div>
        <WeightSparkline entries={weightLogs} />

        {idealRange && (
          <p className="mt-3 text-[13px] text-[var(--lg-text-3)]">
            Idealgewicht ({sexLabel}): {fmtNum(idealRange.min)} – {fmtNum(idealRange.max)} kg
          </p>
        )}
      </section>

      {/* ── Körperprofil + Berechnungen ──────────────────────────────────── */}
      <section>
        <div className="mb-[7px] flex items-end justify-between gap-3 pr-1">
          <p className="lg-group-title !mb-0">Körperprofil</p>
          <button
            type="button"
            className="-my-2 flex min-h-11 items-center gap-1.5 px-2 text-[15px] font-semibold text-[var(--lg-accent-text)]"
            onClick={openProfileForm}
          >
            <Pencil size={14} aria-hidden="true" /> Bearbeiten
          </button>
        </div>

        <div className="lg-group">
          <ProfileRow label="Alter" value={age ? `${age} J.` : null} />
          <ProfileRow label="Geschlecht" value={sexLabel} />
          <ProfileRow label="Größe" value={healthProfile.height_cm ? `${healthProfile.height_cm} cm` : null} />
          <ProfileRow
            label="BMI"
            value={bmi && bmiInfo ? (
              <>
                <span className="tabular-nums">{fmtNum(bmi, 1)}</span>
                <span className="block text-[13px] font-semibold" style={{ color: bmiInfo.color }}>{bmiInfo.text}</span>
              </>
            ) : null}
          />
          <ProfileRow
            label="Körperfett (est.)"
            note="Deurenberg-Formel"
            value={bodyFat != null ? `≈ ${fmtNum(Math.max(0, bodyFat), 1)} %` : null}
          />
          <ProfileRow
            label="Idealgewicht"
            note="Devine-Formel"
            value={idealRange ? `${fmtNum(idealRange.min)}–${fmtNum(idealRange.max)} kg` : null}
          />
          {healthProfile.notes && (
            <div className="lg-kv" data-wide="true">
              <span>Notizen</span>
              <span>{healthProfile.notes}</span>
            </div>
          )}
        </div>

        {!healthProfile.height_cm && !age && (
          <p className="mx-4 mt-2 text-[13px] leading-snug text-[var(--lg-text-3)]">
            Trage Geburtsdatum, Geschlecht und Größe ein, um BMI & Co. zu berechnen.
          </p>
        )}
      </section>

      {/* ── Device Health ────────────────────────────────────────────────── */}
      <section>
        <p className="lg-group-title">Device Health</p>
        <div className="grid grid-cols-2 gap-3">
          {deviceMetrics.map(m => <DeviceCard key={m.key} metric={m} />)}
        </div>
        {user && <HealthDailyTiles userId={user.id} />}
      </section>

      {/* ── Schnellzugriff ───────────────────────────────────────────────── */}
      <section>
        <p className="lg-group-title">Schnellzugriff</p>
        <div className="lg-group lg-rows">
          <QuickLink to="/blutwerte" icon={<Droplets size={17} strokeWidth={2.4} />} color="#ff375f"
            title="Blutwerte" sub="Labormarker · IGF-1 · Hormone · CRP" />
          <QuickLink to="/protokoll" icon={<FileText size={17} strokeWidth={2.4} />} color="#5e5ce6"
            title="Protokoll" sub="PDF-Report · Adherence-Auswertung · Charts" />
        </div>
      </section>

      {/* ── Gewicht-Modal ────────────────────────────────────────────────── */}
      {showWeightForm && (
        <div className="fixed inset-0 z-50 bg-black/60" data-app-modal onClick={() => setShowWeightForm(false)}>
          <div className="lg-sheet fixed inset-x-2 bottom-2 mx-auto max-h-[calc(100dvh-0.5rem-var(--tyd-popup-top))] max-w-lg space-y-4 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2" onClick={e => e.stopPropagation()}>
            <SheetGriff className="mb-3" onClose={() => setShowWeightForm(false)} />
            <h2 className="lg-title2">Neues Gewicht</h2>
            <div>
              <label className={fieldLabel} htmlFor="health-weight-date">Datum</label>
              <input id="health-weight-date" className="input" type="date" value={weightForm.logged_at}
                onChange={e => setWeightForm(f => ({ ...f, logged_at: e.target.value }))} />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="health-weight-kg">Gewicht (kg)</label>
              <input id="health-weight-kg" className="input" inputMode="decimal" placeholder="82,5" value={weightForm.weight_kg}
                onChange={e => setWeightForm(f => ({ ...f, weight_kg: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" className="lg-gray-btn flex-1 !min-h-12 !text-[17px]" data-quiet data-app-back-close onClick={() => setShowWeightForm(false)}>Abbrechen</button>
              <button type="button" className="lg-btn lg-btn-primary flex-1 !px-4" onClick={saveWeight} disabled={savingWeight}>
                {savingWeight ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Körperprofil-Modal ───────────────────────────────────────────── */}
      {showProfileForm && (
        <div className="fixed inset-0 z-50 bg-black/60" data-app-modal onClick={() => setShowProfileForm(false)}>
          <div className="lg-sheet fixed inset-x-2 bottom-2 mx-auto max-h-[calc(100dvh-0.5rem-var(--tyd-popup-top))] max-w-lg space-y-4 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2" onClick={e => e.stopPropagation()}>
            <SheetGriff className="mb-3" onClose={() => setShowProfileForm(false)} />
            <h2 className="lg-title2">Körperprofil bearbeiten</h2>
            {/* Unter 380 px untereinander: Datum und Auswahl wären sonst abgeschnitten */}
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              <div className="min-w-0">
                <label className={fieldLabel} htmlFor="health-birth">Geburtsdatum</label>
                <input id="health-birth" className="input" type="date" min="1900-01-01" max={todayStr()} value={profileForm.birthDate}
                  onChange={e => setProfileForm(f => ({ ...f, birthDate: e.target.value }))} />
              </div>
              <div className="min-w-0">
                <label className={fieldLabel} htmlFor="health-sex">Biologisches Geschlecht</label>
                <select id="health-sex" className="select" value={profileForm.sex}
                  onChange={e => setProfileForm(f => ({ ...f, sex: e.target.value as ProfileForm['sex'] }))}>
                  <option value="">Keine Angabe</option>
                  <option value="male">Männlich</option>
                  <option value="female">Weiblich</option>
                </select>
              </div>
              <p className="-mt-1 px-1 text-[13px] min-[380px]:col-span-2 leading-snug text-[var(--lg-text-3)]">Dieselben Angaben wie bei den Blutwerten – sie bestimmen dort auch die Referenzbereiche.</p>
              <div className="min-[380px]:col-span-2">
                <label className={fieldLabel} htmlFor="health-height">Größe (cm)</label>
                <input id="health-height" className="input" type="number" placeholder="181" value={profileForm.height_cm}
                  onChange={e => setProfileForm(f => ({ ...f, height_cm: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className={fieldLabel} htmlFor="health-notes">Persönliche Notizen</label>
              <textarea id="health-notes" className="input resize-none" rows={3} placeholder="Vorerkrankungen, Ziele, Anmerkungen..."
                value={profileForm.notes} onChange={e => setProfileForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" className="lg-gray-btn flex-1 !min-h-12 !text-[17px]" data-quiet data-app-back-close onClick={() => setShowProfileForm(false)}>Abbrechen</button>
              <button type="button" className="lg-btn lg-btn-primary flex-1 !px-4" onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-Komponenten ──────────────────────────────────────────────────────────

/** Angabe im Körperprofil: Name links (mit Formel darunter), Wert rechts; fehlt er, ein Strich. */
function ProfileRow({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="lg-kv" data-empty={value == null ? '' : undefined}>
      <span>
        {label}
        {note && <span className="block text-[12px] text-[var(--lg-text-3)]">{note}</span>}
      </span>
      <span className="tabular-nums">{value ?? '—'}</span>
    </div>
  )
}

function QuickLink({ to, icon, color, title, sub }: {
  to: string; icon: React.ReactNode; color: string; title: string; sub: string
}) {
  return (
    <Link to={to} className="flex min-h-[60px] items-center gap-3.5 px-4 py-2.5 transition-colors active:bg-white/[0.06]">
      <span className="lg-icon-tile" style={{ background: color }} aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] text-[var(--lg-text)]">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-[var(--lg-text-3)]">{sub}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-[var(--lg-text-4)]" aria-hidden="true" />
    </Link>
  )
}
