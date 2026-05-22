import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SEED_THREADS, SEED_COMMENTS } from '@/lib/seed-data'
import { notifyNewThread } from '@/lib/discord'

export const runtime = 'nodejs'
export const maxDuration = 60

const ANIMANCH_BASE = 'https://bbs.animanch.com'
const ANIMANCH_CATEGORY = `${ANIMANCH_BASE}/category25/`
const AUTHOR_NAME = '名無しのデュエリスト'

/** HTMLエンティティをデコード（&amp; &gt; &#数字; etc.） */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

/** デュエマ関連キーワード判定（デュエマ固有ワードのみ。汎用語は除外） */
function isDuemaRelated(title: string): boolean {
  const keywords = [
    'デュエマ', 'デュエルマスターズ', 'デュエプレ',
    'デュエパ', '踏み倒し', 'マナゾーン', 'ツインパクト',
    'ボルバル', 'ガイアール', 'ジャスティス', 'ゼニス',
    'ドラグナー', 'アビス', 'Dマスターズ',
  ]
  return keywords.some(kw => title.includes(kw))
}

/** 除外すべきタイトル判定（あにまん固有・掲示板サイト名など） */
function isExcludedTitle(title: string): boolean {
  const excludeWords = [
    'あにまん', 'animanch', 'アニマン',
    '掲示板', '2ch', '5ch', 'まとめ', 'まとめサイト',
  ]
  const lower = title.toLowerCase()
  return excludeWords.some(w => lower.includes(w.toLowerCase()))
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
  let body = decodeHtmlEntities(rawBody.replace(/<[^>]*>/g, '').trim())
  body = body.replace(/\n{3,}/g, '\n\n')
  if (body.length > 0) {
    return body
  }
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

/**
 * あにまん category25 からスレ一覧を取得
 * ※ あにまんのHTMLはシングルクォート属性で書かれている
 */
async function fetchAnimanchDuemaThreads(): Promise<AnimanchThread[]> {
  const res = await fetch(ANIMANCH_CATEGORY, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DuemaBBS/1.0)' },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`animanch category fetch failed: ${res.status}`)
  const html = await res.text()

  // HTMLはシングルクォート: <a href='https://bbs.animanch.com/board/ID/' class='card'>
  //   <div class='d-flex'><img ...><div class='card-body'>タイトル<p class='threadCount'>N</p>
  const threadPattern = /href='https:\/\/bbs\.animanch\.com\/board\/(\d+)\/'[^>]*class='card'[\s\S]*?<div class='card-body'>([\s\S]*?)<p class='threadCount'/g

  const threads: AnimanchThread[] = []
  const seenIds = new Set<number>()
  let m: RegExpExecArray | null

  while ((m = threadPattern.exec(html)) !== null) {
    const boardId = parseInt(m[1], 10)
    if (seenIds.has(boardId)) continue
    seenIds.add(boardId)
    const rawTitle = m[2].trim()
    if (isDuemaRelated(rawTitle) && !isExcludedTitle(rawTitle)) {
      threads.push({ boardId, title: rawTitle })
    }
  }

  return threads
}

/**
 * あにまん個別スレから本文・画像URLを取得
 * ※ あにまんのHTMLはシングルクォート属性で書かれている
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
    body = bodyMatch[1]
      .replace(/<br\s*\/?>/gi, '\n')
      // 外部リンク（あにまん以外）はURLとして保持、内部リンク（返信・画像ビューア）は除去
      .replace(/<a\s[^>]*href=['"]([^'"]+)['"][^>]*>[\s\S]*?<\/a>/gi, (_m, href) => {
        if (href.includes('bbs.animanch.com')) return ''
        return `\n${href}\n`
      })
      .replace(/<[^>]*>/g, '')
      .trim()
    body = decodeHtmlEntities(body)
    body = body.replace(/\n{3,}/g, '\n\n').trim()
  }

  // 直接画像URL: <img src='https://bbs.animanch.com/img/BOARDID/N.ext'>
  // href='/img/BOARDID/1' はビューアページ（HTML）なので src= を使う
  // シングル・ダブルクォート両対応、data-src（遅延ロード）にも対応
  let imageUrl: string | null = null
  const imgMatch = html.match(/(?:src|data-src)=['"]?(https:\/\/bbs\.animanch\.com\/img\/\d+\/\d+\.(?:jpg|jpeg|png|gif|webp))['"]?/)
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

/** Storage操作にはservice role keyが必要（anonキーはRLSで弾かれる） */
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

type SupabaseClient = ReturnType<typeof createAnonClient>

/**
 * あにまん画像をダウンロードしてSupabase Storageに保存
 * ホットリンク（proxy経由配信）ではなく自前ストレージに持つ
 */
async function downloadAndUploadImage(imageUrl: string, supabase: SupabaseClient): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: {
        Referer: 'https://bbs.animanch.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    if (!res.ok) {
      console.warn(`downloadAndUploadImage: fetch failed ${res.status} for ${imageUrl}`)
      return null
    }
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      console.warn(`downloadAndUploadImage: non-image content-type "${contentType}" for ${imageUrl}`)
      return null
    }
    const buffer = await res.arrayBuffer()
    const ext = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : contentType.includes('webp') ? 'webp' : 'jpg'
    const filename = `seeds/${Date.now()}.${ext}`

    const { data, error } = await supabase.storage
      .from('bbs-images')
      .upload(filename, buffer, { contentType, upsert: false })

    if (error) {
      console.warn('downloadAndUploadImage: storage upload failed:', error.message)
      return null
    }

    const { data: { publicUrl } } = supabase.storage.from('bbs-images').getPublicUrl(data.path)
    console.log(`downloadAndUploadImage: uploaded to ${publicUrl}`)
    return publicUrl
  } catch (err) {
    console.warn('downloadAndUploadImage: error:', err)
    return null
  }
}

function transformComment(text: string): string {
  let t = text
  t = t.replace(/草/g, '笑')
  t = t.replace(/>>?\d+/g, '')
  t = t.replace(/あにまん|animanch/gi, 'ここ')
  t = t.replace(/\n{3,}/g, '\n')
  return t.trim()
}

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
    const raw = decodeHtmlEntities(m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim())
    // アンカー参照（>>15 等）だけのコメントは保存しない
    const stripped = raw.replace(/>>?\d+/g, '').trim()
    if (raw.length >= 10 && raw.length <= 300 && stripped.length >= 5) comments.push(raw)
    if (comments.length >= 15) break
  }
  return comments
}


export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAnonClient()
  const serviceSupabase = createServiceClient()

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

    // 直近14日間に作成されたスレタイトルを取得（重複防止）
    const since = new Date(Date.now() - 14 * 86400000).toISOString()
    const { data: recentThreads } = await supabase
      .from('threads')
      .select('title')
      .gte('created_at', since)
    const recentTitles = new Set((recentThreads ?? []).map(t => t.title))

    // 重複しないスレをフィルタ
    const candidates = animanchThreads.filter(t => {
      const transformed = transformTitle(t.title)
      return !recentTitles.has(transformed)
    })

    console.log(`Seed/thread: ${candidates.length} candidates after dedup filter`)

    const pool = candidates.length > 0 ? candidates : animanchThreads
    const chosen = pool[sixHourIndex % pool.length]
    console.log(`Seed/thread: chosen animanch board ${chosen.boardId} "${chosen.title}"`)

    const detail = await fetchAnimanchFirstPost(chosen.boardId)

    const title = transformTitle(chosen.title)
    const body = buildThreadBody(title, detail.body)
    const categoryId = detectCategoryId(title, detail.body)

    // 画像はSupabase Storageにダウンロード保存（service role keyでRLS回避）
    const imageUrl = detail.imageUrl
      ? await downloadAndUploadImage(detail.imageUrl, serviceSupabase)
      : null

    const { data: created, error: threadError } = await supabase
      .from('threads')
      .insert({
        title,
        body,
        author_name: AUTHOR_NAME,
        category_id: categoryId,
        image_url: imageUrl,
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
      const { data: cat } = await supabase.from('categories').select('name').eq('id', categoryId).single()
      notifyNewThread({ threadId: created.id, title: created.title, categoryName: cat?.name ?? null }).catch(() => {})

      // 同じあにまんスレのリプライから初期コメント3件追加
      try {
        const rawComments = await fetchAnimanchComments(chosen.boardId)
        const validComments = rawComments.map(transformComment).filter(c => c.length >= 10)
        const pool = validComments.length >= 5 ? validComments : SEED_COMMENTS.map(c => c.body)
        for (let i = 0; i < 5; i++) {
          const body = pool[(sixHourIndex + i * 7) % pool.length]
          await supabase.from('posts').insert({ thread_id: created.id, post_number: i + 1, body, author_name: null })
        }
        console.log(`Seed/thread: added 5 comments to ${created.id}`)
      } catch (commentErr) {
        console.warn('Seed/thread: initial comments failed:', commentErr)
      }
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
      const { data: cat } = await supabase.from('categories').select('name').eq('id', template.category_id).single()
      notifyNewThread({ threadId: created.id, title: created.title, categoryName: cat?.name ?? null }).catch(() => {})

      // SEED_COMMENTSから初期コメント5件追加
      for (let i = 0; i < 5; i++) {
        const seed = SEED_COMMENTS[(sixHourIndex + i * 7) % SEED_COMMENTS.length]
        await supabase.from('posts').insert({ thread_id: created.id, post_number: i + 1, body: seed.body, author_name: null })
      }
      console.log(`Seed/thread: added 5 comments (fallback) to ${created.id}`)
    }
  }

  console.log('Seed/thread complete:', JSON.stringify(result))
  return NextResponse.json({ ok: true, ...result })
}
