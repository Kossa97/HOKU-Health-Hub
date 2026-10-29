/**
 * localStorage/sessionStorage, die nie werfen: im Privatmodus oder bei
 * gesperrtem Speicher gilt „nichts gemerkt" statt eines Fehlers.
 */

export const lies = (k: string, s: 'lokal' | 'sitzung' = 'lokal'): string | null => {
  try { return (s === 'lokal' ? localStorage : sessionStorage).getItem(k) } catch { return null }
}

export const schreib = (k: string, v: string | null, s: 'lokal' | 'sitzung' = 'lokal') => {
  try {
    const speicher = s === 'lokal' ? localStorage : sessionStorage
    if (v === null) speicher.removeItem(k); else speicher.setItem(k, v)
  } catch { /* ohne Speicher */ }
}
