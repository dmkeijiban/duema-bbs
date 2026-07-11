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
  let serviceRoleError: string | null = null
  let databaseError: string | null = null
  try {
    const { error } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1 })
    serviceRoleReadable = !error
    serviceRoleError = error?.message ?? null
  } catch (error) { serviceRoleError = error instanceof Error ? error.message : 'unknown' }
  if (process.env.SUPABASE_DB_URL) {
    const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
    try {
      await client.connect()
      const result = await client.query<{ current_database: string; current_user: string }>('select current_database(), current_user')
      databaseReadable = true
      databaseName = result.rows[0]?.current_database ?? null
      databaseRole = result.rows[0]?.current_user ?? null
    } catch (error) {
      const value = error as { code?: string }
      databaseError = value.code ?? (error instanceof Error ? error.name : 'unknown')
    } finally { await client.end().catch(() => undefined) }
  }

  return NextResponse.json({ ok: serviceRoleReadable && databaseReadable, ref, serviceRoleExists, databaseUrlExists, serviceRoleReadable, serviceRoleError, databaseReadable, databaseError, databaseName, databaseRole })
}
