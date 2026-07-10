import { NextRequest, NextResponse } from 'next/server'
import { Pool, type PoolClient } from 'pg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ONE_TIME_TOKEN = '3c9604f330c980ba5d9baef01ae2e1170beb652fe2767906'
const MIGRATION_SOURCE_URL =
  'https://raw.githubusercontent.com/dmkeijiban/duema-bbs/ba14fc501a9c0bd48b35b911734b997397ccb1ef/supabase/migrations/20260710_thread_polls_and_quizzes.sql'

function getDatabaseUrl() {
  return (process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL ?? '').trim()
}

function getDatabaseUrlCandidates(databaseUrl: string) {
  const candidates = [databaseUrl]
  try {
    const parsed = new URL(databaseUrl)
    const projectRef = parsed.hostname.match(/^db\.([^.]+)\.supabase\.co$/)?.[1]
    if (!projectRef) return candidates

    for (const region of ['ap-northeast-1', 'ap-southeast-1', 'us-east-1']) {
      const pooler = new URL(databaseUrl)
      pooler.hostname = `aws-0-${region}.pooler.supabase.com`
      pooler.port = '5432'
      pooler.username = `postgres.${projectRef}`
      candidates.push(pooler.toString())
    }
  } catch {
    return candidates
  }
  return candidates
}

async function connectDatabase(databaseUrl: string): Promise<{ pool: Pool; client: PoolClient }> {
  let lastError: unknown = null
  for (const candidate of getDatabaseUrlCandidates(databaseUrl)) {
    const parsed = new URL(candidate)
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
    const pool = new Pool({
      connectionString: candidate,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 5000,
    })
    try {
      const client = await pool.connect()
      return { pool, client }
    } catch (error) {
      lastError = error
      await pool.end().catch(() => undefined)
    }
  }
  throw lastError ?? new Error('database_connection_failed')
}

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ ok: false, error: 'production_only' }, { status: 403 })
  }
  if (request.nextUrl.searchParams.get('token') !== ONE_TIME_TOKEN) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const databaseUrl = getDatabaseUrl()
  if (!databaseUrl) {
    return NextResponse.json({ ok: false, error: 'database_url_missing' }, { status: 503 })
  }

  const migrationResponse = await fetch(MIGRATION_SOURCE_URL, { cache: 'no-store' })
  if (!migrationResponse.ok) {
    return NextResponse.json({ ok: false, error: 'migration_source_unavailable' }, { status: 502 })
  }
  const migrationSql = await migrationResponse.text()

  try {
    const { pool, client } = await connectDatabase(databaseUrl)
    try {
      await client.query('begin')
      await client.query('select pg_advisory_xact_lock($1)', [20260710])
      await client.query(migrationSql)
      const verification = await client.query<{
        polls: string | null
        options: string | null
        votes: string | null
        rpc: string | null
      }>(`
        select
          to_regclass('public.thread_polls')::text as polls,
          to_regclass('public.thread_poll_options')::text as options,
          to_regclass('public.thread_poll_votes')::text as votes,
          to_regprocedure('public.create_interactive_thread(text,text,text,integer,text,text,integer,integer,text,uuid,text,jsonb)')::text as rpc
      `)
      await client.query('commit')

      const row = verification.rows[0]
      const verified = Boolean(row?.polls && row?.options && row?.votes && row?.rpc)
      return NextResponse.json({ ok: verified, verified })
    } catch (error) {
      await client.query('rollback').catch(() => undefined)
      throw error
    } finally {
      client.release()
      await pool.end()
    }
  } catch (error) {
    console.error('thread poll migration failed:', error)
    return NextResponse.json({ ok: false, error: 'migration_failed' }, { status: 500 })
  }
}
