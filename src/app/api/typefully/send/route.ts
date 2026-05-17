/**
 * POST /api/typefully/send
 *
 * 2026-06-01 の 4 投稿を Typefully に送信する。
 * Typefully REST API（api.typefully.com）ではなく MCP エンドポイント
 * （mcp.typefully.com/mcp）を使用する（REST API は Authorization: Bearer
 * 形式を受け付けないため）。
 * GET / PUT / PATCH / DELETE は一切実装しない。
 * 安全装置をサーバー側でも二重検証する。
 */

interface PostPayload {
  id: number
  date: string
  slot: string
  text: string
  sentToTypefully: boolean
  status: string
}

interface TypefullyResult {
  id: number
  slot: string
  ok: boolean
  typefullyId?: string
  error?: string
}

const TARGET_DATE = '2026-06-01'
const REQUIRED_SLOTS = ['07:00', '12:00', '19:00', '22:00']
const MAX_POSTS = 4

/** JST スロット → UTC ISO 文字列 */
function slotToUtc(date: string, slot: string): string {
  return new Date(`${date}T${slot}:00+09:00`).toISOString()
}

/**
 * Typefully MCP エンドポイントを呼び出して下書きを作成する。
 * SSE レスポンス（text/event-stream）をパースして結果を返す。
 */
async function createDraftViaMcp(
  token: string,
  socialSetId: number,
  text: string,
  scheduledDate: string,
): Promise<{ ok: boolean; typefullyId?: string; error?: string }> {
  const body = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'typefully_create_draft',
      arguments: {
        social_set_id: socialSetId,
        requestBody: {
          platforms: {
            x: {
              enabled: true,
              posts: [{ text }],
            },
          },
          publish_at: scheduledDate,
        },
      },
    },
    id: 1,
  }

  const res = await fetch('https://mcp.typefully.com/mcp', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(body),
  })

  const rawText = await res.text()

  // SSE 形式: 各行が "data: {...}" または "event: ..." など
  // "data: " で始まる行を探してパースする
  let parsed: Record<string, unknown> | null = null
  for (const line of rawText.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        parsed = JSON.parse(line.slice(6))
        break
      } catch {
        // continue
      }
    }
  }

  if (!parsed) {
    return { ok: false, error: `MCP レスポンスのパース失敗: ${rawText.slice(0, 200)}` }
  }

  if (parsed.error) {
    const err = parsed.error as Record<string, unknown>
    return { ok: false, error: String(err.message ?? JSON.stringify(err)) }
  }

  // result.structuredContent.id が Typefully draft ID
  const result = parsed.result as Record<string, unknown> | undefined
  const structured = result?.structuredContent as Record<string, unknown> | undefined
  const typefullyId = structured?.id != null ? String(structured.id) : undefined

  return { ok: true, typefullyId }
}

export async function POST(request: Request): Promise<Response> {
  // ── 1. APIキー確認 ──────────────────────────────────
  const apiKey = process.env.TYPEFULLY_API_KEY
  if (!apiKey || apiKey.trim() === '') {
    return Response.json(
      {
        error: 'TYPEFULLY_API_KEY が設定されていません。.env.local を確認してください。',
        setup: 'https://app.typefully.com/settings/api でキーを取得し .env.local に追加後、サーバーを再起動してください。',
      },
      { status: 500 },
    )
  }

  const socialSetIdStr = process.env.TYPEFULLY_SOCIAL_SET_ID
  const socialSetId = socialSetIdStr ? Number(socialSetIdStr) : NaN
  if (!socialSetIdStr || isNaN(socialSetId)) {
    return Response.json(
      { error: 'TYPEFULLY_SOCIAL_SET_ID が設定されていません。.env.local に 306286 を追加してください。' },
      { status: 500 },
    )
  }

  // ── 2. リクエストパース ──────────────────────────────
  let posts: PostPayload[]
  try {
    const body = await request.json()
    posts = body.posts
    if (!Array.isArray(posts)) throw new Error('posts が配列ではありません')
  } catch {
    return Response.json({ error: 'リクエストボディが不正です' }, { status: 400 })
  }

  // ── 3. 安全装置チェック（サーバー側二重検証）─────────
  const errors: string[] = []

  if (posts.length !== MAX_POSTS) {
    errors.push(`送信件数が ${posts.length} 件です（必ず ${MAX_POSTS} 件でなければなりません）`)
  }

  const nonTarget = posts.filter((p) => p.date !== TARGET_DATE)
  if (nonTarget.length > 0) {
    errors.push(`6/1 以外の投稿が含まれています: ${nonTarget.map((p) => p.date).join(', ')}`)
  }

  const alreadySent = posts.filter((p) => p.sentToTypefully)
  if (alreadySent.length > 0) {
    errors.push(`既に送信済みの投稿が含まれています: id ${alreadySent.map((p) => p.id).join(', ')}`)
  }

  const emptyText = posts.filter((p) => !p.text || p.text.trim() === '')
  if (emptyText.length > 0) {
    errors.push(`本文が空の投稿があります: id ${emptyText.map((p) => p.id).join(', ')}`)
  }

  const badStatus = posts.filter((p) => !['draft', 'pending'].includes(p.status))
  if (badStatus.length > 0) {
    errors.push(`不正なステータスの投稿があります: ${badStatus.map((p) => `id${p.id}=${p.status}`).join(', ')}`)
  }

  const slotCount: Record<string, number> = {}
  for (const p of posts) {
    slotCount[p.slot] = (slotCount[p.slot] ?? 0) + 1
  }
  const dupSlots = Object.entries(slotCount)
    .filter(([, c]) => c > 1)
    .map(([s]) => s)
  if (dupSlots.length > 0) {
    errors.push(`スロットが重複しています: ${dupSlots.join(', ')}`)
  }

  const missingSlots = REQUIRED_SLOTS.filter((s) => !posts.some((p) => p.slot === s))
  if (missingSlots.length > 0) {
    errors.push(`必須スロットが不足しています: ${missingSlots.join(', ')}`)
  }

  const now = new Date()
  const pastPosts = posts.filter((p) => new Date(`${p.date}T${p.slot}:00+09:00`) <= now)
  if (pastPosts.length > 0) {
    errors.push(`過去の日時の投稿があります: ${pastPosts.map((p) => `${p.date} ${p.slot}`).join(', ')}`)
  }

  if (errors.length > 0) {
    return Response.json({ error: '安全装置チェック失敗', details: errors }, { status: 400 })
  }

  // ── 4. Typefully MCP エンドポイントへ送信 ───────────
  const results: TypefullyResult[] = []

  for (const post of posts) {
    const scheduledDate = slotToUtc(post.date, post.slot)
    const { ok, typefullyId, error: errorMsg } = await createDraftViaMcp(
      apiKey,
      socialSetId,
      post.text,
      scheduledDate,
    )
    results.push({ id: post.id, slot: post.slot, ok, typefullyId, error: errorMsg })
  }

  const allOk = results.every((r) => r.ok)
  const successCount = results.filter((r) => r.ok).length

  return Response.json(
    {
      allOk,
      successCount,
      totalCount: posts.length,
      results,
    },
    { status: allOk ? 200 : 207 },
  )
}

// GET / PUT / PATCH / DELETE は明示的に405を返す
export async function GET() {
  return Response.json({ error: 'Method Not Allowed' }, { status: 405 })
}
export async function PUT() {
  return Response.json({ error: 'Method Not Allowed' }, { status: 405 })
}
export async function PATCH() {
  return Response.json({ error: 'Method Not Allowed' }, { status: 405 })
}
export async function DELETE() {
  return Response.json({ error: 'Method Not Allowed' }, { status: 405 })
}
