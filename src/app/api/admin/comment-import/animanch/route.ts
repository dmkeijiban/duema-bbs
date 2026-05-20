import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { COMMENT_IMPORT_LIMIT, extractAnimanchBoardId } from '@/lib/comment-import'

const ANIMANCH_BASE = 'https://bbs.animanch.com'

async function fetchAnimanchComments(boardId: number): Promise<string[]> {
  const url = `${ANIMANCH_BASE}/board/${boardId}/`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DuemaBBS/1.0)' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`あにまんスレの取得に失敗しました（HTTP ${res.status}）`)
  const html = await res.text()

  const commentPattern = /<div class='resbody[^']*'>\s*<p>([\s\S]*?)<\/p>/g
  const comments: string[] = []
  let count = 0
  let m: RegExpExecArray | null

  while ((m = commentPattern.exec(html)) !== null) {
    count++
    if (count === 1) continue // 1件目（スレ本文）はスキップ
    const raw = m[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/>>?\d+/g, '')
      .replace(/\n{3,}/g, '\n')
      .trim()
    if (raw.length >= 5 && raw.length <= 3000) comments.push(raw)
    if (comments.length >= COMMENT_IMPORT_LIMIT) break
  }

  return comments
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get('admin_auth')?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = req.nextUrl.searchParams.get('url') ?? ''
  const boardId = extractAnimanchBoardId(url)
  if (!boardId) {
    return NextResponse.json(
      { error: 'あにまんのスレURLを読み取れませんでした。https://bbs.animanch.com/board/〇〇/ の形式で入力してください。' },
      { status: 400 },
    )
  }

  try {
    const comments = await fetchAnimanchComments(boardId)
    return NextResponse.json({ boardId, comments })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'あにまんコメント取得中にエラーが出ました。' },
      { status: 500 },
    )
  }
}
