// Silhouetten beim Laden: der Umriss der kommenden Seite in ruhig atmenden
// grauen Formen (Stil in liquid-glass.css, .lg-skel / .lg-ph). Jede Seite hat
// ihren eigenen Umriss in den Maßen der echten Seite, damit beim Übergang
// nichts springt.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { getDosageForm } from '../../features/my-stack/lib/dosageForms'
import { FORM_UMRISSE } from '../../features/my-stack/stage/formUmrisse'
import type { DosageFormKey } from '../../features/my-stack/types'
import { leseStackAnsicht, leseStackBild } from './silhouettenBild'
import { ketteBeenden, kettenStart, SICHTBAR_NACH, silhouetteFuerPfad, type SilhouettenArt } from './silhouetteTakt'

/** Eine Platzhalterform. Breite/Höhe in px oder als CSS-Wert. */
export function Ph({ w = '100%', h, shape, className = '', style }: {
  w?: number | string
  h: number | string
  shape?: 'round' | 'pill'
  className?: string
  style?: CSSProperties
}) {
  return <span aria-hidden="true" data-shape={shape} className={`lg-ph ${className}`} style={{ width: w, height: h, ...style }} />
}

/** Eine stille Kartenfläche, in der Platzhalter liegen. */
export function SkelKarte({ children, className = '', style }: { children?: ReactNode; className?: string; style?: CSSProperties }) {
  return <div aria-hidden="true" className={`lg-skel-card ${className}`} style={style}>{children}</div>
}

/** Hülle: meldet „Laden" an Screenreader und blendet erst nach 250 ms ein. */
export function Silhouette({ children, className = '', label }: { children: ReactNode; className?: string; label?: string }) {
  const { t } = useTranslation()
  // Folgt sie direkt auf eine andere, setzt sie deren Einblenden fort
  const [start] = useState(() => kettenStart(performance.now()))
  const [verzoegerung] = useState(() => SICHTBAR_NACH - (performance.now() - start))
  useEffect(() => () => ketteBeenden(start, performance.now()), [start])
  return (
    <div role="status" aria-busy="true" data-silhouette className={`lg-skel ${className}`} style={{ animationDelay: `${verzoegerung}ms` }}>
      <span className="sr-only">{label ?? t('loading', { defaultValue: 'Lädt…' })}</span>
      {children}
    </div>
  )
}

function Kopf({ titel = '46%', knoepfe = 1, knopf, abstand = 'mb-5' }: { titel?: number | string; knoepfe?: number; knopf?: ReactNode; abstand?: string }) {
  return (
    <div className={`${abstand} flex items-center justify-between gap-3`}>
      <Ph w={titel} h={32} style={{ borderRadius: 9 }} />
      <div className="flex gap-2.5">
        {knopf ?? Array.from({ length: knoepfe }, (_, i) => <Ph key={i} w={44} h={44} shape="round" />)}
      </div>
    </div>
  )
}

function Abschnitt({ w = '48%', rechts }: { w?: number | string; rechts?: number }) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between px-1">
      <Ph w={w} h={20} />
      {rechts ? <Ph w={rechts} h={14} /> : null}
    </div>
  )
}

function Chips({ breiten }: { breiten: number[] }) {
  return (
    <div className="mb-4 flex gap-2 overflow-hidden">
      {breiten.map((w, i) => <Ph key={i} w={w} h={34} shape="pill" />)}
    </div>
  )
}

export function Zeilen({ breiten, h = 12, gap = 9 }: { breiten: (number | string)[]; h?: number; gap?: number }) {
  return (
    <div className="flex flex-col" style={{ gap }}>
      {breiten.map((w, i) => <Ph key={i} w={w} h={h} />)}
    </div>
  )
}

function Start() {
  return (
    <>
      <Ph w={150} h={14} className="mb-2.5 ml-1" />
      <Kopf titel="62%" />
      <SkelKarte className="flex items-center gap-6 p-6">
        <Ph w={76} h={76} shape="round" />
        <Zeilen breiten={['46%', '72%']} h={14} gap={12} />
      </SkelKarte>
      <Abschnitt w="62%" rechts={52} />
      <SkelKarte className="p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Ph w={70} h={14} />
          <Ph w="62%" h={42} shape="pill" />
        </div>
        <div className="flex items-center gap-3">
          <Ph w={30} h={30} shape="round" />
          <Ph w="55%" h={14} />
        </div>
      </SkelKarte>
      <Abschnitt w="44%" rechts={64} />
      <div className="grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map(i => (
          <SkelKarte key={i} className="flex h-[128px] flex-col justify-end gap-2.5 p-3.5">
            <Ph w={24} h={26} />
            <Ph w="80%" h={11} />
          </SkelKarte>
        ))}
      </div>
    </>
  )
}

function Kalender() {
  return (
    <>
      <Kopf titel="44%" />
      <div className="mb-6 flex items-center justify-between px-1">
        <Ph w="52%" h={18} />
        <div className="flex gap-6"><Ph w={14} h={20} /><Ph w={14} h={20} /></div>
      </div>
      <div className="mb-8 grid grid-cols-7 justify-items-center gap-1">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-2.5">
            <Ph w={20} h={10} />
            <Ph w={36} h={36} shape="round" />
          </div>
        ))}
      </div>
      <div className="mb-4 flex items-center justify-between px-1">
        <Ph w="54%" h={20} />
        <Ph w={84} h={14} />
      </div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Ph w={84} h={13} className="ml-3" />
        <Ph w="62%" h={44} shape="pill" />
      </div>
      <EinnahmenUmriss />
    </>
  )
}

/** Eine Einnahme im Kalender: Uhrzeit, Name, Dosis, Knöpfe. */
export function EinnahmenUmriss() {
  return (
    <SkelKarte className="p-5">
      <Ph w={70} h={12} className="mb-3" />
      <Ph w="46%" h={24} className="mb-2.5" />
      <Ph w="58%" h={14} className="mb-6" />
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2].map(i => <Ph key={i} h={48} shape="pill" />)}
      </div>
    </SkelKarte>
  )
}

// Die Höhe der echten Seite: Bildschirm ohne Statusleiste, oberen Rand und
// Tab-Leiste (Layout.tsx). Die Bühne darin füllt, was übrig bleibt — wie dort.
const STACK_HOEHE = 'max(440px, calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 1rem - var(--bottom-nav-height)))'

/**
 * My Stack, so wie es gleich dasteht: Bühne oder Liste, und auf der Bühne die
 * Form, die zuerst kommt — ein Pen als Pen, nicht als Vial (silhouettenBild.ts).
 * Ohne Gemerktes steht ein Vial da, die häufigste Form.
 */
function Stack() {
  const [bild] = useState(leseStackBild)
  const [ansicht] = useState(leseStackAnsicht)
  if (bild?.gesamt === 0) {
    return (
      <>
        <Kopf titel="40%" knoepfe={3} />
        <SkelKarte className="flex flex-col items-center gap-5 px-5 py-10">
          <Ph w="58%" h={14} />
          <Ph w={150} h={190} style={{ borderRadius: 18 }} />
        </SkelKarte>
      </>
    )
  }
  const zeilen = Math.min(bild?.gesamt ?? 4, 8)
  if (ansicht === 'list') return <StackListe zeilen={zeilen} />
  // Nichts Darstellbares auf der Bühne: die Seite zeigt Reiter und Zeilen
  if (bild && bild.form === null) return <StackListe zeilen={zeilen} mitReitern />
  return (
    <div className="flex flex-col" style={{ height: STACK_HOEHE }}>
      <Kopf titel="40%" knoepfe={3} abstand="mb-4" />
      {/* Reiter: py-1 und mb-2 wie StackTabBar */}
      <div className="mb-2 flex gap-2 overflow-hidden py-1"><StackReiter /></div>
      <div className="mb-1 flex items-center justify-between px-1">
        <Ph w={44} h={44} shape="round" />
        <div className="flex gap-1.5"><Ph w={130} h={32} shape="pill" /><Ph w={66} h={32} shape="pill" /></div>
        <Ph w={44} h={44} shape="round" />
      </div>
      <BuehnenForm form={bild?.form ?? 'vial'} pegel={bild?.pegel ?? true} />
      <PositionsZeile anzahl={bild?.buehne ?? 3} />
    </div>
  )
}

function StackReiter() {
  return <>{[88, 124, 158, 120].map((w, i) => <Ph key={i} w={w} h={36} shape="pill" />)}</>
}

/** Die Form auf der Bühne, eingepasst wie StageFit: Anteil der Höhe, höchstens die Breite. */
function BuehnenForm({ form, pegel }: { form: DosageFormKey; pegel: boolean }) {
  const definition = getDosageForm(form)
  const umriss = FORM_UMRISSE[definition.stageRenderer ?? 'vial']
  return (
    // pt-2/pb-4: Innenabstand des Eintrags und Unterkante des Streifens (VialCarousel)
    <div className="flex min-h-0 flex-1 flex-col pb-4 pt-2">
      {/* Eintragsbreite min(17rem, 70vw) abzüglich px-2 */}
      <div className="relative mx-auto min-h-0 w-[calc(min(17rem,70vw)-16px)] flex-1">
        <svg
          aria-hidden="true"
          viewBox={umriss.viewBox}
          preserveAspectRatio="xMidYMax meet"
          className="lg-ph-form absolute bottom-0 left-1/2 max-w-full -translate-x-1/2"
          style={{ height: `${(definition.stageHeightRatio ?? 1) * 100}%` }}
        >
          {/* Deckkraft auf der Gruppe: wo Teile überlappen (Kappe auf Körper), wird es nicht dunkler */}
          <g>{umriss.pfade.map(({ d, transform }, i) => <path key={i} d={d} transform={transform} />)}</g>
        </svg>
      </div>
      <div className="mt-1 flex h-[19px] items-center justify-center">{pegel ? <Ph w={34} h={11} /> : null}</div>
    </div>
  )
}

/**
 * „+", ein Punkt je Eintrag (der erste als Strich), ab acht eine Leiste — wie
 * VialPositionRow. „1 / n" steht dort absolut daneben, die Punkte bleiben mittig.
 */
function PositionsZeile({ anzahl }: { anzahl: number }) {
  return (
    <div className="mb-2 mt-1 flex h-2.5 items-center justify-center">
      <div className="relative flex items-center gap-2.5">
        <Ph w={16} h={16} shape="round" />
        {anzahl > 7
          ? <Ph w={96} h={4} shape="pill" />
          : Array.from({ length: anzahl }, (_, i) => <Ph key={i} w={i === 0 ? 20 : 6} h={6} shape="pill" />)}
        <Ph w={30} h={11} className="absolute left-full top-1/2 ml-2 -translate-y-1/2" />
      </div>
    </div>
  )
}

/** Die Liste: eine gruppierte Fläche, je Eintrag Objekt, Name mit Status, Zusammensetzung, Haltbarkeit. */
function StackListe({ zeilen, mitReitern = false }: { zeilen: number; mitReitern?: boolean }) {
  return (
    <>
      <Kopf titel="40%" knoepfe={3} abstand={mitReitern ? 'mb-4' : 'mb-3'} />
      {mitReitern ? <div className="mb-2 flex gap-2 overflow-hidden py-1"><StackReiter /></div> : null}
      <SkelKarte className="flex flex-col">
        {Array.from({ length: zeilen }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 pl-3 pr-3">
            <div className="flex h-14 w-11 shrink-0 items-center justify-center"><Ph w={20} h={46} style={{ borderRadius: 6 }} /></div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between gap-3"><Ph w={['46%', '38%', '52%'][i % 3]} h={16} /><Ph w={50} h={20} shape="pill" /></div>
              <Ph w={['40%', '48%', '36%'][i % 3]} h={12} />
              <Ph w={92} h={20} shape="pill" />
            </div>
          </div>
        ))}
      </SkelKarte>
    </>
  )
}

function Blutwerte() {
  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-col gap-2.5">
          <Ph w="56%" h={32} style={{ borderRadius: 9 }} />
          <Ph w="62%" h={20} />
        </div>
        <div className="flex gap-2.5"><Ph w={44} h={44} shape="round" /><Ph w={44} h={44} shape="round" /></div>
      </div>
      <Ph h={36} shape="pill" className="mb-5" />
      <Chips breiten={[118, 60, 90, 110]} />
      <MarkerUmriss />
    </>
  )
}

/** Die Markerkarten der Blutwerte: Name, Datum, Verlauf, Wert. */
export function MarkerUmriss() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {['70%', '62%', '56%', '40%'].map((w, i) => (
        <SkelKarte key={i} className="flex h-[178px] flex-col justify-between p-4">
          <div className="flex flex-col gap-2"><Ph w={w} h={15} /><Ph w="54%" h={11} /></div>
          <Ph h={34} />
          <div className="flex items-end justify-between"><Ph w="40%" h={22} /><Ph w="38%" h={26} style={{ borderRadius: 10 }} /></div>
        </SkelKarte>
      ))}
    </div>
  )
}

function Liste() {
  return (
    <>
      <Kopf titel="48%" knopf={<Ph w={92} h={42} shape="pill" />} />
      <Ph h={38} shape="pill" className="mb-4" />
      <Chips breiten={[54, 100, 134]} />
      <div className="mb-4 grid grid-cols-[1.4fr_1fr] gap-2.5"><Ph h={44} shape="pill" /><Ph h={44} shape="pill" /></div>
      <div className="flex flex-col gap-3">
        {[['36%', '50%'], ['30%', '64%', '54%'], ['40%', '42%']].map((zeilen, i) => (
          <SkelKarte key={i} className="p-5">
            <Ph w={zeilen[0]} h={12} className="mb-3" />
            <Ph w={zeilen[1]} h={20} className="mb-3" />
            <Ph w="62%" h={12} />
            {zeilen[2] ? <Ph w={zeilen[2]} h={12} className="mt-3" /> : null}
          </SkelKarte>
        ))}
      </div>
    </>
  )
}

function Lab() {
  return (
    <>
      <SkelKarte className="mb-7 p-5"><Zeilen breiten={['30%', '92%', '80%']} /></SkelKarte>
      <Ph w={96} h={11} className="mb-3 ml-1" />
      <Ph w="38%" h={32} className="mb-3" style={{ borderRadius: 9 }} />
      <Ph w="86%" h={14} className="mb-5" />
      <div className="mb-3 grid grid-cols-[1fr_96px] gap-2.5"><Ph h={44} shape="pill" /><Ph h={44} shape="pill" /></div>
      <Chips breiten={[84, 78, 66, 90]} />
      <div className="flex flex-col gap-3">
        {[0, 1].map(i => (
          <SkelKarte key={i} className="p-5">
            <Ph w="34%" h={13} className="mb-5" />
            <Zeilen breiten={['22%', '58%']} h={14} gap={14} />
            <Ph w={100} h={16} className="mt-5" />
          </SkelKarte>
        ))}
      </div>
    </>
  )
}

function Profil() {
  return (
    <>
      <Kopf titel="50%" knopf={<Ph w={116} h={40} shape="pill" />} />
      <div className="mb-7 flex flex-col items-center gap-4">
        <Ph w={80} h={80} shape="round" />
        <Ph w={140} h={14} />
      </div>
      <SkelKarte className="mb-4 p-5">
        <div className="mb-5 flex items-center justify-between"><Ph w="44%" h={18} /><Ph w={51} h={31} shape="pill" /></div>
        <Zeilen breiten={['90%', '64%']} />
      </SkelKarte>
      <SkelKarte className="p-5">
        <Ph w="58%" h={18} className="mb-5" />
        <Ph h={84} style={{ borderRadius: 18 }} className="mb-5" />
        <Zeilen breiten={['92%', '74%', '84%']} />
      </SkelKarte>
    </>
  )
}

function Karten() {
  return (
    <>
      <Kopf titel="52%" />
      <Ph w="70%" h={14} className="-mt-2 mb-6 ml-1" />
      <div className="flex flex-col gap-3">
        <SkelKarte className="p-5">
          <Ph w="40%" h={16} className="mb-4" />
          <Ph h={96} className="mb-4" />
          <Zeilen breiten={['74%', '52%']} />
        </SkelKarte>
        {[0, 1].map(i => (
          <SkelKarte key={i} className="flex items-center gap-4 p-5">
            <Ph w={40} h={40} style={{ borderRadius: 11 }} />
            <div className="flex-1"><Zeilen breiten={['56%', '38%']} /></div>
          </SkelKarte>
        ))}
      </div>
    </>
  )
}

const UMRISSE: Record<SilhouettenArt, () => ReactNode> = {
  start: Start, kalender: Kalender, stack: Stack, blutwerte: Blutwerte,
  liste: Liste, lab: Lab, profil: Profil, karten: Karten,
}

/** Der Umriss einer ganzen Seite. */
export function SeitenSilhouette({ art, className }: { art: SilhouettenArt; className?: string }) {
  const Umriss = UMRISSE[art]
  return <Silhouette className={className}><Umriss /></Silhouette>
}

/** Umriss außerhalb des Seitengerüsts (Anmeldung, Zustimmung): dieselben Ränder wie <main>. */
export function SilhouettenHuelle({ pfad }: { pfad: string }) {
  return <div className="px-3 pt-4"><SeitenSilhouette art={silhouetteFuerPfad(pfad)} /></div>
}

/** Kurvenkarten (Blutspiegel): Name, Kurve, Kennzahlen. */
export function KurvenUmriss({ anzahl = 2, hoehe = 120 }: { anzahl?: number; hoehe?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: anzahl }, (_, i) => (
        <SkelKarte key={i} className="p-5">
          <div className="mb-4 flex items-center justify-between"><Ph w="38%" h={16} /><Ph w={64} h={22} shape="pill" /></div>
          <Ph h={hoehe} className="mb-4" style={{ borderRadius: 14 }} />
          <div className="flex gap-6"><Ph w="22%" h={12} /><Ph w="22%" h={12} /><Ph w="22%" h={12} /></div>
        </SkelKarte>
      ))}
    </div>
  )
}

/** Studienkarten im Lab: Quelle, Titel über zwei Zeilen, Autoren. */
export function StudienUmriss({ anzahl = 3 }: { anzahl?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: anzahl }, (_, i) => (
        <SkelKarte key={i} className="p-5">
          <div className="mb-4 flex gap-2"><Ph w={74} h={20} shape="pill" /><Ph w={46} h={20} shape="pill" /></div>
          <Zeilen breiten={['94%', i % 2 ? '58%' : '72%']} h={16} gap={10} />
          <Ph w="44%" h={11} className="mt-4" />
        </SkelKarte>
      ))}
    </div>
  )
}
