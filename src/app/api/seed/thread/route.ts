import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SEED_THREADS } from '@/lib/seed-data'
import { notifyNewThread } from '@/lib/discord'

export const runtime = 'nodejs'
export const maxDuration = 60

// ==========================================
// あにまん掲示板から参考スレを取得するロジック
// ==========================================

const ANIMANCH_BASE = 'https://bbs.animanch.com'
const ANIMANCH_CATEGORY = `${ANIMANCH_BASE}/category25/`

const AUTHOR_NAME = '名無しのデュエリスト'

/** デュエマ関連キーワード判定 */
function isDuemaRelated(title: string): boolean {
  const keywords = [
    'デュエマ', 'デュエルマスターズ', 'デュエプレ',
    'クリーチャー', 'シールド', '殿堂', 'CS',
    'ボルバル', 'ガイアール', 'ジャスティス', 'ゼニス',
    'ドラグナー', 'マスターズ', 'デュエパ', '踏み倒し',
    '文明', 'タップ', 'マナゾーン', 'ツインパクト',
    'Dマスターズ', 'DM', 'dm-', 'アビス',
  ]
  return keywords.some(kw => title.includes(kw))
}

/** タイトルの変換（コピーではなく参考に） */
function transformTitle(original: string): string {
  let t = original
  // スレ番号・Part番号を除去 (その45, Part127, 第3弾スレ, 〜スレ目 など)
  t = t.replace(/\s*(その|Part|PART|part|第)\s*\d+\s*(スレ?目?|弾)?/g, '')
  t = t.replace(/\s*【?\d+スレ?目?】?/g, '')
  // 末尾の「スレ」を除去してより自然に
  t = t.replace(/スレ$/, '')
  // 「草」→「笑」
  t = t.replace(/草/g, '笑')
  // 「感想スレ」「語るスレ」などを自然な問いかけに
  t = t.replace(/感想(スレ?|板)?/, 'どうだった？')
  t = t.replace(/語る(スレ?|板)?$/, '語ろう')
  t = t.replace(/雑談(スレ?|板)?$/, '雑談しよう')
  // 末尾の記号を整える
  t = t.replace(/[！!]{2,}/g, '！')
  t = t.replace(/[？?]{2,}/g, '？')
  t = t.trim()
  return t || original
}

/** タイトル・本文からカテゴリIDを推定 */
function detectCategoryId(title: string, body: string): number {
  const text = `${title} ${body}`
  if (/デュエプレ|デュエルマスターズプレイス/.test(text)) return 17
  if (/アニメ|漫画|アニメカード/.test(text)) return 18
  if (/デュエパ|デュエルパートナー|特殊ルール/.test(text)) return 19
  if (/高騰|下落|値段|相場|買取|売/.test(text)) return 16
  if (/思い出|懐か|昔|旧弾|レジェンド|神化|エピソード/.test(text)) return 20
  if (/CS|大会|環境|トップメタ|優勝|入賞/.test(text)) return 15
  if (/デッキ相談|デッキレシピ|コンボ|構築|速攻|コントロール/.test(text)) return 14
  if (/新弾|新カード|新商品|収録|パック|ツインパクト/.test(text)) return 13
  if (/デュエチューバー|YouTube|実況|動画/.test(text)) return 22
  return 21
}

/** 本文を掲示板投稿用に整形 */
function buildThreadBody(title: string, rawBody: string): string {
  let body = rawBody.replace(/<[^>]*>/g, '').trim()
  body = body.replace(/\n{3,}/g, '\n\n')
  // あにまんから取得できた本文はそのまま使う
  if (body.length > 0) {
    return body
  }
  // 本文が空の場合のみ最小限のフォールバック
  return `${title}についてみなさんはどう思いますか？`
}

interface AnimanchThread {
  boardId: number
  title: string
}

interface AnimanchThreadDetail {
  body: string
  imageUrl: string | null
}

/** あにまん category25 からスレ一覧を取得 */
async function fetchAnimanchDuemaThreads(): Promise<AnimanchThread[]> {
  const res = await fetch(ANIMANCH_CATEGORY, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DuemaBBS/1.0)' },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`animanch category fetch failed: ${res.status}`)
  const html = await res.text()

  // 実際のHTML構造:
  // <a href="https://bbs.animanch.com/board/BOARDID/" class="card">
  //   ...<div class="card-body">スレタイ<p class="threadCount">N</p></div>...
  // </a>
  const threadPattern = /href="https:\/\/bbs\.animanch\.com\/board\/(\d+)\/"[^>]*class="card"[^>]*>[\s\S]*?<div class="card-body">([\s\S]*?)<p class="threadCount"/g
  const threads: AnimanchThread[] = []
  const seenIds = new Set<number>()
  let m: RegExpExecArray | null
  while ((m = threadPattern.exec(html)) !== null) {
    const boardId = parseInt(m[1], 10)
    if (seenIds.has(boardId)) continue
    seenIds.add(boardId)
    const rawTitle = m[2].trim()
    if (isDuemaRelated(rawTitle)) {
      threads.push({ boardId, title: rawTitle })
    }
  }
  return threads
}

/** あにまん個別スレから本文・画像URLを取得 */
async function fetchAnimanchFirstPost(boardId: number): Promise<AnimanchThreadDetail> {
  const url = `${ANIMANCH_BASE}/board/${boardId}/`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DuemaBBS/1.0)' },
    next: { revalidate: 0 },
  })
  if (!res.ok) return { body: '', imageUrl: null }
  const html = await res.text()

  let body = ''
  // 実際のHTML構造:
  // <div class="resbody nomal"><p>本文テキスト<br>続き</p>...</div>
  const bodyMatch = html.match(/<div class="resbody[^"]*">\s*<p>([\s\S]*?)<\/p>/)
  if (bodyMatch) {
    body = bodyMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim()
  }

  let imageUrl: string | null = null
  // 実際のHTML構造: href="https://bbs.animanch.com/img/BOARDID/1" (絶対URL)
  const imgMatch = html.match(/href="(https:\/\/bbs\.animanch\.com\/img\/\d+\/1)"/)
  if (imgMatch) {
    imageUrl = imgMatch[1]
  }

  return { body, imageUrl }
}

function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAnonClient()

  // 6時間単位のインデックス（1日4回で毎回違うスレを選ぶ）
  const sixHourIndex = Math.floor(Date.now() / 21600000)

  const result: {
    threadCreated?: { id: number; title: string }
    source?: string
    errors: string[]
  } = { errors: [] }

  try {
    const animanchThreads = await fetchAnimanchDuemaThreads()
    console.log(`Seed/thread: fetched ${animanchThreads.length} duema threads from animanch`)

    if (animanchThreads.length === 0) throw new Error('No duema threads found on animanch')

    const chosen = animanchThreads[sixHourIndex % animanchThreads.length]
    console.log(`Seed/thread: chosen animanch board ${chosen.boardId} "${chosen.title}"`)

    const detail = await fetchAnimanchFirstPost(chosen.boardId)

    const title = transformTitle(chosen.title)
    const body = buildThreadBody(title, detail.body)
    const categoryId = detectCategoryId(title, detail.body)

    const { data: created, error: threadError } = await supabase
      .from('threads')
      .insert({
        title,
        body,
        author_name: AUTHOR_NAME,
        category_id: categoryId,
        image_url: detail.imageUrl,
      })
      .select('id, title')
      .single()

    if (threadError || !created) {
      console.error('Seed/thread insert error:', threadError)
      result.errors.push(`thread: ${threadError?.message ?? 'unknown'}`)
    } else {
      result.threadCreated = { id: created.id, title: created.title }
      result.source = `animanch board ${chosen.boardId}`
      console.log(`Seed/thread: created ${created.id} "${created.title}"`)
      // カテゴリ名を取得してDiscord通知
      const { data: cat } = await supabase.from('categories').select('name').eq('id', categoryId).single()
      notifyNewThread({ threadId: created.id, title: created.title, categoryName: cat?.name ?? null }).catch(() => {})
    }
  } catch (err) {
    // フォールバック：seed-data.ts の固定テンプレートを使用
    console.error('Seed/thread: animanch fetch failed, falling back:', err)
    result.errors.push(`animanch: ${err instanceof Error ? err.message : String(err)}`)

    const template = SEED_THREADS[sixHourIndex % SEED_THREADS.length]
    const { data: created, error: threadError } = await supabase
      .from('threads')
      .insert({
        title: template.title,
        body: template.body,
        author_name: AUTHOR_NAME,
        category_id: template.category_id,
      })
      .select('id, title')
      .single()

    if (threadError || !created) {
      console.error('Seed/thread fallback insert error:', threadError)
      result.errors.push(`fallback: ${threadError?.message ?? 'unknown'}`)
    } else {
      result.threadCreated = { id: created.id, title: created.title }
      result.source = 'fallback seed-data'
      console.log(`Seed/thread: created fallback ${created.id} "${created.title}"`)
      // カテゴリ名を取得してDiscord通知
      const { data: cat } = await supabase.from('categories').select('name').eq('id', template.category_id).single()
      notifyNewThread({ threadId: created.id, title: created.title, categoryName: cat?.name ?? null }).catch(() => {})
    }
  }

  console.log('Seed/thread complete:', JSON.stringify(result))
  return NextResponse.json({ ok: true, ...result })
}
