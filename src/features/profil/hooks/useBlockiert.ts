import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'

/**
 * Blockierte Profile (RPCs `my_blocked_profiles`, `set_profile_block` aus
 * supabase-store-compliance.sql). `null` = noch nicht geladen; ein Ladefehler
 * zählt wie eine leere Liste.
 */
export function useBlockiert(userId: string | undefined) {
  const { t } = useTranslation()
  const [liste, setListe] = useState<{ username: string }[] | null>(null)
  const [neuLaden, setNeuLaden] = useState(0)

  useEffect(() => {
    if (!userId) return
    let aktuell = true
    void supabase.rpc('my_blocked_profiles').then(({ data, error }) => {
      if (aktuell) setListe(error ? [] : ((data as { username: string | null }[] | null) ?? []).filter((e): e is { username: string } => !!e.username))
    })
    return () => { aktuell = false }
  }, [userId, neuLaden])

  const entsperren = useCallback(async (username: string) => {
    const { error } = await supabase.rpc('set_profile_block', { p_username: username, p_blocked: false })
    if (error) return toast.error(t('error'))
    toast.success(t('unblock_done'))
    setNeuLaden(n => n + 1)
  }, [t])

  return { liste, entsperren }
}
