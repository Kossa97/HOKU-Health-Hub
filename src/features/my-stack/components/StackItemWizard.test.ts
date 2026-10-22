import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StackItemIngredient, SubstanceCatalogEntry } from '../types'
import { IngredientEditor } from './IngredientEditor'
import { StackItemWizard } from './StackItemWizard'
import { StrengthEditor } from './StrengthEditor'
import { SubstanceSearch } from './SubstanceSearch'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const vitaminD3: SubstanceCatalogEntry = {
  id: 'vitamin-d3',
  canonical_name: 'Vitamin D3',
  aliases: ['Cholecalciferol'],
  default_category: 'vitamin',
  suggested_units: ['IU'],
  suggested_dosage_forms: ['capsule'],
  pk_profile_id: null,
  active: true,
}

const twoIngredients: StackItemIngredient[] = [
  {
    catalog_substance_id: 'vitamin-d3',
    custom_name: '',
    amount_value: 5_000,
    amount_unit: 'IU',
    basis_value: 1,
    basis_unit: 'capsule',
    position: 0,
  },
  {
    catalog_substance_id: null,
    custom_name: 'Vitamin K2',
    amount_value: 100,
    amount_unit: 'mcg',
    basis_value: 1,
    basis_unit: 'capsule',
    position: 1,
  },
]

function renderWizard(): string {
  return renderToStaticMarkup(createElement(StackItemWizard, {
    catalogEntries: [],
    existingItems: [],
    onClose: () => undefined,
    onOpenExisting: () => undefined,
    onSave: () => Promise.resolve(),
  }))
}

function renderSearch({
  query,
  entries,
}: {
  query: string
  entries: SubstanceCatalogEntry[]
}): string {
  return renderToStaticMarkup(createElement(SubstanceSearch, {
    query,
    entries,
    category: null,
    onQueryChange: () => undefined,
    onSelect: () => undefined,
    onAddCustom: () => undefined,
    onDetach: () => undefined,
    onCategoryChange: () => undefined,
  }))
}

function renderIngredientEditor(ingredients: StackItemIngredient[]): string {
  return renderToStaticMarkup(createElement(IngredientEditor, {
    ingredients,
    catalogNames: { 'vitamin-d3': 'Vitamin D3' },
    onIngredientChange: () => undefined,
    onAddIngredient: () => undefined,
    onRemoveIngredient: () => undefined,
  }))
}

function renderStrengthEditor({
  dosageForm,
  ingredient,
}: {
  dosageForm: 'capsule'
  ingredient: StackItemIngredient
}): string {
  return renderToStaticMarkup(createElement(StrengthEditor, {
    dosageForm,
    category: 'supplement',
    ingredient,
    ingredientIndex: 0,
    onChange: () => undefined,
  }))
}

describe('StackItemWizard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('beginnt mit der verstÃ¤ndlichen Leitfrage', () => {
    const html = renderWizard()

    expect(html).toContain('my_stack_question')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-labelledby="stack-item-wizard-title"')
    expect(html).toContain('aria-describedby="stack-item-wizard-description"')
  })

  it('zeigt Katalogtreffer und die freie Alternative', () => {
    const html = renderSearch({ query: 'Vitamin', entries: [vitaminD3] })

    expect(html).toContain('Vitamin D3')
    expect(html).toContain('my_stack_add_custom')
    expect(html).toContain('role="listbox"')
  })

  it('rendert Mehrfachwirkstoffe mit eindeutigen Beschriftungen', () => {
    const html = renderIngredientEditor(twoIngredients)

    expect(html).toContain('my_stack_ingredient_1')
    expect(html).toContain('my_stack_ingredient_2')
    expect(html).toContain('my_stack_add_ingredient')
    expect(html).toContain('id="stack-ingredient-0"')
    expect(html).toContain('readOnly=""')
  })

  it('zeigt nur zur Form passende Einheiten und BezugsgrÃ¶ÃŸen', () => {
    const html = renderStrengthEditor({ dosageForm: 'capsule', ingredient: twoIngredients[0] })

    expect(html).toContain('capsule')
    expect(html).not.toContain('vial')
  })

  it('verankert Tastatur-, Fehlerfokus- und Touch-VertrÃ¤ge im Quelltext', () => {
    const wizardSource = readFileSync(new URL('./StackItemWizard.tsx', import.meta.url), 'utf8')
    const searchSource = readFileSync(new URL('./SubstanceSearch.tsx', import.meta.url), 'utf8')
    const componentSources = [
      wizardSource,
      searchSource,
      readFileSync(new URL('./IngredientEditor.tsx', import.meta.url), 'utf8'),
      // Die Formauswahl steht im kleinen Karussell der Substanzseite.
      readFileSync(new URL('./FormUndFarbe.tsx', import.meta.url), 'utf8'),
      readFileSync(new URL('./StrengthEditor.tsx', import.meta.url), 'utf8'),
    ]

    expect(wizardSource).toContain("event.key === 'Escape'")
    expect(wizardSource).toContain("event.key === 'Tab'")
    expect(wizardSource).toContain('.focus()')
    expect(wizardSource).toContain('returnFocusRef')
    expect(wizardSource).not.toContain('const [query, setQuery]')
    expect(wizardSource).toContain('query={state.draft.displayName}')
    expect(wizardSource).toContain('onOpenExisting: (item: StackItem) => void')
    expect(searchSource).toContain("event.key === 'ArrowDown'")
    expect(searchSource).toContain("event.key === 'ArrowUp'")
    expect(searchSource).toContain("event.key === 'Home'")
    expect(searchSource).toContain("event.key === 'End'")
    expect(searchSource).toContain("event.key === 'Enter'")
    expect(wizardSource).toContain("state.original ? 'update' : 'create'")
    for (const source of componentSources) expect(source).toContain('min-h-11')
  })

  it('gibt dem Objekt in der Vorschauzeile keine feste Hoehe', () => {
    // Der Kasten stand auf 100 px, weil ein Pen in Miniaturgroesse so hoch
    // ist. Gemessen: eine Kapsel misst 21 px und schwamm in 97 px Leere, der
    // Name stand daneben in der Mitte von nichts. Die Zeile umschliesst ihr
    // Objekt, sie gibt ihm keine Buehne.
    const wizardSource = readFileSync(new URL('./StackItemWizard.tsx', import.meta.url), 'utf8')
    const zeile = wizardSource.slice(wizardSource.indexOf('data-wizard-preview-compact'))

    expect(zeile).toContain('size="mini"')
    expect(zeile.slice(0, zeile.indexOf('size="mini"'))).not.toMatch(/h-\[\d+px\]/)
  })
})
