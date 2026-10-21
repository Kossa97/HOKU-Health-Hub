import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xcskcojakolphtbuqfbw.supabase.co'
const supabaseAnonKey = 'sb_publishable_yeAVlq8miTc20FLsPqKCwQ_xAGKHLV1'

/** Wo supabase-js die Sitzung ablegt (Standard: sb-<Projekt>-auth-token). */
export const AUTH_STORAGE_KEY = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`

// supabase-js ruft das globale fetch erst beim Senden auf — das ist ab dem
// Start dienstFetch (Offline-Lesecache und Störungsschalter, lib/stoerung.ts).
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
