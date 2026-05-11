import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { fetchXRepliesByApify } from '@/lib/apify-x-replies'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

type RequestBody = {
  tweetUrl?: string
  maxItems?: number
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get('admin_auth')?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '入力内容を読み取れませんでした。' }, { status: 400 })
  }

  try {
    const result = await fetchXRepliesByApify(body.tweetUrl ?? '', body.maxItems ?? 50)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ApifyでXリプライ取得に失敗しました。'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
