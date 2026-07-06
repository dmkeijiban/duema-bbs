import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { verifyAdminCookie } from '@/lib/admin-auth'
import { registerZukanImport } from '@/lib/zukan-pack-import'

export const runtime = 'nodejs'

async function isAdmin() {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get('admin_auth')?.value)
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as { json?: unknown; confirmed?: unknown } | null
  const json = typeof body?.json === 'string' ? body.json : ''
  const confirmed = body?.confirmed === true
  const result = await registerZukanImport(json, confirmed)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
