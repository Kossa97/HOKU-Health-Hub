/**
 * Haptik und Töne der Kalorien-Kugel — kurz und genau dann, wenn die Punkte
 * ankommen bzw. herausfallen (Bild, Ton und Vibration im selben Bild).
 *
 * - Haptik: an; nur in der App (Capacitor), im Browser höchstens Android-Vibration.
 * - Töne: aus, bis der Nutzer sie einschaltet (Schalter in den Zielen, gilt
 *   für dieses Gerät). Erzeugt mit Web Audio, keine Audiodateien.
 * Entscheidungen: memory/projects/kalorientracker.md.
 */
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

const SOUND_KEY = 'tyd.orbSounds'

/** Einmal gelesen und hier gehalten — die Ticks laufen in der Animationsschleife. */
let wanted: boolean | null = null

export function soundsWanted(): boolean {
  if (wanted === null) {
    try { wanted = localStorage.getItem(SOUND_KEY) === 'on' } catch { wanted = false }
  }
  return wanted
}

export function setSoundsWanted(on: boolean): void {
  wanted = on
  try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off') } catch { /* gilt bis zum Neuladen */ }
}

// ─── Haptik ─────────────────────────────────────────────────────────────

function vibrate(ms: number) {
  // Web-Rückfall (Android Chrome); iOS Safari kennt ihn nicht. Ohne Nutzergeste blockt Chrome.
  if (navigator.userActivation?.isActive === false) return
  try { navigator.vibrate?.(ms) } catch { /* ohne */ }
}

// Im Browser kein Capacitor-Web-Plugin: es vibriert selbst 20–60 ms, viel zu kräftig für Ticks.
const native = () => Capacitor.isNativePlatform()

function impact(style: ImpactStyle, fallbackMs: number) {
  if (native()) Haptics.impact({ style }).catch(() => {})
  else vibrate(fallbackMs)
}

/** Ein Punkt kommt an (Eintragen) bzw. fällt heraus (Entfernen, leiser). */
export function hapticTick(strong = false) {
  impact(strong ? ImpactStyle.Medium : ImpactStyle.Light, strong ? 8 : 3)
}

/** Ziel erreicht: einmal die Erfolgs-Vibration. */
export function hapticGoal() {
  if (native()) Haptics.notification({ type: NotificationType.Success }).catch(() => {})
  else vibrate(12)
}

/** Mond angetippt (selectionChanged wirkt nur zwischen selectionStart/End — ein leichter Anschlag tut es). */
export function hapticSelect() {
  impact(ImpactStyle.Light, 2)
}

// ─── Töne ───────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null
let master: GainNode | null = null

function audio(): AudioContext | null {
  if (ctx) return ctx
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    ctx = new Ctx()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
    return ctx
  } catch {
    return null
  }
}

/** Browser spielen Ton erst nach einer Geste: beim ersten Tippen auf der Seite freischalten. */
export function unlockAudio() {
  const c = audio()
  if (c && c.state === 'suspended') void c.resume().catch(() => {})
}

/**
 * Ein gläserner „Plink": Sinus mit leiser Oktave darüber, kurzer Anschlag,
 * schnelles Ausklingen. `level` 0–1 (Füllstand) hebt die Tonhöhe — man hört den Fortschritt.
 */
function plink(level: number, gain: number, delay = 0) {
  const c = audio()
  if (!c || !master || c.state !== 'running') return
  const t = c.currentTime + delay
  const f = 560 * 2 ** Math.max(0, Math.min(1, level)) // eine Oktave über den ganzen Tag
  for (const [mult, g] of [[1, gain], [2, gain * 0.25]] as const) {
    const osc = c.createOscillator()
    const env = c.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(f * mult, t)
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(g, t + 0.006)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    osc.connect(env).connect(master)
    osc.start(t)
    osc.stop(t + 0.18)
  }
}

export function soundArrive(level: number) {
  if (soundsWanted()) plink(level, 0.05)
}

export function soundFall(level: number) {
  if (soundsWanted()) plink(level * 0.7, 0.03)
}

/** Ziel erreicht: kleiner Dur-Akkord, nacheinander angeschlagen. */
export function soundGoal() {
  if (!soundsWanted()) return
  ;[0, 0.32, 0.58, 1].forEach((lv, i) => plink(lv, 0.045, i * 0.07))
}
