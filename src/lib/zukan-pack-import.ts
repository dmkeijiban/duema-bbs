import 'server-only'

import type { Pool, PoolClient } from 'pg'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  validateZukanPackData,
  type ZukanPackImportCard,
  type ZukanPackImportData,
  type ZukanPackImportPack,
  type ZukanValidationResult,
} from '@/lib/zukan-pack-validation'

export type ZukanImportEnvStatus = {
  canRegister: boolean
  canCheckDuplicates: boolean
  message: string | null
}

export type ZukanImportDuplicateCheck = {
  checked: boolean
  existingPackSlugs: string[]
  existingCardSlugs: string[]
  errors: string[]
  warnings: string[]
}

export type ZukanImportPreview = {
  pack: {
    slug: string
    code: string
    name: string
    released_year: string | null
    card_count: number
    sort_order: number
    is_published: boolean
  }
  cardsLength: number
  representativeCards: Array<{
    slug: string
    name: string
    card_type: string
    civilization: string
    cost: number | null
    power: string | null
    rarity: string
    official_page_url: string
    sort_order: number
  }>
}

export type ZukanImportValidationResponse = {
  ok: boolean
  validation: ZukanValidationResult
  duplicateCheck: ZukanImportDuplicateCheck
  preview: ZukanImportPreview | null
  env: ZukanImportEnvStatus
}

export type ZukanImportRegisterResult = {
  ok: boolean
  message: string
  packSlug?: string
  expectedCardCount?: number
  actualCardCount?: number
}

let pool: Pool | null = null

export function getZukanImportEnvStatus(): ZukanImportEnvStatus {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL)
  const hasSupabaseAdmin = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  const canCheckDuplicates = hasDatabaseUrl || hasSupabaseAdmin || Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  return {
    canRegister: hasDatabaseUrl,
    canCheckDuplicates,
    message: hasDatabaseUrl ? null : '管理用環境変数が未設定です',
  }
}

function getDatabaseUrl() {
  return process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || null
}

async function getPool() {
  const databaseUrl = getDatabaseUrl()
  if (!databaseUrl) throw new Error('管理用環境変数が未設定です')
  if (!pool) {
    const { Pool: PgPool } = await import('pg')
    const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')
    pool = new PgPool({
      connectionString: databaseUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 1,
    })
  }
  return pool
}

function toNullableString(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toRequiredString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function toNullableInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function toRequiredInteger(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback
}

function toBoolean(value: unknown, fallback = true) {
  return typeof value === 'boolean' ? value : fallback
}

export function parseZukanImportJson(input: string): { data: ZukanPackImportData | null; error: string | null } {
  try {
    const parsed = JSON.parse(input) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { data: null, error: 'JSONのルートは object にしてください' }
    }
    return { data: parsed as ZukanPackImportData, error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? `JSON parse error: ${error.message}` : 'JSON parse error',
    }
  }
}

function buildPreview(data: ZukanPackImportData): ZukanImportPreview | null {
  const pack = data.pack
  const cards = data.cards
  if (!pack || !Array.isArray(cards)) return null

  return {
    pack: {
      slug: toRequiredString(pack.slug),
      code: toRequiredString(pack.code),
      name: toRequiredString(pack.name),
      released_year: toNullableString(pack.released_year),
      card_count: toRequiredInteger(pack.card_count, cards.length),
      sort_order: toRequiredInteger(pack.sort_order),
      is_published: toBoolean(pack.is_published, true),
    },
    cardsLength: cards.length,
    representativeCards: cards
      .slice()
      .sort((a, b) => toRequiredInteger(a.sort_order) - toRequiredInteger(b.sort_order))
      .slice(0, 8)
      .map(card => ({
        slug: toRequiredString(card.slug),
        name: toRequiredString(card.name),
        card_type: toRequiredString(card.card_type),
        civilization: toRequiredString(card.civilization),
        cost: toNullableInteger(card.cost),
        power: toNullableString(card.power),
        rarity: toRequiredString(card.rarity),
        official_page_url: toRequiredString(card.official_page_url),
        sort_order: toRequiredInteger(card.sort_order),
      })),
  }
}

function cardSlugs(data: ZukanPackImportData) {
  return Array.isArray(data.cards)
    ? data.cards.map(card => toRequiredString(card.slug)).filter(Boolean)
    : []
}

export async function checkZukanImportDuplicates(data: ZukanPackImportData): Promise<ZukanImportDuplicateCheck> {
  const packSlug = toRequiredString(data.pack?.slug)
  const slugs = cardSlugs(data)
  const errors: string[] = []
  const warnings: string[] = []

  if (!packSlug && slugs.length === 0) {
    return { checked: false, existingPackSlugs: [], existingCardSlugs: [], errors, warnings }
  }

  const databaseUrl = getDatabaseUrl()
  if (databaseUrl) {
    try {
      const db = await getPool()
      const client = await db.connect()
      try {
        const packResult = packSlug
          ? await client.query<{ slug: string }>('select slug from public.zukan_packs where slug = $1', [packSlug])
          : { rows: [] }
        const cardResult = slugs.length > 0
          ? await client.query<{ slug: string }>('select slug from public.zukan_cards where slug = any($1::text[]) order by slug', [slugs])
          : { rows: [] }
        const existingPackSlugs = packResult.rows.map(row => row.slug)
        const existingCardSlugs = cardResult.rows.map(row => row.slug)
        if (existingPackSlugs.length > 0) errors.push(`[pack] slug already exists: ${existingPackSlugs.join(', ')}`)
        if (existingCardSlugs.length > 0) errors.push(`[cards] slug already exists: ${existingCardSlugs.slice(0, 20).join(', ')}${existingCardSlugs.length > 20 ? ' ...' : ''}`)
        return { checked: true, existingPackSlugs, existingCardSlugs, errors, warnings }
      } finally {
        client.release()
      }
    } catch {
      warnings.push('DATABASE_URL / SUPABASE_DB_URL での既存slug重複チェックに失敗しました')
    }
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createAdminClient()
      const [packResult, cardResult] = await Promise.all([
        packSlug
          ? supabase.from('zukan_packs').select('slug').eq('slug', packSlug)
          : Promise.resolve({ data: [] }),
        slugs.length > 0
          ? supabase.from('zukan_cards').select('slug').in('slug', slugs)
          : Promise.resolve({ data: [] }),
      ])
      if ('error' in packResult && packResult.error) throw packResult.error
      if ('error' in cardResult && cardResult.error) throw cardResult.error
      const existingPackSlugs = ((packResult.data ?? []) as { slug: string }[]).map(row => row.slug)
      const existingCardSlugs = ((cardResult.data ?? []) as { slug: string }[]).map(row => row.slug)
      if (existingPackSlugs.length > 0) errors.push(`[pack] slug already exists: ${existingPackSlugs.join(', ')}`)
      if (existingCardSlugs.length > 0) errors.push(`[cards] slug already exists: ${existingCardSlugs.slice(0, 20).join(', ')}${existingCardSlugs.length > 20 ? ' ...' : ''}`)
      return { checked: true, existingPackSlugs, existingCardSlugs, errors, warnings }
    } catch {
      errors.push('既存slug重複チェックに失敗しました')
      return { checked: false, existingPackSlugs: [], existingCardSlugs: [], errors, warnings }
    }
  }

  if (databaseUrl) {
    errors.push('既存slug重複チェックに失敗しました')
    return { checked: false, existingPackSlugs: [], existingCardSlugs: [], errors, warnings }
  }

  warnings.push('DB接続情報がないため、既存slug重複チェックは未実行です')
  return { checked: false, existingPackSlugs: [], existingCardSlugs: [], errors, warnings }
}

export async function validateZukanImport(input: string): Promise<ZukanImportValidationResponse> {
  const parsed = parseZukanImportJson(input)
  const env = getZukanImportEnvStatus()
  if (!parsed.data) {
    return {
      ok: false,
      validation: { errors: [parsed.error ?? 'JSON parse error'], warnings: [] },
      duplicateCheck: { checked: false, existingPackSlugs: [], existingCardSlugs: [], errors: [], warnings: [] },
      preview: null,
      env,
    }
  }

  const validation = validateZukanPackData(parsed.data)
  const duplicateCheck = await checkZukanImportDuplicates(parsed.data)
  const errors = [...validation.errors, ...duplicateCheck.errors]
  const warnings = [...validation.warnings, ...duplicateCheck.warnings]

  return {
    ok: errors.length === 0,
    validation: { errors, warnings },
    duplicateCheck,
    preview: buildPreview(parsed.data),
    env,
  }
}

function normalizePack(pack: ZukanPackImportPack, cardsLength: number) {
  return {
    slug: toRequiredString(pack.slug),
    code: toRequiredString(pack.code),
    name: toRequiredString(pack.name),
    released_year: toNullableString(pack.released_year),
    card_count: toRequiredInteger(pack.card_count, cardsLength),
    description: toNullableString(pack.description),
    is_published: true,
    sort_order: toRequiredInteger(pack.sort_order),
    image_url: toNullableString(pack.image_url),
  }
}

function normalizeCard(card: ZukanPackImportCard, packId: string) {
  return {
    pack_id: packId,
    slug: toRequiredString(card.slug),
    name: toRequiredString(card.name),
    card_type: toRequiredString(card.card_type),
    civilization: toRequiredString(card.civilization),
    cost: toNullableInteger(card.cost),
    mana: toNullableInteger(card.mana),
    race: toNullableString(card.race),
    power: toNullableString(card.power),
    rarity: toRequiredString(card.rarity),
    illustrator: toNullableString(card.illustrator),
    ability_text: toNullableString(card.ability_text),
    flavor_text: toNullableString(card.flavor_text),
    image_url: toNullableString(card.image_url),
    official_page_url: toNullableString(card.official_page_url),
    official_image_url: toNullableString(card.official_image_url),
    is_published: true,
    sort_order: toRequiredInteger(card.sort_order),
  }
}

async function insertPack(client: PoolClient, pack: ReturnType<typeof normalizePack>) {
  const result = await client.query<{ id: string }>(
    `insert into public.zukan_packs
      (slug, code, name, released_year, card_count, description, is_published, sort_order, image_url)
     values ($1, $2, $3, $4, $5, $6, true, $7, $8)
     returning id`,
    [pack.slug, pack.code, pack.name, pack.released_year, pack.card_count, pack.description, pack.sort_order, pack.image_url],
  )
  return result.rows[0]?.id
}

async function insertCards(client: PoolClient, cards: ReturnType<typeof normalizeCard>[]) {
  for (const card of cards) {
    await client.query(
      `insert into public.zukan_cards
        (pack_id, slug, name, card_type, civilization, cost, mana, race, power, rarity, illustrator, ability_text, flavor_text, image_url, official_page_url, official_image_url, is_published, sort_order)
       values
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true, $17)`,
      [
        card.pack_id,
        card.slug,
        card.name,
        card.card_type,
        card.civilization,
        card.cost,
        card.mana,
        card.race,
        card.power,
        card.rarity,
        card.illustrator,
        card.ability_text,
        card.flavor_text,
        card.image_url,
        card.official_page_url,
        card.official_image_url,
        card.sort_order,
      ],
    )
  }
}

export async function registerZukanImport(input: string, confirmed: boolean): Promise<ZukanImportRegisterResult> {
  if (!confirmed) {
    return { ok: false, message: '登録前の確認チェックを入れてください' }
  }

  const env = getZukanImportEnvStatus()
  if (!env.canRegister) {
    return { ok: false, message: env.message ?? '管理用環境変数が未設定です' }
  }

  const parsed = parseZukanImportJson(input)
  if (!parsed.data?.pack || !Array.isArray(parsed.data.cards)) {
    return { ok: false, message: parsed.error ?? 'JSON形式が不正です' }
  }

  const validation = validateZukanPackData(parsed.data)
  if (validation.errors.length > 0) {
    return { ok: false, message: `validateエラーがあります: ${validation.errors[0]}` }
  }

  const duplicateCheck = await checkZukanImportDuplicates(parsed.data)
  if (duplicateCheck.errors.length > 0) {
    return { ok: false, message: `既存slugがあります: ${duplicateCheck.errors[0]}` }
  }

  const pack = normalizePack(parsed.data.pack, parsed.data.cards.length)
  const db = await getPool()
  const client = await db.connect()

  try {
    await client.query('begin')
    const packId = await insertPack(client, pack)
    if (!packId) throw new Error('pack insert failed')

    const cards = parsed.data.cards.map(card => normalizeCard(card, packId))
    await insertCards(client, cards)

    const countResult = await client.query<{ count: string }>(
      'select count(*)::int as count from public.zukan_cards where pack_id = $1',
      [packId],
    )
    const actualCardCount = Number(countResult.rows[0]?.count ?? 0)
    if (actualCardCount !== pack.card_count) {
      throw new Error(`actual_card_count mismatch: expected=${pack.card_count}, actual=${actualCardCount}`)
    }

    await client.query('commit')
    return {
      ok: true,
      message: '登録しました',
      packSlug: pack.slug,
      expectedCardCount: pack.card_count,
      actualCardCount,
    }
  } catch (error) {
    await client.query('rollback')
    return {
      ok: false,
      message: error instanceof Error ? error.message : '登録に失敗しました',
      packSlug: pack.slug,
      expectedCardCount: pack.card_count,
    }
  } finally {
    client.release()
  }
}
