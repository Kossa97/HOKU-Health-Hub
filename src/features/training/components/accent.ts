/**
 * Akzent des Trainings. Eine Variable mit Rückfall Orange: der Look HOKU setzt
 * sie in `TRAINING_CSS` auf das Blau der App (ein Akzent für alles), die
 * älteren Looks behalten Orange.
 */
export const TRAINING_ACCENT = 'var(--tyd-train-accent, #ff9f0a)'

/** Schrift auf voller Akzentfläche. */
export const TRAINING_INK = 'var(--tyd-train-ink, #140800)'

/** Akzent mit Deckkraft (Rand, Tönung) — `color-mix`, weil der Akzent eine Variable ist. */
export const trainingTint = (percent: number) => `color-mix(in srgb, ${TRAINING_ACCENT} ${percent}%, transparent)`
