import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { revalidateTag } from 'next/cache'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_auth')?.value !== process.env.ADMIN_PASSWORD)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { threadId } = await req.json()
  if (!threadId || typeof threadId !== 'number')
    return NextResponse.json({ error: 'threadId が必要です' }, { status: 400 })

  revalidateTag(`thread-${threadId}`, { expire: 0 })

  return NextResponse.json({ ok: true, threadId })
}
