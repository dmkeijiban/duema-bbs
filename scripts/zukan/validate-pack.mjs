#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const DEFAULT_INPUT_DIR = 'data/zukan-packs'

const REQUIRED_CARD_FIELDS = [
  'slug',
  'name',
  'card_type',
  'civilization',
  'rarity',
  'official_page_url',
]

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
]

const DETAIL_LABELS = [
  'カードの種類',
  '文明',
  'レアリティ',
  '特殊能力',
  'イラストレーター',
]

function usage() {
  console.error(`Usage:
  npm run zukan:validate <pack-slug>
  npm run zukan:validate -- <pack-slug> [--input <file>]

Examples:
  npm run zukan:validate dm-02
  npm run zukan:validate -- dm-03 --input data/zukan-packs/dm-03.json
`)
}

function parseArgs(argv) {
  const args = [...argv]
  const options = {
    packSlug: null,
    input: null,
  }

  while (args.length > 0) {
    const arg = args.shift()
    if (!arg) continue

    if (arg === '--input') {
      options.input = args.shift() ?? null
      continue
    }

    if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`)
    }

    if (options.packSlug) {
      throw new Error(`Unexpected argument: ${arg}`)
    }

    options.packSlug = arg
  }

  if (!options.packSlug && !options.input) {
    throw new Error('Pack slug or --input is required')
  }

  return options
}

function cardLabel(card, index) {
  return card?.slug ? `[${card.slug}]` : `[cards[${index}]]`
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isCreatureCard(cardType) {
  return typeof cardType === 'string' && cardType.includes('クリーチャー')
}

function isSpellCard(cardType) {
  return typeof cardType === 'string' && cardType.includes('呪文') && !cardType.includes('クリーチャー')
}

function hasHtmlFragment(value) {
  return typeof value === 'string' && (value.includes('<') || value.includes('/>') || value.includes('" />'))
}

function isAllowedPower(value) {
  if (!isNonEmptyString(value)) return false
  return /^(?:\d+\+?|\?+|∞)$/.test(value.trim())
}

function containsDetailLabel(value) {
  if (!isNonEmptyString(value)) return null
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  for (const label of DETAIL_LABELS) {
    if (lines.includes(label)) return label
  }
  return null
}

export function validateZukanPackData(data, expectedPackSlug = null) {
  const errors = []
  const warnings = []

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      errors: ['[root] root must be an object'],
      warnings,
    }
  }

  if (!data.pack || typeof data.pack !== 'object' || Array.isArray(data.pack)) {
    errors.push('[pack] pack must be an object')
  }

  if (!Array.isArray(data.cards)) {
    errors.push('[cards] cards must be an array')
  }

  const pack = data.pack ?? {}
  const cards = Array.isArray(data.cards) ? data.cards : []

  if (expectedPackSlug && pack.slug !== expectedPackSlug) {
    errors.push(`[pack] pack.slug (${pack.slug ?? 'missing'}) does not match argument (${expectedPackSlug})`)
  }

  if (pack.card_count !== null && pack.card_count !== undefined && pack.card_count !== cards.length) {
    errors.push(`[pack] pack.card_count (${pack.card_count}) does not match cards.length (${cards.length})`)
  }

  const slugs = new Map()
  const sortOrders = new Map()

  cards.forEach((card, index) => {
    const label = cardLabel(card, index)

    if (!card || typeof card !== 'object' || Array.isArray(card)) {
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

    if (typeof card.sort_order !== 'number') {
      errors.push(`${label} sort_order must be a number`)
    } else if (sortOrders.has(card.sort_order)) {
      errors.push(`${label} duplicate sort_order ${card.sort_order}; first seen at ${sortOrders.get(card.sort_order)}`)
    } else {
      sortOrders.set(card.sort_order, label)
    }

    for (const field of TEXT_FIELDS) {
      if (hasHtmlFragment(card[field])) {
        errors.push(`${label} ${field} contains an HTML fragment`)
      }
    }

    if (isSpellCard(card.card_type)) {
      if (card.race !== null && card.race !== undefined && card.race !== 'イラストレーター') {
        warnings.push(`${label} spell card race is not null: ${card.race}`)
      }
      if (card.power !== null && card.power !== undefined) {
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

    for (const field of ['ability_text', 'flavor_text']) {
      const mixedLabel = containsDetailLabel(card[field])
      if (mixedLabel) {
        errors.push(`${label} ${field} appears to contain a card detail label: ${mixedLabel}`)
      }
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

export function formatValidationResult(result) {
  const lines = []

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

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const inputPath = options.input ?? path.join(DEFAULT_INPUT_DIR, `${options.packSlug}.json`)
  const data = JSON.parse(await readFile(inputPath, 'utf8'))
  const result = validateZukanPackData(data, options.packSlug)

  if (result.errors.length > 0) {
    console.error(`Zukan pack validation failed: ${inputPath}`)
    console.error(formatValidationResult(result))
    process.exit(1)
  }

  console.log(`Zukan pack validation passed: ${inputPath}`)
  if (result.warnings.length > 0) {
    console.warn(formatValidationResult({ errors: [], warnings: result.warnings }))
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message)
    usage()
    process.exit(1)
  })
}
