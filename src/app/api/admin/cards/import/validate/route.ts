import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { validateCardImport } from '@/lib/card-import'

export async function POST(request: Request) {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null) as { json?: unknown } | null
  return NextResponse.json(await validateCardImport(typeof body?.json === 'string' ? body.json : ''))
}
