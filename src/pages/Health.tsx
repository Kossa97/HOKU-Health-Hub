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
  if (bmi < 18.5) return { text: 'Untergewicht',  color: '#f59e0b' }
  if (bmi < 25)   return { text: 'Normalgewicht', color: '#10b981' }
  if (bmi < 30)   return { text: 'Übergewicht',   color: '#f59e0b' }
  return           { text: 'Adipositas',           color: '#f43f5e' }
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

const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
}

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
    <div className="h-20 rounded-2xl border border-white/[0.06] bg-white/[0.025] flex items-center justify-center text-xs text-slate-500">
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
      <path d="M8 74 H132" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <path d="M8 50 H132" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <path d="M8 26 H132" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <polyline points={points} fill="none" stroke="url(#weightLine)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.split(' ').map(point => {
        const [x, y] = point.split(',')
        return <circle key={point} cx={x} cy={y} r="3.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
      })}
    </svg>
  )
}

// ─── Device-Karte ─────────────────────────────────────────────────────────────

function DeviceCard({ metric }: { metric: DeviceMetric }) {
  return (
    <div className="rounded-2xl p-4 min-h-[128px] flex flex-col justify-between" style={cardStyle}>
      <div className="flex items-center justify-between gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${metric.color}1A`, border: `1px solid ${metric.color}33` }}>
          <metric.icon size={18} color={metric.color} />
        </div>
        {!isNative && <Shield size={14} className="text-slate-600" />}
      </div>
      <div>
        <p className="text-xl font-bold text-white leading-tight">
          {!isNative ? 'Nur in der App verfügbar' : metric.loading ? '...' : metric.value}
        </p>
        <p className="text-[0.68rem] uppercase tracking-[0.08em] text-slate-500 mt-1">{metric.label}</p>
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
    { key: 'steps', icon: Footprints, value: stepsToday,  label: 'Schritte heute',    color: '#00ccf5', loading: loadingDevice },
    { key: 'heart', icon: HeartPulse, value: heartRate,   label: 'Herzrate',          color: '#f43f5e', loading: loadingDevice },
    { key: 'sleep', icon: BedDouble,  value: sleepHours,  label: 'Schlaf letzte Nacht', color: '#8b5cf6', loading: loadingDevice },
    { key: 'hrv',   icon: Activity,   value: '—',         label: 'HRV',               color: '#10b981', loading: false },
  ]

  return (
    <div className="space-y-5 pb-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-sky-400/70 mb-1">Deine Körperdaten</p>
        <h1 className="text-2xl font-black tracking-tight text-white">Health</h1>
      </header>

      {/* ── Gewicht ──────────────────────────────────────────────────────── */}
      <section className="rounded-[1.5rem] p-5 overflow-hidden relative" style={cardStyle}>
        <div className="absolute -right-12 -top-12 w-36 h-36 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
        <div className="flex items-start justify-between gap-4 mb-4 relative">
          <div>
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-[0.12em] mb-2">
              <Scale size={15} className="text-sky-400" />
              Gewicht
            </div>
            {loadingWeight ? (
              <p className="text-3xl font-black text-white">...</p>
            ) : latestWeight ? (
              <>
                <p className="text-5xl font-black tracking-[-0.06em] text-white leading-none">
                  {fmtNum(latestWeight.weight_kg)} <span className="text-lg text-slate-400 tracking-normal">kg</span>
                </p>
                <p className="text-xs text-slate-500 mt-2">Letzter Eintrag {fmtDate(latestWeight.logged_at)}</p>
              </>
            ) : (
              <p className="text-3xl font-black text-slate-500">Noch kein Wert</p>
            )}
          </div>
          <button
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent)', color: 'var(--accent-contrast)', boxShadow: '0 0 24px rgba(0,204,245,0.25)' }}
            onClick={() => { setWeightForm({ logged_at: todayStr(), weight_kg: latestWeight ? String(latestWeight.weight_kg) : '' }); setShowWeightForm(true) }}
          >
            <Plus size={22} strokeWidth={3} />
          </button>
        </div>
        <WeightSparkline entries={weightLogs} />

        {/* Mini-Verlauf Gewicht → idealRange */}
        {idealRange && (
          <p className="text-[0.68rem] text-slate-500 mt-3">
            Idealgewicht ({sexLabel}): {fmtNum(idealRange.min)} – {fmtNum(idealRange.max)} kg
          </p>
        )}
      </section>

      {/* ── Körperprofil + Berechnungen ──────────────────────────────────── */}
      <section className="rounded-[1.5rem] p-5 relative" style={cardStyle}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Körperprofil</p>
          <button
            className="flex items-center gap-1.5 text-sky-400 text-xs font-semibold"
            onClick={openProfileForm}
          >
            <Pencil size={13} /> Bearbeiten
          </button>
        </div>

        {/* Stats-Grid */}
        <div className="grid grid-cols-2 gap-3">

          {/* Alter */}
          <StatCell
            label="Alter"
            value={age ? `${age} J.` : '—'}
            color="#00ccf5"
          />

          {/* Geschlecht */}
          <StatCell
            label="Geschlecht"
            value={sexLabel ?? '—'}
            color="#00ccf5"
          />

          {/* Größe */}
          <StatCell
            label="Größe"
            value={healthProfile.height_cm ? `${healthProfile.height_cm} cm` : '—'}
            color="#00ccf5"
          />

          {/* BMI */}
          <div className="rounded-2xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-slate-500 mb-1">BMI</p>
            {bmi && bmiInfo ? (
              <>
                <p className="text-xl font-black text-white leading-tight">{fmtNum(bmi, 1)}</p>
                <p className="text-[0.68rem] font-semibold mt-0.5" style={{ color: bmiInfo.color }}>{bmiInfo.text}</p>
              </>
            ) : (
              <p className="text-xl font-black text-slate-500">—</p>
            )}
          </div>

          {/* Körperfett (geschätzt) */}
          <StatCell
            label="Körperfett (est.)"
            value={bodyFat != null ? `≈ ${fmtNum(Math.max(0, bodyFat), 1)} %` : '—'}
            color="#8b5cf6"
            note="Deurenberg-Formel"
          />

          {/* Idealgewicht */}
          <StatCell
            label="Idealgewicht"
            value={idealRange ? `${fmtNum(idealRange.min)}–${fmtNum(idealRange.max)} kg` : '—'}
            color="#10b981"
            note="Devine-Formel"
          />
        </div>

        {/* Notizen */}
        {healthProfile.notes && (
          <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(0,204,245,0.04)', border: '1px solid rgba(0,204,245,0.10)' }}>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-sky-400/60 mb-1">Notizen</p>
            <p className="text-sm text-slate-300 leading-relaxed">{healthProfile.notes}</p>
          </div>
        )}

        {!healthProfile.height_cm && !age && (
          <p className="text-xs text-slate-500 mt-3 text-center">
            Trage Geburtsdatum, Geschlecht und Größe ein, um BMI & Co. zu berechnen.
          </p>
        )}
      </section>

      {/* ── Device Health ────────────────────────────────────────────────── */}
      <section>
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-slate-500 mb-3">Device Health</p>
        <div className="grid grid-cols-2 gap-3">
          {deviceMetrics.map(m => <DeviceCard key={m.key} metric={m} />)}
        </div>
      </section>

      {/* ── Schnellzugriff ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-slate-500">Schnellzugriff</p>
        <QuickLink to="/blutwerte" icon={<Droplets size={18} color="#f43f5e" />} bg="rgba(244,63,94,0.10)" border="rgba(244,63,94,0.18)"
          title="Blutwerte" sub="Labormarker · IGF-1 · Hormone · CRP" />
        <QuickLink to="/protokoll" icon={<FileText size={18} color="#8b5cf6" />} bg="rgba(139,92,246,0.10)" border="rgba(139,92,246,0.18)"
          title="Protokoll" sub="PDF-Report · Adherence-Auswertung · Charts" />
      </section>

      {/* ── Gewicht-Modal ────────────────────────────────────────────────── */}
      {showWeightForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" data-app-modal onClick={() => setShowWeightForm(false)}>
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg p-6 pb-8 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Neues Gewicht</h2>
            <div>
              <label className="label">Datum</label>
              <input className="input" type="date" value={weightForm.logged_at}
                onChange={e => setWeightForm(f => ({ ...f, logged_at: e.target.value }))} />
            </div>
            <div>
              <label className="label">Gewicht (kg)</label>
              <input className="input" inputMode="decimal" placeholder="82,5" value={weightForm.weight_kg}
                onChange={e => setWeightForm(f => ({ ...f, weight_kg: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" data-app-back-close onClick={() => setShowWeightForm(false)}>Abbrechen</button>
              <button className="btn-primary flex-1" onClick={saveWeight} disabled={savingWeight}>
                {savingWeight ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Körperprofil-Modal ───────────────────────────────────────────── */}
      {showProfileForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" data-app-modal onClick={() => setShowProfileForm(false)}>
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg p-6 pb-8 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Körperprofil bearbeiten</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="health-birth">Geburtsdatum</label>
                <input id="health-birth" className="input" type="date" min="1900-01-01" max={todayStr()} value={profileForm.birthDate}
                  onChange={e => setProfileForm(f => ({ ...f, birthDate: e.target.value }))} />
              </div>
              <div>
                <label className="label" htmlFor="health-sex">Biologisches Geschlecht</label>
                <select id="health-sex" className="select" value={profileForm.sex}
                  onChange={e => setProfileForm(f => ({ ...f, sex: e.target.value as ProfileForm['sex'] }))}>
                  <option value="">Keine Angabe</option>
                  <option value="male">Männlich</option>
                  <option value="female">Weiblich</option>
                </select>
              </div>
              <p className="col-span-2 -mt-1 text-xs text-slate-500">Dieselben Angaben wie bei den Blutwerten – sie bestimmen dort auch die Referenzbereiche.</p>
              <div className="col-span-2">
                <label className="label">Größe (cm)</label>
                <input className="input" type="number" placeholder="181" value={profileForm.height_cm}
                  onChange={e => setProfileForm(f => ({ ...f, height_cm: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Persönliche Notizen</label>
              <textarea className="input resize-none" rows={3} placeholder="Vorerkrankungen, Ziele, Anmerkungen..."
                value={profileForm.notes} onChange={e => setProfileForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" data-app-back-close onClick={() => setShowProfileForm(false)}>Abbrechen</button>
              <button className="btn-primary flex-1" onClick={saveProfile} disabled={savingProfile}>
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

function StatCell({ label, value, color, note }: { label: string; value: string; color: string; note?: string }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-black leading-tight" style={{ color: value === '—' ? 'var(--text-muted)' : color }}>{value}</p>
      {note && <p className="text-[0.58rem] text-slate-600 mt-0.5">{note}</p>}
    </div>
  )
}

function QuickLink({ to, icon, bg, border, title, sub }: {
  to: string; icon: React.ReactNode; bg: string; border: string; title: string; sub: string
}) {
  return (
    <Link to={to} className="rounded-2xl p-4 flex items-center justify-between gap-3 transition-opacity hover:opacity-85"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: bg, border: `1px solid ${border}` }}>
          {icon}
        </div>
        <div>
          <p className="text-white font-bold text-sm">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
        </div>
      </div>
      <ChevronRight size={18} className="text-slate-600 shrink-0" />
    </Link>
  )
}
