import { describe, expect, it, vi } from 'vitest'
import type { InventoryDraft } from '../types'
import {
  applyInventoryConfirmation,
  loadStackItemInventory,
  reverseInventoryConfirmation,
  saveInventoryDetails,
  saveStackItemInventory,
  uploadBatchDocument,
} from './stackInventory'

const inventory: InventoryDraft = {
  enabled: true,
  packageQuantity: 60,
  packageUnit: 'capsule',
  remainingQuantity: 42,
  brand: 'Example',
  batchNumber: 'A-42',
  expiresAt: '2027-08-01',
}

function queryResult(data: unknown, error: { message: string } | null = null) {
  const query: Record<string, unknown> = {}
  query.select = vi.fn(() => query)
  query.eq = vi.fn(() => query)
  query.maybeSingle = vi.fn(async () => ({ data, error }))
  return query
}

describe('stack inventory service', () => {
  it('loads the optional inventory row for one stack item', async () => {
    const row = {
      id: 'inventory-1',
      user_id: 'user-1',
      stack_item_id: 'stack-1',
      enabled: true,
      package_quantity: 60,
      package_unit: 'capsule',
      remaining_quantity: 42,
      batch_number: 'A-42',
      expires_at: '2027-08-01',
      created_at: '2026-08-17T00:00:00.000Z',
      updated_at: '2026-08-17T00:00:00.000Z',
    }
    const query = queryResult(row)
    const from = vi.fn(() => query)

    await expect(loadStackItemInventory({ from } as never, 'stack-1')).resolves.toEqual(row)
    expect(from).toHaveBeenCalledWith('stack_item_inventory')
    expect(query.eq).toHaveBeenCalledWith('stack_item_id', 'stack-1')
  })

  it('persists a normalized row only for complete tracking with inventory enabled', async () => {
    const query = queryResult(null)
    query.upsert = vi.fn(async () => ({ error: null }))
    const from = vi.fn(() => query)

    await saveStackItemInventory({ from } as never, {
      userId: 'user-1',
      stackItemId: 'stack-1',
      inventory: { ...inventory, packageUnit: ' capsule ', batchNumber: ' A-42 ' },
    })

    expect(query.upsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      stack_item_id: 'stack-1',
      enabled: true,
      package_quantity: 60,
      package_unit: 'capsule',
      remaining_quantity: 42,
      batch_number: 'A-42',
      expires_at: '2027-08-01',
    }, { onConflict: 'stack_item_id' })
  })

  it('schreibt den Bestand auf jeder Tracking-Stufe, sobald er eingeschaltet ist', () => {
    // Wer nur abhakt, will trotzdem wissen, wann die Packung leer ist. Die
    // Funktion kennt die Stufe deshalb gar nicht mehr.
    const query = queryResult(null)
    query.upsert = vi.fn(async () => ({ error: null }))
    const from = vi.fn(() => query)

    return saveStackItemInventory({ from } as never, {
      userId: 'user-1',
      stackItemId: 'stack-1',
      inventory,
    }).then(() => {
      expect(from).toHaveBeenCalledWith('stack_item_inventory')
      expect(query.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true, remaining_quantity: 42 }),
        { onConflict: 'stack_item_id' },
      )
    })
  })

  it('schreibt nichts, solange der Bestand ausgeschaltet ist', () => {
    // Der Schalter ist das einzige Kriterium. Frueher stand hier die
    // Tracking-Stufe: unterhalb von 'complete' wurde der Bestand
    // weggeworfen, auch wenn er eingeschaltet war.
    const query = queryResult(null)
    query.upsert = vi.fn(async () => ({ error: null }))
    const from = vi.fn(() => query)

    return saveStackItemInventory({ from } as never, {
      userId: 'user-1',
      stackItemId: 'stack-1',
      inventory: { ...inventory, enabled: false },
    }).then(() => {
      expect(from).not.toHaveBeenCalled()
    })
  })

  it('calls the idempotent inventory RPC for a committed dose log', async () => {
    const rpc = vi.fn(async () => ({ data: 41, error: null }))

    await applyInventoryConfirmation({ rpc }, 'dose-log-1')

    expect(rpc).toHaveBeenCalledWith('apply_inventory_confirmation', {
      p_dose_log_id: 'dose-log-1',
    })
  })

  it('surfaces an inventory RPC failure for a separate retry', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'conversion failed' } }))

    await expect(applyInventoryConfirmation({ rpc }, 'dose-log-1'))
      .rejects.toThrow('conversion failed')
  })

  it.each(['undo', 'skip', 'delete'] as const)(
    'persists the canonical %s reversal action in one RPC',
    async action => {
      const rpc = vi.fn(async () => ({ data: 42, error: null }))

      await reverseInventoryConfirmation({ rpc }, 'dose-log-1', action)

      expect(rpc).toHaveBeenCalledWith('reverse_inventory_confirmation', {
        p_dose_log_id: 'dose-log-1',
        p_action: action,
      })
    },
  )

  it('surfaces a reversal failure before the caller mutates the log separately', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'reversal failed' } }))

    await expect(reverseInventoryConfirmation({ rpc }, 'dose-log-1', 'delete'))
      .rejects.toThrow('reversal failed')
  })

  it('saves only changed package details of an existing row', async () => {
    const eq = vi.fn(async () => ({ error: null }))
    const update = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ update }))
    await saveInventoryDetails({ from } as never, {
      userId: 'user-1',
      stackItemId: 'stack-1',
      before: { id: 'inv-1', batch_number: 'A-42', expires_at: '2027-08-01', batch_source: null, opened_at: null } as never,
      draft: { ...inventory, batchSource: ' Apotheke ', openedAt: '2026-09-01' },
    })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ batch_source: 'Apotheke', opened_at: '2026-09-01' }))
    const [[patch]] = update.mock.calls as unknown as [[Record<string, unknown>]]
    expect(patch).not.toHaveProperty('batch_number')
    expect(eq).toHaveBeenCalledWith('id', 'inv-1')
  })

  it('writes nothing when nothing changed, and creates a switched-off row when there was none', async () => {
    const upsert = vi.fn(async () => ({ error: null }))
    const update = vi.fn()
    const from = vi.fn(() => ({ update, upsert }))
    await saveInventoryDetails({ from } as never, {
      userId: 'user-1', stackItemId: 'stack-1',
      before: { id: 'inv-1', batch_number: 'A-42', expires_at: '2027-08-01' } as never,
      draft: inventory,
    })
    expect(from).not.toHaveBeenCalled()

    await saveInventoryDetails({ from } as never, { userId: 'user-1', stackItemId: 'stack-1', before: null, draft: inventory })
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ batch_number: 'A-42', stack_item_id: 'stack-1' }), { onConflict: 'stack_item_id' })
    // Nie abschalten: gibt es die Zeile inzwischen doch, bleibt sie, wie sie ist.
    expect(upsert.mock.calls[0]).not.toHaveProperty('0.enabled')
  })
})

describe('Analyse-Dokument hochladen', () => {
  it('legt im eigenen Ordner ab und gibt den Pfad zurueck, keine oeffentliche URL', async () => {
    const upload = vi.fn(async () => ({ error: null }))
    const from = vi.fn(() => ({ upload }))
    vi.spyOn(Date, 'now').mockReturnValue(1730000000000)
    const pfad = await uploadBatchDocument({ storage: { from } }, 'user-1', new File(['x'], 'Zertifikat.PDF'))
    expect(from).toHaveBeenCalledWith('batch-files')
    expect(upload).toHaveBeenCalledWith('user-1/1730000000000.pdf', expect.any(File))
    expect(pfad).toBe('user-1/1730000000000.pdf')
    vi.restoreAllMocks()
  })
})
