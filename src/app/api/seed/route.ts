import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SEED_COMMENTS, SEED_THREADS } from '@/lib/seed-data'

export const runtime = 'nodejs'
export const maxDuration = 60

// ==========================================
// あにまん掲示板から参考スレ・コメントを取得するロジック
// ==========================================

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

/** タイトルの変換（コピーではなく参考に） */
function transformTitle(original: string): string {
  let t = original
  t = t.replace(/\s*(その|Part|PART|part|第)\s*\d+\s*(スレ?目?|弾)?/g, '')
  t = t.replace(/\s*【?\d+スレ?目?】?/g, '')
  t = t.replace(/スレ$/, '')
  t = t.replace(/草/g, '笑')
  t = t.replace(/感想(スレ?|板)?/, 'どうだった？')
  t = t.replace(/語る(スレ?|板)?$/, '語ろう')
  t = t.replace(/雑談(スレ?|板)?$/, '雑談しよう')
  t = t.replace(/[！!]{2,}/g, '！')
  t = t.replace(/[？?]{2,}/g, '？')
  t = t.trim()
  return t || original
}

/** コメントを自然なものに軽く変換 */
function transformComment(text: string): string {
  let t = text
  t = t.replace(/草/g, '笑')
  // >>引用アンカーを除去
  t = t.replace(/>>?\d+/g, '')
  // 他サイト言及を中和
  t = t.replace(/あにまん|animanch/gi, 'ここ')
  // 連続改行を整理
  t = t.replace(/\n{3,}/g, '\n')
  return t.trim()
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

/** 本文を自然な掲示板投稿に整形 */
function buildThreadBody(title: string, rawBody: string): string {
  let body = rawBody.replace(/<[^>]*>/g, '').trim()
  body = body.replace(/\n{3,}/g, '\n\n')
  if (body.length >= 100) {
    if (!/[?？]$/.test(body.trim())) {
      body = `${body}\n\nみなさんはどう思いますか？`
    }
    return body
  }
  return `${title}について話しましょう！\n\n${body ? body + '\n\n' : ''}気になる方はぜひ意見を聞かせてください。`
}

interface AnimanchThread {
  boardId: number
  title: string
}

interface AnimanchThreadDetail {
  body: string
  imageUrl: string | null
}

/**
 * あにまん category25 からスレ一覧を取得
 * ※ あにまんのHTMLはシングルクォート属性
 */
async function fetchAnimanchDuemaThreads(): Promise<AnimanchThread[]> {
  const res = await fetch(ANIMANCH_CATEGORY, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DuemaBBS/1.0)' },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`animanch category fetch failed: ${res.status}`)
  const html = await res.text()

  // HTMLはシングルクォート: <a href='https://bbs.animanch.com/board/ID/' class='card'>
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

/**
 * あにまん個別スレから本文・画像URLを取得
 * ※ あにまんのHTMLはシングルクォート属性
 */
async function fetchAnimanchFirstPost(boardId: number): Promise<AnimanchThreadDetail> {
  const url = `${ANIMANCH_BASE}/board/${boardId}/`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DuemaBBS/1.0)' },
    next: { revalidate: 0 },
  })
  if (!res.ok) return { body: '', imageUrl: null }
  const html = await res.text()

  // 本文: <div class='resbody ...'><p>本文</p>
  let body = ''
  const bodyMatch = html.match(/<div class='resbody[^']*'>\s*<p>([\s\S]*?)<\/p>/)
  if (bodyMatch) {
    body = bodyMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim()
  }

  // 画像URL: href='https://bbs.animanch.com/img/BOARDID/1'
  let imageUrl: string | null = null
  const imgMatch = html.match(/href='(https:\/\/bbs\.animanch\.com\/img\/\d+\/1)'/)
  if (imgMatch) {
    imageUrl = imgMatch[1]
  }

  return { body, imageUrl }
}

/**
 * あにまん個別スレからリプライコメントを取得（1件目のスレ本文はスキップ）
 * 10〜300文字のコメントを最大15件返す
 */
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
    if (count === 1) continue // 1件目はスレ本文なのでスキップ
    const raw = m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim()
    if (raw.length >= 10 && raw.length <= 300) {
      comments.push(raw)
    }
    if (comments.length >= 15) break
  }

  return comments
}

// ==========================================
// 投稿者名リスト（seed-data.ts と同じものを使う）
// ==========================================

const THREAD_AUTHOR_NAMES = [
  '新弾チェッカー', 'レジェンドハンター', 'ツインパクト愛好家',
  '初心者デュエリスト', '魔導具マスター', '速攻志望', 'コンボハンター',
  '殿堂研究家', 'メタ分析好き', 'CS初参加予定', 'カウンター戦略家',
  '相場チェッカー', '先行投資派', 'デュエプレ検討中', '紙プレ両刀',
  'アニメ勢', 'アニメカード収集家', 'デュエパ愛好家', 'ルール探求者',
  '懐古主義者', '歴史研究家', '仲間募集中', 'カード整理したい', 'デュエチューバーファン',
]

// ==========================================
// Supabase クライアント
// ==========================================

function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// ==========================================
// エンドポイント
// ==========================================

export async function GET(req: NextRequest) {
  // CRON_SECRET による認証
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAnonClient()

  // 日付ベースのインデックス（毎日異なるコンテンツを使用）
  const dayIndex = Math.floor(Date.now() / 86400000)

  const results: {
    threadCreated?: { id: number; title: string }
    commentsAdded: { threadId: number; postNumber: number }[]
    errors: string[]
    source?: string
  } = {
    commentsAdded: [],
    errors: [],
  }

  // === 1. あにまんからスレを取得して新スレを1件作成 ===
  let newThread: { id: number; title: string } | null = null
  // section 2 のコメント取得でも使うためスコープを外に出す
  let animanchThreadsForComments: AnimanchThread[] = []

  try {
    // あにまん掲示板からデュエマ関連スレを取得
    const animanchThreads = await fetchAnimanchDuemaThreads()
    animanchThreadsForComments = animanchThreads
    console.log(`Seed: fetched ${animanchThreads.length} duema threads from animanch`)

    if (animanchThreads.length === 0) {
      throw new Error('No duema threads found on animanch')
    }

    // dayIndex でローテーション選択
    const chosen = animanchThreads[dayIndex % animanchThreads.length]
    console.log(`Seed: chosen animanch board ${chosen.boardId} "${chosen.title}"`)

    // 個別スレから本文・画像を取得
    const detail = await fetchAnimanchFirstPost(chosen.boardId)
    console.log(`Seed: got detail, imageUrl=${detail.imageUrl}`)

    // タイトル・本文・カテゴリを変換
    const title = transformTitle(chosen.title)
    const body = buildThreadBody(title, detail.body)
    const categoryId = detectCategoryId(title, detail.body)
    const authorName = THREAD_AUTHOR_NAMES[dayIndex % THREAD_AUTHOR_NAMES.length]

    const { data: createdThread, error: threadError } = await supabase
      .from('threads')
      .insert({
        title,
        body,
        author_name: authorName,
        category_id: categoryId,
        image_url: detail.imageUrl,
      })
      .select('id, title')
      .single()

    if (threadError || !createdThread) {
      console.error('Seed thread insert error:', threadError)
      results.errors.push(`thread: ${threadError?.message ?? 'unknown'}`)
    } else {
      newThread = createdThread
      results.threadCreated = { id: createdThread.id, title: createdThread.title }
      results.source = `animanch board ${chosen.boardId}`
      console.log(`Seed: created thread ${createdThread.id} "${createdThread.title}" from animanch`)
    }
  } catch (err) {
    // あにまん取得失敗時はフォールバック（SEED_THREADS を使用）
    console.error('Seed: animanch fetch failed, falling back to seed-data:', err)
    results.errors.push(`animanch: ${err instanceof Error ? err.message : String(err)}`)

    const threadTemplate = SEED_THREADS[dayIndex % SEED_THREADS.length]
    const { data: createdThread, error: threadError } = await supabase
      .from('threads')
      .insert({
        title: threadTemplate.title,
        body: threadTemplate.body,
        author_name: threadTemplate.author_name,
        category_id: threadTemplate.category_id,
      })
      .select('id, title')
      .single()

    if (threadError || !createdThread) {
      console.error('Seed fallback thread insert error:', threadError)
      results.errors.push(`thread_fallback: ${threadError?.message ?? 'unknown'}`)
    } else {
      newThread = createdThread
      results.threadCreated = { id: createdThread.id, title: createdThread.title }
      results.source = 'fallback seed-data'
      console.log(`Seed: created fallback thread ${createdThread.id} "${createdThread.title}"`)
    }
  }

  // === 2. 既存スレッドにコメントを追加（最大3件） ===
  // 最後に書き込まれた時刻が古い順で取得（コメントが止まってるスレッドを優先）
  const { data: oldThreads, error: fetchError } = await supabase
    .from('threads')
    .select('id, title, post_count')
    .eq('is_archived', false)
    .order('last_posted_at', { ascending: true })
    .limit(10)

  if (fetchError) {
    console.error('Seed: fetch threads error:', fetchError)
    results.errors.push(`fetch: ${fetchError.message}`)
  } else if (oldThreads && oldThreads.length > 0) {
    // 上位3件にコメントを追加
    const targets = oldThreads.slice(0, 3)

    for (let i = 0; i < targets.length; i++) {
      const thread = targets[i]

      // 新しく作ったスレッドには重複でコメントしない（作成直後に書くのは不自然）
      if (newThread && thread.id === newThread.id) continue

      // 既存の最大post_numberを取得
      const { data: maxPost } = await supabase
        .from('posts')
        .select('post_number')
        .eq('thread_id', thread.id)
        .order('post_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      const nextPostNumber = (maxPost?.post_number ?? 0) + 1

      // あにまんの実際のコメントを取得してそのまま投稿
      // スレごとに別のあにまんスレからコメントを拾う（i + 1 でずらしてスレ本文とは別のスレを参照）
      let commentBody: string | null = null
      if (animanchThreadsForComments.length > 0) {
        const srcIdx = (dayIndex + i + 1) % animanchThreadsForComments.length
        const srcBoardId = animanchThreadsForComments[srcIdx].boardId
        try {
          const rawComments = await fetchAnimanchComments(srcBoardId)
          const validComments = rawComments.map(transformComment).filter(c => c.length >= 10)
          if (validComments.length > 0) {
            commentBody = validComments[(dayIndex + i * 3) % validComments.length]
            console.log(`Seed: got ${validComments.length} comments from animanch board ${srcBoardId}`)
          }
        } catch (e) {
          console.warn(`Seed: fetchAnimanchComments failed for board ${srcBoardId}:`, e)
        }
      }

      // あにまんから取得できなかった場合のみ SEED_COMMENTS にフォールバック
      if (!commentBody) {
        const fallback = SEED_COMMENTS[(dayIndex + i * 7) % SEED_COMMENTS.length]
        commentBody = fallback.body
        console.log(`Seed: using fallback comment for thread ${thread.id}`)
      }

      const authorName = THREAD_AUTHOR_NAMES[(dayIndex + i * 5) % THREAD_AUTHOR_NAMES.length]

      const { error: postError } = await supabase
        .from('posts')
        .insert({
          thread_id: thread.id,
          post_number: nextPostNumber,
          body: commentBody,
          author_name: authorName,
        })

      if (postError) {
        console.error(`Seed: post insert error for thread ${thread.id}:`, postError)
        results.errors.push(`post(thread=${thread.id}): ${postError.message}`)
      } else {
        results.commentsAdded.push({ threadId: thread.id, postNumber: nextPostNumber })
        console.log(`Seed: added comment to thread ${thread.id} (post #${nextPostNumber})`)
      }
    }
  }

  console.log('Seed complete:', JSON.stringify(results))
  return NextResponse.json({ ok: true, ...results })
}
