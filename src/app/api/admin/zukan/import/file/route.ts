import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { verifyAdminCookie } from '@/lib/admin-auth'
import { readZukanPackJsonFile } from '@/lib/zukan-pack-files'

export const runtime = 'nodejs'

async function isAdmin() {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get('admin_auth')?.value)
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as { slug?: unknown } | null
  const slug = typeof body?.slug === 'string' ? body.slug : ''
  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 })
  }

  try {
    const json = await readZukanPackJsonFile(slug)
    return NextResponse.json({ slug, json })
  } catch {
    return NextResponse.json({ error: 'JSONファイルを読み込めませんでした' }, { status: 404 })
  }
}
