const SUBSTANCE_COLORS = [
  '#10b981',
  '#8b5cf6',
  '#f472b6',
  '#f59e0b',
  '#00ccf5',
  '#38bdf8',
  '#a855f7',
  '#f87171',
] as const

export function substanceColor(index: number): string {
  return SUBSTANCE_COLORS[index % SUBSTANCE_COLORS.length]
}

export const METRIC_COLORS: Record<string, string> = {
  weight: '#f59e0b',
  energie: '#00ccf5',
  schlaf: '#a855f7',
  wohlbefinden: '#10b981',
  libido: '#f472b6',
  body_fat: '#f87171',
  muscle_mass: '#34d399',
  umfang: '#38bdf8',
}
