import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SEED_COMMENTS } from '@/lib/seed-data'

export const runtime = 'nodejs'
export const maxDuration = 60

const ANIMANCH_BASE = 'https://bbs.animanch.com'
const ANIMANCH_CATEGORY = `${ANIMANCH_BASE}/category25/`

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

/** コメントを自然なものに軽く変換 */
function transformComment(text: string): string {
  let t = text
  t = t.replace(/草/g, '笑')
  t = t.replace(/>>?\d+/g, '')
  t = t.replace(/あにまん|animanch/gi, 'ここ')
  t = t.replace(/\n{3,}/g, '\n')
  return t.trim()
}

interface AnimanchThread {
  boardId: number
  title: string
}

/** あにまん category25 からスレ一覧を取得 */
async function fetchAnimanchDuemaThreads(): Promise<AnimanchThread[]> {
  const res = await fetch(ANIMANCH_CATEGORY, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DuemaBBS/1.0)' },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`animanch category fetch failed: ${res.status}`)
  const html = await res.text()

  const threadPattern = /href='https:\/\/bbs\.animanch\.com\/board\/(\d+)\/'[^>]*class='card'[\s\S]*?<div class='card-body'>([\s\S]*?)<p class='threadCount'/g
  const threads: AnimanchThread[] = []
  const seenIds = new Set<number>()
  let m: RegExpExecArray | null

  while ((m = threadPattern.exec(html)) !== null) {
    const boardId = parseInt(m[1], 10)
    if (seenIds.has(boardId)) continue
    seenIds.add(boardId)
    const rawTitle = m[2].replace(/<[^>]*>/g, '').trim()
    if (isDuemaRelated(rawTitle)) {
      threads.push({ boardId, title: rawTitle })
    }
  }
  return threads
}

/** あにまん個別スレからリプライコメントを取得（1件目はスキップ、10〜300字、最大15件） */
async function fetchAnimanchComments(boardId: number): Promise<string[]> {
  const url = `${ANIMANCH_BASE}/board/${boardId}/`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DuemaBBS/1.0)' },
    next: { revalidate: 0 },
  })
  if (!res.ok) return []
  const html = await res.text()

  const commentPattern = /<div class='resbody[^']*'>\s*<p>([\s\S]*?)<\/p>/g
  const comments: string[] = []
  let count = 0
  let m: RegExpExecArray | null

  while ((m = commentPattern.exec(html)) !== null) {
    count++
    if (count === 1) continue
    const raw = m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim()
    if (raw.length >= 10 && raw.length <= 300) comments.push(raw)
    if (comments.length >= 15) break
  }

  return comments
}

/** スレタイトルとあにまんスレ一覧からトピックが最も近いスレを選ぶ */
function findBestMatchingThread(targetTitle: string, candidates: AnimanchThread[]): AnimanchThread | null {
  const words = targetTitle.split(/[\s　、。！？「」【】・\n]+/).filter(w => w.length >= 2)
  let best: AnimanchThread | null = null
  let bestScore = 0
  for (const c of candidates) {
    const score = words.filter(w => c.title.includes(w)).length
    if (score > bestScore) { bestScore = score; best = c }
  }
  return bestScore > 0 ? best : null
}

const AUTHOR_NAMES = [
  '新弾チェッカー', 'レジェンドハンター', 'ツインパクト愛好家',
  '初心者デュエリスト', '魔導具マスター', '速攻志望', 'コンボハンター',
  '殿堂研究家', 'メタ分析好き', 'CS初参加予定', 'カウンター戦略家',
  '相場チェッカー', '先行投資派', 'デュエプレ検討中', '紙プレ両刀',
  'アニメ勢', 'アニメカード収集家', 'デュエパ愛好家', 'ルール探求者',
  '懐古主義者', '歴史研究家', '仲間募集中', 'カード整理したい', 'デュエチューバーファン',
]

function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAnonClient()
  const dayIndex = Math.floor(Date.now() / 86400000)

  const result: {
    commentsAdded: { threadId: number; postNumbers: number[] }[]
    errors: string[]
  } = { commentsAdded: [], errors: [] }

  // あにまんスレ一覧を先に取得（コメント取得のソースとして使う）
  let animanchThreads: AnimanchThread[] = []
  try {
    animanchThreads = await fetchAnimanchDuemaThreads()
    console.log(`Seed: fetched ${animanchThreads.length} duema threads from animanch`)
  } catch (err) {
    console.warn('Seed: animanch fetch failed, will use SEED_COMMENTS as fallback:', err)
    result.errors.push(`animanch: ${err instanceof Error ? err.message : String(err)}`)
  }

  // コメントが止まっているスレを古い順に3件取得
  const { data: oldThreads, error: fetchError } = await supabase
    .from('threads')
    .select('id, title')
    .eq('is_archived', false)
    .order('last_posted_at', { ascending: true })
    .limit(3)

  if (fetchError) {
    console.error('Seed: fetch threads error:', fetchError)
    result.errors.push(`fetch: ${fetchError.message}`)
    return NextResponse.json({ ok: true, ...result })
  }

  if (!oldThreads || oldThreads.length === 0) {
    console.log('Seed: no threads to comment on')
    return NextResponse.json({ ok: true, ...result })
  }

  for (let i = 0; i < oldThreads.length; i++) {
    const thread = oldThreads[i]

    // 最大post_numberを取得
    const { data: maxPost } = await supabase
      .from('posts')
      .select('post_number')
      .eq('thread_id', thread.id)
      .order('post_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    let nextPostNumber = (maxPost?.post_number ?? 0) + 1
    const postNumbers: number[] = []

    // トピックが近いあにまんスレからコメントを取得
    let commentPool: string[] = []
    if (animanchThreads.length > 0) {
      const matched = findBestMatchingThread(thread.title, animanchThreads)
        ?? animanchThreads[(dayIndex + i) % animanchThreads.length]
      try {
        const raw = await fetchAnimanchComments(matched.boardId)
        commentPool = raw.map(transformComment).filter(c => c.length >= 10)
        console.log(`Seed: thread ${thread.id} — matched animanch board ${matched.boardId}, ${commentPool.length} comments`)
      } catch (e) {
        console.warn(`Seed: fetchAnimanchComments failed for board ${matched.boardId}:`, e)
      }
    }

    // コメントを2件挿入
    for (let j = 0; j < 2; j++) {
      const body = commentPool.length > 0
        ? commentPool[(dayIndex + i * 3 + j * 7) % commentPool.length]
        : SEED_COMMENTS[(dayIndex + i * 7 + j) % SEED_COMMENTS.length].body
      const authorName = AUTHOR_NAMES[(dayIndex + i * 5 + j * 3) % AUTHOR_NAMES.length]

      const { error: postError } = await supabase
        .from('posts')
        .insert({ thread_id: thread.id, post_number: nextPostNumber, body, author_name: authorName })

      if (postError) {
        console.error(`Seed: post insert error thread ${thread.id}:`, postError)
        result.errors.push(`post(thread=${thread.id}): ${postError.message}`)
      } else {
        postNumbers.push(nextPostNumber)
        nextPostNumber++
      }
    }

    if (postNumbers.length > 0) {
      result.commentsAdded.push({ threadId: thread.id, postNumbers })
      console.log(`Seed: added ${postNumbers.length} comments to thread ${thread.id}`)
    }
  }

  console.log('Seed complete:', JSON.stringify(result))
  return NextResponse.json({ ok: true, ...result })
}
