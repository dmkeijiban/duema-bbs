import { NextResponse } from 'next/server'
import { Client } from 'pg'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EXPECTED_PREVIEW_REF = 'ibhnzvndgciqoexnytmp'

function projectRef(url: string | undefined) {
  if (!url) return null
  try { return new URL(url).hostname.split('.')[0] ?? null } catch { return null }
}

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') return new NextResponse(null, { status: 404 })

  const ref = projectRef(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const serviceRoleExists = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const databaseUrlExists = Boolean(process.env.SUPABASE_DB_URL)
  if (ref !== EXPECTED_PREVIEW_REF) {
    return NextResponse.json({ ok: false, ref, expectedRef: EXPECTED_PREVIEW_REF, serviceRoleExists, databaseUrlExists }, { status: 503 })
  }

  let serviceRoleReadable = false
  let databaseReadable = false
  let databaseName: string | null = null
  let databaseRole: string | null = null
  try {
    const { error } = await createAdminClient().from('zukan_cards').select('id').limit(1)
    serviceRoleReadable = !error
  } catch {}
  if (process.env.SUPABASE_DB_URL) {
    const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
    try {
      await client.connect()
      const result = await client.query<{ current_database: string; current_user: string }>('select current_database(), current_user')
      databaseReadable = true
      databaseName = result.rows[0]?.current_database ?? null
      databaseRole = result.rows[0]?.current_user ?? null
    } catch {} finally { await client.end().catch(() => undefined) }
  }

  return NextResponse.json({ ok: serviceRoleReadable && databaseReadable, ref, serviceRoleExists, databaseUrlExists, serviceRoleReadable, databaseReadable, databaseName, databaseRole })
}
