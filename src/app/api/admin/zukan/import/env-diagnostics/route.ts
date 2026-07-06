import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { verifyAdminCookie } from '@/lib/admin-auth'

export const runtime = 'nodejs'

type SafeEnvDiagnostic = {
  exists: boolean
  valueLength: number
  startsWithPostgres: boolean
  startsWithPostgresql: boolean
  parseOk: boolean
  hostExists: boolean
  hostEndsWithPoolerSupabaseCom: boolean
  port: string | null
  dbPathExists: boolean
  hasWhitespace: boolean
  hasYourPasswordPlaceholder: boolean
}

async function isAdmin() {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get('admin_auth')?.value)
}

function diagnosePostgresUrl(value: string | undefined): SafeEnvDiagnostic {
  const raw = value ?? ''
  const trimmed = raw.trim()
  let url: URL | null = null

  try {
    url = trimmed ? new URL(trimmed) : null
  } catch {
    url = null
  }

  return {
    exists: typeof value === 'string' && value.length > 0,
    valueLength: raw.length,
    startsWithPostgres: trimmed.startsWith('postgres://'),
    startsWithPostgresql: trimmed.startsWith('postgresql://'),
    parseOk: url !== null,
    hostExists: Boolean(url?.hostname),
    hostEndsWithPoolerSupabaseCom: Boolean(url?.hostname.endsWith('pooler.supabase.com')),
    port: url?.port || null,
    dbPathExists: Boolean(url?.pathname && url.pathname !== '/'),
    hasWhitespace: /\s/.test(raw),
    hasYourPasswordPlaceholder: raw.includes('[YOUR-PASSWORD]'),
  }
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    supabaseDbUrl: diagnosePostgresUrl(process.env.SUPABASE_DB_URL),
  })
}
