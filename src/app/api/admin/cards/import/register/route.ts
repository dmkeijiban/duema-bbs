import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { registerCardImport } from '@/lib/card-import'

export async function POST(request: Request) {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null) as { json?: unknown; confirmed?: unknown } | null
  const result = await registerCardImport(typeof body?.json === 'string' ? body.json : '', body?.confirmed === true)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
