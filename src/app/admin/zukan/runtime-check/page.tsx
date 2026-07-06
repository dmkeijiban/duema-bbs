import { cookies } from 'next/headers'

import { verifyAdminCookie } from '@/lib/admin-auth'

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

export default async function ZukanRuntimeCheckPage() {
  if (!(await isAdmin())) {
    return <main className="mx-auto max-w-3xl p-6 text-sm text-red-700">Unauthorized</main>
  }

  const result = {
    supabaseDbUrl: diagnosePostgresUrl(process.env.SUPABASE_DB_URL),
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-3 text-lg font-bold text-gray-800">Zukan Runtime Check</h1>
      <pre className="overflow-x-auto rounded border border-gray-200 bg-gray-50 p-4 text-xs text-gray-800">
        {JSON.stringify(result, null, 2)}
      </pre>
    </main>
  )
}
