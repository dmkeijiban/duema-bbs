import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyNewThread } from '@/lib/discord'
import { SITE_URL } from '@/lib/site-config'

export const runtime = 'nodejs'
export const maxDuration = 60

const ANIMANCH_BASE = 'https://bbs.animanch.com'
const ANIMANCH_CATEGORY = `${ANIMANCH_BASE}/category25/`
const AUTHOR_NAME = '名無しのデュエリスト'
const REQUIRED_COMMENT_COUNT = 5

/**
 * ゴミ文字列パターン（スクレイピング由来のHTML残骸・内部リンクアンカー等）
 * transformComment で除去した後も残っていたら弾く
 */
const GARBAGE_PATTERNS = [
  /#res\d+/i,         // #res190 系
  /#\d+/,             // #190 系（行中どこでも）
  /<[a-zA-Z]/,        // HTML タグ残骸
  /href=/i,           // href 属性残骸
  /class=/i,          // class 属性残骸
  /onclick=/i,        // onclick 残骸
  /data-[a-z]/i,      // data-xxx 属性残骸
]

/** テキストにゴミ文字列が含まれているか判定 */
function hasGarbageStrings(text: string): boolean {
  return GARBAGE_PATTERNS.some(p => p.test(text))
}

/** Discord Webhook に seed 結果を送る（成功・スキップ・エラー共通） */
async function notifySeedResult(content: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) return
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    })
    if (!res.ok) console.error('Discord webhook error:', res.status, await res.text())
  } catch (err) {
    console.error('Discord webhook fetch failed:', err)
  }
}

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
  /** カテゴリ一覧のカードにサムネイル画像が存在するか（拡張判定） */
  hasImage: boolean
  /** 一覧ページで見つかった画像URL（あれば） */
  listImageUrl: string | null
}

interface AnimanchBoardData {
  body: string
  imageUrl: string | null
  comments: string[]
}

/**
 * あにまんの共通画像・ロゴ・デフォルトOGP画像かどうかを判定する
 *
 * 判定基準（いずれかに該当 → true = 共通画像として除外）：
 * - ファイル名が "logo", "ogp", "ogimage", "default", "noimage", "no-image",
 *   "placeholder", "common", "share" を含む
 * - /common/ /assets/ /static/ /logo/ ディレクトリ配下
 * - 拡張子なし or .svg（ロゴはSVGが多い）
 * - ファイル名が数字のみでない（スレ固有画像は通常 /img/数字/数字.ext 形式）
 *   ただしこれ単体では判定しない（副作用大）
 */
function isAnimanchDefaultOgImage(url: string): boolean {
  try {
    const { pathname } = new URL(url)
    const lower = pathname.toLowerCase()

    // ファイル名ベースの判定
    const filename = lower.split('/').pop() ?? ''
    const genericFilenames = /^(logo|ogp|ogimage|og.?image|default|noimage|no.?image|placeholder|common|share|banner|top|index)/
    if (genericFilenames.test(filename)) return true

    // ディレクトリパスの判定
    const genericDirs = /\/(common|assets?|static|logo|logos?|icons?|brand|share)\//
    if (genericDirs.test(lower)) return true

    // .svg はロゴやベクター素材が多いため除外
    if (lower.endsWith('.svg')) return true

    return false
  } catch {
    // URL パース失敗は除外しない（念のため）
    return false
  }
}

/**
 * カードHTML内から画像URLを抽出する（複数パターンに対応）
 * - src / data-src / data-lazy-src / data-original / data-bg 属性
 * - background-image スタイル
 * - 相対URLは https://bbs.animanch.com を補完
 */
function extractImageUrlFromHtml(html: string): string | null {
  // 1. src / data-* 系の属性から画像URLを抽出（絶対URL・相対URL両対応）
  const attrPatterns = [
    /(?:src|data-src|data-lazy-src|data-original|data-bg)=['"]?(https?:\/\/[^'">\s]+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^'">\s]*)?)['"]?/i,
    /(?:src|data-src|data-lazy-src|data-original|data-bg)=['"]?(\/[^'">\s]+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^'">\s]*)?)['"]?/i,
  ]
  for (const pat of attrPatterns) {
    const m = html.match(pat)
    if (m) {
      const url = m[1]
      return url.startsWith('/') ? `${ANIMANCH_BASE}${url}` : url
    }
  }

  // 2. background-image: url(...) スタイル
  const bgMatch = html.match(/background-image\s*:\s*url\(['"]?(https?:\/\/[^'")\s]+\.(?:jpg|jpeg|png|gif|webp)[^'")\s]*)['"]?\)/i)
  if (bgMatch) return bgMatch[1]

  return null
}

/**
 * あにまん category25 からスレ一覧を取得
 * カードに画像サムネイルがあるかどうかも同時に判定する（拡張版）
 * ※ あにまんのHTMLはシングルクォート属性で書かれている
 */
async function fetchAnimanchDuemaThreads(): Promise<AnimanchThread[]> {
  const res = await fetch(ANIMANCH_CATEGORY, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DuemaBBS/1.0)' },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`animanch category fetch failed: ${res.status}`)
  const html = await res.text()

  // href→class順・class→href順のどちらでも捕捉できる2パターン
  const threadPatternHrefFirst = /href='https:\/\/bbs\.animanch\.com\/board\/(\d+)\/'[^>]*class='card'([\s\S]*?)<p class='threadCount'/g
  const threadPatternClassFirst = /class='card'[^>]*href='https:\/\/bbs\.animanch\.com\/board\/(\d+)\/'([\s\S]*?)<p class='threadCount'/g

  const threads: AnimanchThread[] = []
  const seenIds = new Set<number>()

  function processMatch(boardId: number, cardHtml: string) {
    if (seenIds.has(boardId)) return
    seenIds.add(boardId)

    // タイトル抽出
    const titleMatch = cardHtml.match(/<div class='card-body'>([\s\S]*?)(?:<\/div>|$)/)
      ?? cardHtml.match(/<div class='card-body'>([\s\S]*?)$/)
    const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : ''

    // 画像判定（拡張版）:
    // - <img タグがある
    // - data-src / data-lazy-src / data-bg 属性に URL がある
    // - bbs.animanch.com/img/ または animanch.com 配下の画像URL
    // - background-image スタイル
    const listImageUrl = extractImageUrlFromHtml(cardHtml)
    const hasImage = (
      listImageUrl !== null ||
      /<img\b/i.test(cardHtml) ||
      /animanch\.com\/(?:img|upload|cdn|static|media|files?)\//i.test(cardHtml) ||
      /data-(?:src|bg|lazy|original)=['"]?https?:\/\//i.test(cardHtml) ||
      /background-image/i.test(cardHtml)
    )

    if (isDuemaRelated(rawTitle) && !isExcludedTitle(rawTitle)) {
      threads.push({ boardId, title: rawTitle, hasImage, listImageUrl })
    }
  }

  let m: RegExpExecArray | null
  while ((m = threadPatternHrefFirst.exec(html)) !== null) {
    processMatch(parseInt(m[1], 10), m[2])
  }
  while ((m = threadPatternClassFirst.exec(html)) !== null) {
    processMatch(parseInt(m[1], 10), m[2])
  }

  // どちらのパターンも0件なら、boardId抽出だけ行うフォールバック
  if (threads.length === 0) {
    console.warn('[seed/thread] threadPattern matched 0 cards — trying fallback boardId extraction')
    const boardIdPattern = /href='https:\/\/bbs\.animanch\.com\/board\/(\d+)\/'/g
    const allIds: number[] = []
    while ((m = boardIdPattern.exec(html)) !== null) {
      const id = parseInt(m[1], 10)
      if (!allIds.includes(id)) allIds.push(id)
    }
    console.warn(`[seed/thread] fallback found ${allIds.length} unique board IDs in HTML`)
  }

  return threads
}

/**
 * あにまん個別スレから本文・画像URL・コメントを1回のフェッチで取得
 * ※ あにまんのHTMLはシングルクォート属性で書かれている
 */
async function fetchAnimanchBoard(boardId: number): Promise<AnimanchBoardData> {
  const url = `${ANIMANCH_BASE}/board/${boardId}/`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DuemaBBS/1.0)' },
    next: { revalidate: 0 },
  })
  if (!res.ok) return { body: '', imageUrl: null, comments: [] }
  const html = await res.text()

  // --- 本文 ---
  let body = ''
  const bodyMatch = html.match(/<div class='resbody[^']*'>\s*<p>([\s\S]*?)<\/p>/)
  if (bodyMatch) {
    body = bodyMatch[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<a\s[^>]*href=['"]([^'"]+)['"][^>]*>[\s\S]*?<\/a>/gi, (_m, href) => {
        if (href.includes('bbs.animanch.com')) return ''
        return `\n${href}\n`
      })
      .replace(/<[^>]*>/g, '')
      .trim()
    body = decodeHtmlEntities(body)
    body = body.replace(/\n{3,}/g, '\n\n').trim()
  }

  // --- 画像URL（優先度順に取得）---
  let imageUrl: string | null = null

  // 1. og:image メタタグを取得し、共通画像・ロゴ・デフォルトOGPでないか確認
  const ogMatch =
    html.match(/<meta\b[^>]*\bproperty=['"]og:image['"]\s*content=['"]([^'"]+)['"]/i) ??
    html.match(/<meta\b[^>]*\bcontent=['"]([^'"]+)['"]\s*property=['"]og:image['"]/i)
  if (ogMatch) {
    const u = ogMatch[1].startsWith('/') ? `${ANIMANCH_BASE}${ogMatch[1]}` : ogMatch[1]
    if (isAnimanchDefaultOgImage(u)) {
      console.log(`[seed/thread] fetchAnimanchBoard: og:image は共通画像と判定、スキップ: ${u.slice(0, 100)}`)
    } else {
      imageUrl = u
    }
  }

  // 2. img タグや data-* 属性からの拡張抽出（og:image が共通画像だった場合も含む）
  if (!imageUrl) {
    imageUrl = extractImageUrlFromHtml(html)
  }

  // 3. animanch 固有パターン（旧形式 bbs.animanch.com/img/NUM/NUM.ext）
  if (!imageUrl) {
    const legacyMatch = html.match(/['"]?(https?:\/\/bbs\.animanch\.com\/img\/\d+\/\d+\.(?:jpg|jpeg|png|gif|webp))['"]?/i)
    if (legacyMatch) imageUrl = legacyMatch[1]
  }

  // 4. 相対パス画像（/img/ または /uploads/ 等）
  if (!imageUrl) {
    const relMatch = html.match(/['"]?(\/(?:img|upload|cdn|static|media|files?)\/[^'">\s]+\.(?:jpg|jpeg|png|gif|webp))['"]?/i)
    if (relMatch) imageUrl = `${ANIMANCH_BASE}${relMatch[1]}`
  }

  if (imageUrl) {
    console.log(`[seed/thread] fetchAnimanchBoard: image found: ${imageUrl.slice(0, 100)}`)
  } else {
    console.warn(`[seed/thread] fetchAnimanchBoard: no image found for board ${boardId}`)
  }

  // --- コメント（リプライ）: 1件目（本文）をスキップ ---
  const commentPattern = /<div class='resbody[^']*'>\s*<p>([\s\S]*?)<\/p>/g
  const comments: string[] = []
  let count = 0
  let cm: RegExpExecArray | null
  while ((cm = commentPattern.exec(html)) !== null) {
    count++
    if (count === 1) continue // 1件目はスレ本文なのでスキップ
    // 内部アンカー（#res190 等）を内容ごと除去してからタグ除去
    const cleaned = cm[1]
      .replace(/<a\s[^>]*href=['"]#[^'"]*['"][^>]*>[\s\S]*?<\/a>/gi, '') // #res190 アンカー除去
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .trim()
    const raw = decodeHtmlEntities(cleaned)
    const stripped = raw.replace(/>>?\d+/g, '').replace(/#res\d+/gi, '').replace(/#\d+/g, '').trim()
    if (raw.length >= 10 && raw.length <= 300 && stripped.length >= 5) comments.push(raw)
    if (comments.length >= 15) break
  }

  return { body, imageUrl, comments }
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

/**
 * コメントテキストを投稿用に整形
 * ゴミ文字列（レス番号・アンカー残骸）も除去する
 */
function transformComment(text: string): string {
  let t = text
  t = t.replace(/草/g, '笑')
  t = t.replace(/>>?\d+/g, '')       // >>190 形式
  t = t.replace(/#res\d+/gi, '')     // #res190 形式
  t = t.replace(/#\d+/g, '')         // #190 形式
  t = t.replace(/あにまん|animanch/gi, 'ここ')
  t = t.replace(/\n{3,}/g, '\n')
  return t.trim()
}


export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isDryRun = req.nextUrl.searchParams.get('dry_run') === '1'
  const supabase = createAnonClient()
  const serviceSupabase = createServiceClient()

  // 6時間単位のインデックス（1日4回で毎回違うスレを選ぶ）
  const sixHourIndex = Math.floor(Date.now() / 21600000)

  try {
    // 1. あにまん category25 からデュエマスレ一覧を取得
    const animanchThreads = await fetchAnimanchDuemaThreads()
    console.log(`Seed/thread: fetched ${animanchThreads.length} duema threads from animanch`)

    if (animanchThreads.length === 0) {
      await notifySeedResult(
        '🚨 エラー\n' +
        '- 理由: スレが1件も取得できず\n' +
        '- 本日はスキップします',
      )
      return NextResponse.json({ ok: true, skipped: true, reason: 'no_duema_threads' })
    }

    // 2. 直近14日の重複チェック
    const since = new Date(Date.now() - 14 * 86400000).toISOString()
    const { data: recentThreads } = await supabase
      .from('threads')
      .select('title')
      .gte('created_at', since)
    const recentTitles = new Set((recentThreads ?? []).map(t => t.title))

    const candidates = animanchThreads.filter(t => !recentTitles.has(transformTitle(t.title)))

    // 3. 画像ありスレのみを対象（フォールバック禁止）
    const candidatesWithImage = candidates.filter(t => t.hasImage)

    // dry_run=1: 候補情報だけ返して終了
    if (isDryRun) {
      const wouldChoose = candidatesWithImage.length > 0
        ? candidatesWithImage[sixHourIndex % candidatesWithImage.length]
        : null

      // 上位候補の詳細（詳細ページから image_url も取得）
      // would_choose が slice(0,5) に含まれない場合に備えて先頭5件 + would_choose を合わせて fetch する
      const previewPool = candidatesWithImage.slice(0, 5)
      if (wouldChoose && !previewPool.find(t => t.boardId === wouldChoose.boardId)) {
        previewPool.push(wouldChoose)
      }
      const previewCandidates = await Promise.all(
        previewPool.map(async t => {
          let imageUrl = t.listImageUrl
          if (!imageUrl) {
            // 一覧で取れない場合は詳細ページから取得を試みる
            try {
              const detail = await fetchAnimanchBoard(t.boardId)
              imageUrl = detail.imageUrl
            } catch { /* ignore */ }
          }
          return {
            boardId: t.boardId,
            url: `${ANIMANCH_BASE}/board/${t.boardId}/`,
            title: t.title,
            transformed: transformTitle(t.title),
            image_url: imageUrl ?? null,
          }
        }),
      )

      // 画像なしでスキップされる候補のサンプル（最大3件）
      const skippedNoImage = candidates
        .filter(t => !t.hasImage)
        .slice(0, 3)
        .map(t => ({ boardId: t.boardId, title: t.title, skipped_reason: 'no_image_on_list_page' }))

      // would_choose の image_url は previewCandidates から引く（detail fetch 済みのため正確）
      const wouldChoosePreview = previewCandidates.find(p => p.boardId === wouldChoose?.boardId)

      return NextResponse.json({
        dry_run: true,
        total_fetched: animanchThreads.length,
        after_dedup: candidates.length,
        with_image: candidatesWithImage.length,
        skipped_reason: candidatesWithImage.length === 0 ? 'no_image_candidates' : null,
        selected_threads: previewCandidates.slice(0, 5),
        would_choose: wouldChoose
          ? {
            boardId: wouldChoose.boardId,
            url: `${ANIMANCH_BASE}/board/${wouldChoose.boardId}/`,
            title: wouldChoose.title,
            transformed: transformTitle(wouldChoose.title),
            image_url: wouldChoosePreview?.image_url ?? wouldChoose.listImageUrl ?? null,
          }
          : null,
        skipped_no_image_samples: skippedNoImage,
      })
    }

    // 4. 画像ありの候補がなければスキップ（フォールバック禁止）
    if (candidatesWithImage.length === 0) {
      const msg =
        '⏭️ スキップ\n' +
        '- 理由: 画像ありの未掲載スレが存在しない\n' +
        `- 全候補: ${animanchThreads.length}件 / 重複除外後: ${candidates.length}件 / 画像あり: 0件`
      console.log('Seed/thread: skip —', msg)
      await notifySeedResult(msg)
      return NextResponse.json({ ok: true, skipped: true, reason: 'no_image_candidates' })
    }

    // 5. スレ選択
    const chosen = candidatesWithImage[sixHourIndex % candidatesWithImage.length]
    console.log(
      `Seed/thread: chosen board ${chosen.boardId} "${chosen.title}"` +
      ` (pool: ${candidatesWithImage.length} image-candidates)`,
    )

    // 6. 個別スレの詳細取得（本文・画像URL・コメント）
    const detail = await fetchAnimanchBoard(chosen.boardId)

    // 7. コメントを整形・検証（5件必須、ゴミ文字なし）
    const validComments = detail.comments
      .map(transformComment)
      .filter(c => c.length >= 10 && c.length <= 300 && !hasGarbageStrings(c))

    if (validComments.length < REQUIRED_COMMENT_COUNT) {
      const msg =
        `⏭️ スキップ\n` +
        `- 理由: コメント${REQUIRED_COMMENT_COUNT}件取れず（有効: ${validComments.length}件）\n` +
        `- スレ: 「${chosen.title}」`
      console.log('Seed/thread: skip —', msg)
      await notifySeedResult(msg)
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'insufficient_comments',
        validCommentCount: validComments.length,
      })
    }

    // 8. スレ本文構築・ゴミ文字バリデーション
    const title = transformTitle(chosen.title)
    const body = buildThreadBody(title, detail.body)
    const categoryId = detectCategoryId(title, detail.body)

    if (hasGarbageStrings(body)) {
      const msg =
        `⏭️ スキップ\n` +
        `- 理由: 本文にゴミ文字列を検出\n` +
        `- スレ: 「${chosen.title}」`
      console.log('Seed/thread: skip —', msg)
      await notifySeedResult(msg)
      return NextResponse.json({ ok: true, skipped: true, reason: 'garbage_in_body' })
    }

    // 9. 画像URL確認（detail で取れない場合は一覧ページの画像URLで代替）
    const resolvedImageUrl = detail.imageUrl ?? chosen.listImageUrl
    if (!resolvedImageUrl) {
      const msg =
        `⏭️ スキップ\n` +
        `- 理由: 画像URLが一覧・詳細ページいずれからも取得できず\n` +
        `- スレ: 「${chosen.title}」`
      console.log('Seed/thread: skip —', msg)
      await notifySeedResult(msg)
      return NextResponse.json({ ok: true, skipped: true, reason: 'no_image_url_in_detail' })
    }

    // 10. 画像をSupabase Storageにアップロード（失敗したらスキップ）
    const imageUrl = await downloadAndUploadImage(resolvedImageUrl, serviceSupabase)
    if (!imageUrl) {
      const msg =
        `⏭️ スキップ\n` +
        `- 理由: 画像アップロード失敗\n` +
        `- 元URL: ${resolvedImageUrl}\n` +
        `- スレ: 「${chosen.title}」`
      console.log('Seed/thread: skip —', msg)
      await notifySeedResult(msg)
      return NextResponse.json({ ok: true, skipped: true, reason: 'image_upload_failed' })
    }

    // 11. 投稿前バリデーション（最終確認）
    if (!title || !body || !imageUrl || validComments.length < REQUIRED_COMMENT_COUNT) {
      const msg =
        `🚨 投稿前バリデーション失敗\n` +
        `- title: ${title ? 'OK' : 'NG'} / body: ${body ? 'OK' : 'NG'}` +
        ` / image: ${imageUrl ? 'OK' : 'NG'} / comments: ${validComments.length}件\n` +
        `- スレ: 「${chosen.title}」`
      console.error('Seed/thread: pre-insert validation failed —', msg)
      await notifySeedResult(msg)
      return NextResponse.json({ ok: false, error: 'pre_insert_validation_failed' })
    }

    // 12. スレ作成
    const { data: created, error: threadError } = await supabase
      .from('threads')
      .insert({
        title,
        body,
        author_name: AUTHOR_NAME,
        category_id: categoryId,
        image_url: imageUrl,
        source: 'animanch',
        source_id: String(chosen.boardId),
      })
      .select('id, title')
      .single()

    if (threadError || !created) {
      const msg =
        `🚨 スレ作成エラー\n` +
        `- 理由: DB insert 失敗\n` +
        `- 詳細: ${threadError?.message ?? 'unknown'}\n` +
        `- スレ: 「${title}」`
      console.error('Seed/thread insert error:', threadError)
      await notifySeedResult(msg)
      return NextResponse.json({ ok: false, error: threadError?.message ?? 'thread insert failed' })
    }

    console.log(`Seed/thread: created thread ${created.id} "${created.title}"`)

    // 13. コメント5件追加（service role でRLS回避）
    const commentErrors: string[] = []
    for (let i = 0; i < REQUIRED_COMMENT_COUNT; i++) {
      const commentBody = validComments[(sixHourIndex + i * 7) % validComments.length]
      const { error: postError } = await serviceSupabase
        .from('posts')
        .insert({ thread_id: created.id, post_number: i + 1, body: commentBody, author_name: AUTHOR_NAME })
      if (postError) {
        console.error(`Seed/thread: post[${i + 1}] insert failed:`, postError.message)
        commentErrors.push(`post[${i + 1}]: ${postError.message}`)
      }
    }

    // 14. 投稿後検証（DB から再取得してコメント数・ゴミ文字を確認）
    const { data: verifyPosts } = await serviceSupabase
      .from('posts')
      .select('id, body')
      .eq('thread_id', created.id)
      .order('post_number')

    const actualCount = verifyPosts?.length ?? 0
    const garbageInPosts = verifyPosts?.some(p => hasGarbageStrings(p.body)) ?? false
    const threadUrl = `${SITE_URL}/thread/${created.id}`

    if (actualCount < REQUIRED_COMMENT_COUNT || garbageInPosts) {
      const msg =
        `🚨 投稿後検証失敗\n` +
        `- スレID: ${created.id}\n` +
        `- コメント数: 期待 ${REQUIRED_COMMENT_COUNT}件 / 実際 ${actualCount}件\n` +
        `- ゴミ文字: ${garbageInPosts ? 'あり ⚠️' : 'なし'}\n` +
        `- URL: ${threadUrl}`
      console.error('Seed/thread: post-verification failed —', msg)
      await notifySeedResult(msg)
      return NextResponse.json({
        ok: false,
        threadCreated: { id: created.id, title: created.title },
        verificationFailed: true,
        actualCommentCount: actualCount,
        garbageDetected: garbageInPosts,
        errors: commentErrors,
      })
    }

    // 15. 成功通知
    const { data: cat } = await supabase.from('categories').select('name').eq('id', categoryId).single()
    const successMsg =
      `✅ スレ作成成功\n` +
      `- スレID: ${created.id}\n` +
      `- タイトル: ${created.title}\n` +
      `- カテゴリ: ${cat?.name ?? `ID ${categoryId}`}\n` +
      `- 画像: あり\n` +
      `- コメント: ${actualCount}件\n` +
      `- URL: ${threadUrl}`

    console.log('Seed/thread complete:', successMsg)
    await notifySeedResult(successMsg)
    notifyNewThread({ threadId: created.id, title: created.title, categoryName: cat?.name ?? null }).catch(() => {})

    return NextResponse.json({
      ok: true,
      threadCreated: { id: created.id, title: created.title },
      source: `animanch board ${chosen.boardId}`,
      commentCount: actualCount,
      errors: commentErrors,
    })

  } catch (err) {
    const msg =
      `🚨 予期せぬエラー\n` +
      `- 詳細: ${err instanceof Error ? err.message : String(err)}`
    console.error('Seed/thread: unexpected error:', err)
    await notifySeedResult(msg)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
