#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_INPUT_DIR = 'data/zukan-packs'
const DEFAULT_OUTPUT_DIR = 'supabase/migrations/drafts'

function usage() {
  console.error(`Usage:
  npm run zukan:seed <pack-slug>
  npm run zukan:seed -- <pack-slug> [--input <file>] [--output <file>] [--stdout] [--force]

Examples:
  npm run zukan:seed dm-03
  npm run zukan:seed -- dm-02 --stdout
  npm run zukan:seed -- dm-03 --input data/zukan-packs/dm-03.json
`)
}

function parseArgs(argv) {
  const args = [...argv]
  const options = {
    packSlug: null,
    input: null,
    output: null,
    stdout: false,
    force: false,
  }

  while (args.length > 0) {
    const arg = args.shift()
    if (!arg) continue

    if (arg === '--input') {
      options.input = args.shift() ?? null
      continue
    }

    if (arg === '--output') {
      options.output = args.shift() ?? null
      continue
    }

    if (arg === '--stdout') {
      options.stdout = true
      continue
    }

    if (arg === '--force') {
      options.force = true
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

function yyyymmdd(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function sqlLiteral(value) {
  if (value === null || value === undefined || value === '') return 'null'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return `'${String(value).replace(/'/g, "''")}'`
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
}

function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
}

function optionalStringOrNull(value, label) {
  if (value !== null && value !== undefined && typeof value !== 'string') {
    throw new Error(`${label} must be a string or null`)
  }
}

function optionalNumberOrNull(value, label) {
  if (value !== null && value !== undefined && typeof value !== 'number') {
    throw new Error(`${label} must be a number or null`)
  }
}

function validatePackData(data, expectedPackSlug) {
  assertObject(data, 'root')
  assertObject(data.pack, 'pack')
  if (!Array.isArray(data.cards)) throw new Error('cards must be an array')

  const pack = data.pack
  requiredString(pack.slug, 'pack.slug')
  requiredString(pack.code, 'pack.code')
  requiredString(pack.name, 'pack.name')
  optionalStringOrNull(pack.released_year, 'pack.released_year')
  optionalStringOrNull(pack.description, 'pack.description')
  optionalStringOrNull(pack.image_url, 'pack.image_url')
  optionalNumberOrNull(pack.card_count, 'pack.card_count')

  if (expectedPackSlug && pack.slug !== expectedPackSlug) {
    throw new Error(`pack.slug (${pack.slug}) does not match argument (${expectedPackSlug})`)
  }

  if (typeof pack.is_published !== 'boolean') {
    throw new Error('pack.is_published must be a boolean')
  }

  if (typeof pack.sort_order !== 'number') {
    throw new Error('pack.sort_order must be a number')
  }

  const cardSlugs = new Set()
  const sortOrders = new Set()

  data.cards.forEach((card, index) => {
    const prefix = `cards[${index}]`
    assertObject(card, prefix)
    requiredString(card.slug, `${prefix}.slug`)
    requiredString(card.name, `${prefix}.name`)
    optionalStringOrNull(card.card_type, `${prefix}.card_type`)
    optionalStringOrNull(card.civilization, `${prefix}.civilization`)
    optionalStringOrNull(card.race, `${prefix}.race`)
    optionalStringOrNull(card.power, `${prefix}.power`)
    optionalStringOrNull(card.rarity, `${prefix}.rarity`)
    optionalStringOrNull(card.illustrator, `${prefix}.illustrator`)
    optionalStringOrNull(card.ability_text, `${prefix}.ability_text`)
    optionalStringOrNull(card.flavor_text, `${prefix}.flavor_text`)
    optionalStringOrNull(card.image_url, `${prefix}.image_url`)
    optionalStringOrNull(card.official_page_url, `${prefix}.official_page_url`)
    optionalStringOrNull(card.official_image_url, `${prefix}.official_image_url`)
    optionalNumberOrNull(card.cost, `${prefix}.cost`)
    optionalNumberOrNull(card.mana, `${prefix}.mana`)

    if (typeof card.is_published !== 'boolean') {
      throw new Error(`${prefix}.is_published must be a boolean`)
    }

    if (typeof card.sort_order !== 'number') {
      throw new Error(`${prefix}.sort_order must be a number`)
    }

    if (cardSlugs.has(card.slug)) {
      throw new Error(`Duplicate card slug: ${card.slug}`)
    }
    cardSlugs.add(card.slug)

    if (sortOrders.has(card.sort_order)) {
      throw new Error(`Duplicate card sort_order: ${card.sort_order}`)
    }
    sortOrders.add(card.sort_order)
  })

  if (pack.card_count !== null && pack.card_count !== undefined && pack.card_count !== data.cards.length) {
    throw new Error(`pack.card_count (${pack.card_count}) does not match cards.length (${data.cards.length})`)
  }

  return data
}

function slugLikePattern(cards) {
  const first = cards[0]?.slug ?? ''
  const match = first.match(/^([a-z]+)(\d+)-\d+$/i)
  if (!match) return `${first.replace(/'/g, "''").slice(0, 6)}%`
  return `${match[1]}${match[2]}-%`
}

function valuesRows(cards) {
  return cards.map(card => {
    const values = [
      card.slug,
      card.name,
      card.card_type ?? null,
      card.civilization ?? null,
      card.cost ?? null,
      card.mana ?? card.cost ?? null,
      card.race ?? null,
      card.power ?? null,
      card.rarity ?? null,
      card.illustrator ?? null,
      card.ability_text ?? null,
      card.flavor_text ?? null,
      card.image_url ?? null,
      card.official_page_url ?? null,
      card.official_image_url ?? null,
      card.is_published,
      card.sort_order,
    ].map(sqlLiteral)

    return `  (${values.join(', ')})`
  }).join(',\n')
}

function generateSql(data, sourcePath) {
  const pack = data.pack
  const cards = [...data.cards].sort((a, b) => a.sort_order - b.sort_order)
  const expectedCount = pack.card_count ?? cards.length
  const cardSlugPattern = slugLikePattern(cards)

  return `-- ============================================================
-- Zukan seed: ${pack.code} ${pack.name}
-- Generated from ${sourcePath}
--
-- Manual operation only:
-- - Review this SQL before applying.
-- - Apply manually in Supabase SQL Editor.
-- - Do not run this from app code, cron, or an external automation.
--
-- This seed inserts a new zukan_packs row and its zukan_cards rows.
-- It intentionally does not delete, recreate, rename, or update existing cards.
-- If pack/card slugs already exist, the insert should fail so the conflict is visible.
--
-- Before applying, confirm no target pack/card slugs already exist:
-- select slug, code, name, is_published, card_count
-- from public.zukan_packs
-- where slug = ${sqlLiteral(pack.slug)};
--
-- select slug, name, is_published, sort_order
-- from public.zukan_cards
-- where slug in (${cards.map(card => sqlLiteral(card.slug)).join(', ')})
-- order by slug;
--
-- Expected card_count: ${expectedCount}
-- ============================================================

begin;

insert into public.zukan_packs (
  slug,
  code,
  name,
  released_year,
  card_count,
  description,
  is_published,
  sort_order,
  image_url
)
values (
  ${sqlLiteral(pack.slug)},
  ${sqlLiteral(pack.code)},
  ${sqlLiteral(pack.name)},
  ${sqlLiteral(pack.released_year ?? null)},
  ${sqlLiteral(pack.card_count ?? cards.length)},
  ${sqlLiteral(pack.description ?? null)},
  ${sqlLiteral(pack.is_published)},
  ${sqlLiteral(pack.sort_order)},
  ${sqlLiteral(pack.image_url ?? null)}
);

with pack_row as (
  select id
  from public.zukan_packs
  where slug = ${sqlLiteral(pack.slug)}
)
insert into public.zukan_cards (
  pack_id,
  slug,
  name,
  card_type,
  civilization,
  cost,
  mana,
  race,
  power,
  rarity,
  illustrator,
  ability_text,
  flavor_text,
  image_url,
  official_page_url,
  official_image_url,
  is_published,
  sort_order
)
select
  pack_row.id,
  v.slug,
  v.name,
  v.card_type,
  v.civilization,
  v.cost,
  v.mana,
  v.race,
  v.power,
  v.rarity,
  v.illustrator,
  v.ability_text,
  v.flavor_text,
  v.image_url,
  v.official_page_url,
  v.official_image_url,
  v.is_published,
  v.sort_order
from pack_row
cross join (values
${valuesRows(cards)}
) as v(
  slug,
  name,
  card_type,
  civilization,
  cost,
  mana,
  race,
  power,
  rarity,
  illustrator,
  ability_text,
  flavor_text,
  image_url,
  official_page_url,
  official_image_url,
  is_published,
  sort_order
);

commit;

-- After applying, confirm pack/card counts:
-- select slug, code, name, is_published, card_count
-- from public.zukan_packs
-- where slug = ${sqlLiteral(pack.slug)};
--
-- select
--   p.slug,
--   p.card_count as expected_card_count,
--   count(c.id) as actual_card_count,
--   count(c.ability_text) as cards_with_ability_text,
--   count(c.flavor_text) as cards_with_flavor_text,
--   count(c.illustrator) as cards_with_illustrator,
--   count(c.official_page_url) as cards_with_official_page_url
-- from public.zukan_packs p
-- left join public.zukan_cards c on c.pack_id = p.id
-- where p.slug = ${sqlLiteral(pack.slug)}
-- group by p.slug, p.card_count;
--
-- Expected: actual_card_count = ${expectedCount}
-- Expected slug pattern check:
-- select slug, name, is_published, sort_order
-- from public.zukan_cards
-- where slug like ${sqlLiteral(cardSlugPattern)}
-- order by sort_order;
`
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const inputPath = options.input ?? path.join(DEFAULT_INPUT_DIR, `${options.packSlug}.json`)
  const raw = await readFile(inputPath, 'utf8')
  const data = validatePackData(JSON.parse(raw), options.packSlug)
  const sql = generateSql(data, inputPath.replaceAll('\\', '/'))

  if (options.stdout) {
    process.stdout.write(sql)
    return
  }

  const safeSlug = data.pack.slug.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')
  const outputPath = options.output ?? path.join(DEFAULT_OUTPUT_DIR, `${yyyymmdd()}_zukan_seed_${safeSlug}.sql`)

  if (!options.force) {
    try {
      await readFile(outputPath, 'utf8')
      throw new Error(`Output already exists: ${outputPath}. Use --force or --output.`)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, sql, 'utf8')
  console.log(`Generated ${outputPath}`)
  console.log(`Pack: ${data.pack.slug} (${data.pack.code})`)
  console.log(`Cards: ${data.cards.length}`)
}

main().catch(error => {
  console.error(error.message)
  usage()
  process.exit(1)
})
