export type ZukanPackImportPack = {
  slug?: unknown
  code?: unknown
  name?: unknown
  released_year?: unknown
  card_count?: unknown
  count_breakdown?: unknown
  description?: unknown
  is_published?: unknown
  sort_order?: unknown
  image_url?: unknown
}

export type ZukanPackImportCard = {
  slug?: unknown
  name?: unknown
  card_type?: unknown
  civilization?: unknown
  cost?: unknown
  mana?: unknown
  race?: unknown
  power?: unknown
  rarity?: unknown
  illustrator?: unknown
  ability_text?: unknown
  flavor_text?: unknown
  image_url?: unknown
  official_page_url?: unknown
  official_image_url?: unknown
  is_published?: unknown
  sort_order?: unknown
  section?: unknown
}

export type ZukanPackImportData = {
  pack?: ZukanPackImportPack
  cards?: ZukanPackImportCard[]
}

export type ZukanValidationResult = {
  errors: string[]
  warnings: string[]
}

const REQUIRED_PACK_FIELDS = ['slug', 'code', 'name'] as const
const REQUIRED_CARD_FIELDS = [
  'slug',
  'name',
  'card_type',
  'civilization',
  'rarity',
  'official_page_url',
] as const

const TEXT_FIELDS = [
  'slug',
  'name',
  'card_type',
  'civilization',
  'race',
  'power',
  'rarity',
  'illustrator',
  'ability_text',
  'flavor_text',
  'image_url',
  'official_page_url',
  'official_image_url',
] as const

const DETAIL_LABELS = [
  'カードの種類',
  '文明',
  'レアリティ',
  '特殊能力',
  'イラストレーター',
]

const CARD_SECTIONS = new Set(['base', 'secret', 'treasure'])

function cardLabel(card: ZukanPackImportCard | null | undefined, index: number) {
  return typeof card?.slug === 'string' && card.slug ? `[${card.slug}]` : `[cards[${index}]]`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isIntegerOrNull(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'number' && Number.isInteger(value))
}

function isCreatureCard(cardType: unknown) {
  return typeof cardType === 'string' && cardType.includes('クリーチャー')
}

function isSpellCard(cardType: unknown) {
  return typeof cardType === 'string' && cardType.includes('呪文') && !cardType.includes('クリーチャー')
}

function hasHtmlFragment(value: unknown) {
  return typeof value === 'string' && (value.includes('<') || value.includes('/>') || value.includes('" />'))
}

function isAllowedPower(value: unknown) {
  if (!isNonEmptyString(value)) return false
  return /^(?:\d+\+?|\?+|∞)$/.test(value.trim())
}

function containsDetailLabel(value: unknown) {
  if (!isNonEmptyString(value)) return null
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  for (const label of DETAIL_LABELS) {
    if (lines.includes(label)) return label
  }
  return null
}

function isPlainCountBreakdown(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
}

function isValidUrl(value: unknown) {
  if (value === null || value === undefined || value === '') return true
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function validateZukanPackData(data: unknown, expectedPackSlug: string | null = null): ZukanValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isRecord(data)) {
    return {
      errors: ['[root] root must be an object'],
      warnings,
    }
  }

  if (!isRecord(data.pack)) {
    errors.push('[pack] pack must be an object')
  }

  if (!Array.isArray(data.cards)) {
    errors.push('[cards] cards must be an array')
  }

  const pack = isRecord(data.pack) ? data.pack : {}
  const cards = Array.isArray(data.cards) ? data.cards : []

  for (const field of REQUIRED_PACK_FIELDS) {
    if (!isNonEmptyString(pack[field])) {
      errors.push(`[pack] ${field} is required`)
    }
  }

  if (expectedPackSlug && pack.slug !== expectedPackSlug) {
    errors.push(`[pack] pack.slug (${String(pack.slug ?? 'missing')}) does not match argument (${expectedPackSlug})`)
  }

  if (pack.card_count !== null && pack.card_count !== undefined && pack.card_count !== cards.length) {
    errors.push(`[pack] pack.card_count (${String(pack.card_count)}) does not match cards.length (${cards.length})`)
  }

  if (pack.count_breakdown !== null && pack.count_breakdown !== undefined) {
    if (!isPlainCountBreakdown(pack.count_breakdown)) {
      errors.push('[pack] count_breakdown must be an object')
    } else {
      const entries = Object.entries(pack.count_breakdown)
      const expectedTotal = entries.reduce((sum, [, count]) => sum + (typeof count === 'number' ? count : 0), 0)
      if (typeof pack.card_count === 'number' && expectedTotal !== pack.card_count) {
        errors.push(`[pack] count_breakdown total (${expectedTotal}) does not match pack.card_count (${pack.card_count})`)
      }
      for (const [section, count] of entries) {
        if (!CARD_SECTIONS.has(section)) {
          errors.push(`[pack] count_breakdown has an unknown section: ${section}`)
        }
        if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
          errors.push(`[pack] count_breakdown.${section} must be a non-negative integer`)
          continue
        }
        const actual = cards.filter(card => isRecord(card) && card.section === section).length
        if (actual !== count) {
          errors.push(`[pack] section ${section} count (${actual}) does not match count_breakdown (${count})`)
        }
      }
    }
  }

  if (pack.card_count !== null && pack.card_count !== undefined && (typeof pack.card_count !== 'number' || !Number.isInteger(pack.card_count))) {
    errors.push('[pack] card_count must be an integer')
  }

  if (typeof pack.sort_order !== 'number' || !Number.isInteger(pack.sort_order)) {
    errors.push('[pack] sort_order must be an integer')
  }

  if (!isValidUrl(pack.image_url)) {
    errors.push('[pack] image_url must be a valid URL or null')
  }

  const slugs = new Map<string, string>()
  const sortOrders = new Map<number, string>()

  cards.forEach((rawCard, index) => {
    const card = isRecord(rawCard) ? rawCard : null
    const label = cardLabel(card, index)

    if (!card) {
      errors.push(`${label} card must be an object`)
      return
    }

    for (const field of REQUIRED_CARD_FIELDS) {
      if (!isNonEmptyString(card[field])) {
        errors.push(`${label} ${field} is required`)
      }
    }

    if (isNonEmptyString(card.slug)) {
      if (slugs.has(card.slug)) {
        errors.push(`${label} duplicate slug; first seen at ${slugs.get(card.slug)}`)
      } else {
        slugs.set(card.slug, `cards[${index}]`)
      }
    }

    if (typeof card.sort_order !== 'number' || !Number.isInteger(card.sort_order)) {
      errors.push(`${label} sort_order must be a number`)
    } else if (sortOrders.has(card.sort_order)) {
      errors.push(`${label} duplicate sort_order ${card.sort_order}; first seen at ${sortOrders.get(card.sort_order)}`)
    } else {
      sortOrders.set(card.sort_order, label)
    }

    if (!isIntegerOrNull(card.cost)) errors.push(`${label} cost must be an integer or null`)
    if (!isIntegerOrNull(card.mana)) errors.push(`${label} mana must be an integer or null`)

    for (const field of TEXT_FIELDS) {
      if (hasHtmlFragment(card[field])) {
        errors.push(`${label} ${field} contains an HTML fragment`)
      }
    }

    if (pack.count_breakdown !== null && pack.count_breakdown !== undefined) {
      if (!isNonEmptyString(card.section)) {
        errors.push(`${label} section is required when pack.count_breakdown is present`)
      } else if (!CARD_SECTIONS.has(card.section)) {
        errors.push(`${label} section has an unknown value: ${card.section}`)
      }
    }

    if (isSpellCard(card.card_type)) {
      if (card.race !== null && card.race !== undefined && card.race !== '') {
        warnings.push(`${label} spell card race is not null: ${String(card.race)}`)
      }
      if (card.power !== null && card.power !== undefined && card.power !== '') {
        errors.push(`${label} spell card power must be null`)
      }
    }

    if (card.race === 'イラストレーター') {
      errors.push(`${label} race contains the detail label "イラストレーター"`)
    }

    if (isCreatureCard(card.card_type) && !isNonEmptyString(card.power)) {
      errors.push(`${label} creature card power is required`)
    }

    if (isNonEmptyString(card.power) && !isAllowedPower(card.power)) {
      errors.push(`${label} power has an unexpected format: ${card.power}`)
    }

    for (const field of ['ability_text', 'flavor_text'] as const) {
      const mixedLabel = containsDetailLabel(card[field])
      if (mixedLabel) {
        errors.push(`${label} ${field} appears to contain a card detail label: ${mixedLabel}`)
      }
    }

    if (!isValidUrl(card.official_page_url)) {
      errors.push(`${label} official_page_url must be a valid URL`)
    }
    if (!isValidUrl(card.image_url)) {
      errors.push(`${label} image_url must be a valid URL or null`)
    }
    if (!isValidUrl(card.official_image_url)) {
      errors.push(`${label} official_image_url must be a valid URL or null`)
    }

    if (card.cost === null || card.cost === undefined) {
      warnings.push(`${label} cost is null`)
    }

    if ((card.mana === null || card.mana === undefined) && !String(card.card_type ?? '').includes('サイキック')) {
      warnings.push(`${label} mana is null`)
    }
  })

  return { errors, warnings }
}

export function formatValidationResult(result: ZukanValidationResult) {
  const lines: string[] = []

  if (result.errors.length > 0) {
    lines.push('Errors:')
    lines.push(...result.errors.map(error => `- ${error}`))
  }

  if (result.warnings.length > 0) {
    if (lines.length > 0) lines.push('')
    lines.push('Warnings:')
    lines.push(...result.warnings.map(warning => `- ${warning}`))
  }

  return lines.join('\n')
}
