/** Adressen des Blutspiegels: Übersicht, Detail je Eintrag, eigene Simulation. */
export const UEBERSICHT_PFAD = '/simulation'
export const MANUELL_PFAD = '/simulation/neu'
export const detailPfad = (key: string) => `/simulation/${encodeURIComponent(key)}`
