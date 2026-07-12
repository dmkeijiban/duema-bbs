import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Client } from 'pg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PREVIEW_REF = 'ibhnzvndgciqoexnytmp'
const PRODUCTION_REF = 'nodgfukqvuwvgfnlzvnh'
const BRANCH = 'feat/private-hall-of-fame-predictions'
const CARDS_MIGRATION_SHA = '97ff3f8e31bfd6246b0e5b4cf38c718d8f41a3d04050a39ca70a5205382bbdda'
const MAKER_MIGRATION_SHA = 'da635cbbfca2789f200532663557b1eddb1e8b3731fd3d28df095b8ed7266610'

type Candidate = {
  card_number: string
  card_name: string
  image_url: string
  civilization: string[] | null
  cost: number | null
  card_type: string | null
  rarity: string | null
}

function normalizeName(value: string) {
  return value.normalize('NFKC').trim().replace(/[\s　]+/g, ' ').replace(/[／/]/g, '／')
}

function sha(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function targetGuard() {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const databaseUrl = process.env.SUPABASE_DB_URL ?? ''
  if (process.env.VERCEL_ENV !== 'preview') throw new Error('NOT_PREVIEW')
  if (process.env.VERCEL_GIT_COMMIT_REF !== BRANCH) throw new Error('WRONG_BRANCH')
  if (!publicUrl.includes(PREVIEW_REF) || !databaseUrl.includes(PREVIEW_REF)) throw new Error('PREVIEW_REF_MISSING')
  if (publicUrl.includes(PRODUCTION_REF) || databaseUrl.includes(PRODUCTION_REF)) throw new Error('PRODUCTION_REF_DETECTED')
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SERVICE_ROLE_MISSING')
  return { publicUrl, databaseUrl }
}

async function withClient<T>(callback: (client: Client) => Promise<T>) {
  const { databaseUrl } = targetGuard()
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    const identity = await client.query<{ current_database: string; current_user: string }>('select current_database(), current_user')
    return await callback(client).then(result => ({ identity: identity.rows[0], result }))
  } finally {
    await client.end().catch(() => undefined)
  }
}

export async function GET() {
  try {
    const output = await withClient(async client => {
      const state = await client.query(`select
        to_regclass('public.cards') is not null cards_exists,
        to_regclass('public.maker_projects') is not null maker_projects_exists`)
      return { ref: PREVIEW_REF, serviceRoleExists: true, databaseUrlExists: true, ...state.rows[0] }
    })
    return NextResponse.json({ ok: true, ...output })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'UNKNOWN' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { cardsMigration: string; makerMigration: string; cards: Candidate[] }
    if (sha(body.cardsMigration) !== CARDS_MIGRATION_SHA || sha(body.makerMigration) !== MAKER_MIGRATION_SHA) {
      throw new Error('MIGRATION_HASH_MISMATCH')
    }
    if (!Array.isArray(body.cards) || body.cards.length !== 89) throw new Error('CARD_COUNT_INVALID')
    const numbers = body.cards.map(card => Number(card.card_number.split('/')[0])).sort((a, b) => a - b)
    if (numbers.some((number, index) => number !== index + 1)) throw new Error('CARD_NUMBER_RANGE_INVALID')
    if (body.cards.some(card => !card.card_name || !card.image_url || card.card_number.startsWith('PR') || card.card_number.startsWith('MC') || card.card_number.startsWith('SPR'))) {
      throw new Error('VARIANT_OR_INVALID_CARD')
    }

    const output = await withClient(async client => {
      await client.query('begin')
      try {
        await client.query(body.cardsMigration)
        await client.query(body.makerMigration)
        const project = await client.query<{ id: string }>(`select id from public.maker_projects where slug=$1`, ['dm26-ex2-charisma-best-tier'])
        if (!project.rows[0]) throw new Error('PROJECT_NOT_CREATED')
        const projectId = project.rows[0].id
        const cardIds: string[] = []
        for (const card of body.cards) {
          const result = await client.query<{ id: string }>(`insert into public.cards(name,normalized_name,image_url,civilization,cost,card_type,regulation,is_active)
            values($1,$2,$3,$4,$5,$6,'none',true)
            on conflict(normalized_name) do update set name=excluded.name,image_url=excluded.image_url,civilization=excluded.civilization,cost=excluded.cost,card_type=excluded.card_type,is_active=true,updated_at=now()
            returning id`, [card.card_name, normalizeName(card.card_name), card.image_url, card.civilization ?? [], card.cost, card.card_type])
          cardIds.push(result.rows[0].id)
        }
        await client.query('delete from public.maker_project_cards where project_id=$1', [projectId])
        for (let index = 0; index < cardIds.length; index += 1) {
          await client.query('insert into public.maker_project_cards(project_id,card_id,sort_order) values($1,$2,$3)', [projectId, cardIds[index], index + 1])
        }
        await client.query('commit')
        const checks = await client.query(`select
          (select count(*)::int from public.cards where id=any($1::uuid[])) card_count,
          (select count(*)::int from public.maker_project_cards where project_id=$2) project_card_count,
          (select relrowsecurity from pg_class where oid='public.cards'::regclass) cards_rls,
          (select count(*)::int from pg_policies where schemaname='public' and tablename in ('cards','maker_projects','maker_project_cards','maker_submissions','maker_submission_items')) policy_count,
          (select count(*)::int from information_schema.routines where routine_schema='public' and routine_name='save_maker_submission') function_count,
          to_regclass('public.maker_tier_aggregates') is not null aggregate_view_exists`, [cardIds, projectId])
        return { projectId, ...checks.rows[0] }
      } catch (error) {
        await client.query('rollback')
        throw error
      }
    })
    return NextResponse.json({ ok: true, ref: PREVIEW_REF, ...output })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'UNKNOWN' }, { status: 400 })
  }
}
