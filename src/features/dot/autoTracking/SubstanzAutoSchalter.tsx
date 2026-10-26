import { useEffect, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'
import { loadIntakeBundles, type IntakeBundleClient } from '../../routines/bundles/intakeBundles'
import { useDotText } from '../texte'
import { DotAutoSchalter } from './DotAutoSchalter'

/**
 * Der Schalter an der Substanz. Steckt sie in einem Bündel, das schon
 * automatisch einträgt, sagt er das — sonst schaltete man hier „aus“ und
 * Dot trüge über das Bündel trotzdem weiter ein.
 */
export function SubstanzAutoSchalter({ stackItemId, seit, speichern }: {
  stackItemId: string
  seit: string | null | undefined
  speichern(seit: string | null): Promise<void>
}) {
  const { user } = useAuth()
  const { dt } = useDotText()
  const [buendel, setBuendel] = useState<string | null>(null)
  useEffect(() => {
    if (!user) return
    let aus = false
    loadIntakeBundles(supabase as unknown as IntakeBundleClient, user.id)
      .then(rows => {
        if (aus) return
        const an = rows.find(b => b.auto_log_since && b.stack_item_ids.includes(stackItemId))
        setBuendel(an?.name ?? null)
      })
      .catch(() => { /* ohne Hinweis */ })
    return () => { aus = true }
  }, [user, stackItemId])
  return (
    <DotAutoSchalter
      seit={seit}
      text="auto_text"
      speichern={speichern}
      hinweis={buendel ? dt('auto_ueber_buendel', { name: buendel }) : null}
    />
  )
}
