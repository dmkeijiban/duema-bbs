import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyNewThread } from '@/lib/discord'

export const runtime = 'nodejs'
export const maxDuration = 300

const ANIMANCH_CATEGORY = 'https://bbs.animanch.com/category25/'
const ANIMANCH_ARCHIVE = 'https://bbs.animanch.com/kakolog25/'
const ANIMANCH_BASE = 'https://bbs.animanch.com'
const FIRECRAWL_ENDPOINT = 'https://api.firecrawl.dev/v2/scrape'
const AUTHOR_NAME = '名無しのデュエリスト'
const COMMENT_AUTHOR_POOL = [
  '名無しのデュエリスト',
  'デュエリスト',
  '匿名',
  'デュエマ好き',
  '通りすがり',
]
const MIN_SCORE_TO_POST = 18
const MIN_ARCHIVE_SCORE_TO_POST = 22

const BANNED_TITLE_RE = /閲覧注意|R-?18|シコ|彼氏概念|CP概念|夢|洗脳|闇堕ち|爆乳|ハーレム|SS|エロ|劣情/
const OTHER_TCG_RE = /遊戯王|MTG|ヴァンガード|バトスピ|ラッシュ|シャドバ|シャドビヨ|デュエルリンクス|マスターデュエル|OCG|TCGアニメ/
const DUEMA_RE = /デュエマ|デュエル・?マスターズ|デュエプレ|デュエパ|ボルシャック|ジャガイスト|アビス|ミロク|轟轟轟|アーマード|メクレイド|シールド|トリガー|殿堂|革命チェンジ|マナ|文明|ドラゴン娘|カリスマ|逆札|王道/

const OFFICIAL_CARD_IMAGES: Record<string, { imageUrl: string; cardUrl: string }> = {
  '邪幽 ジャガイスト': {
    imageUrl: 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm23ex1-004.jpg',
    cardUrl: 'https://dm.takaratomy.co.jp/card/detail/?id=dm23ex1-004',
  },
}

interface AnimanchCandidate {
  boardId: number
  title: string
  count: number
  href: string
}

interface SourceThread extends AnimanchCandidate {
  body: string
  comments: string[]
  sourceKind: 'current' | 'archive'
}

interface GeneratedThread {
  title: string
  body: string
  comments: string[]
  categorySlug: string
  cardName?: string
}

interface QualityScore {
  total: number
  reasons: string[]
}

function createSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function normalizeText(value: string) {
  return value.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()
}

async function scrapeMarkdown(url: string) {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) return null

  const res = await fetch(FIRECRAWL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    // onlyMainContent を外してスレッド一覧全体を取得する
    body: JSON.stringify({ url, formats: ['markdown'] }),
  })
  if (!res.ok) throw new Error(`Firecrawl failed ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = await res.json()
  return String(json?.data?.markdown || json?.markdown || '')
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`fetch failed ${res.status}`)
  return res.text()
}

async function fetchSource(url: string) {
  try {
    const markdown = await scrapeMarkdown(url)
    if (markdown?.trim()) return { kind: 'markdown' as const, text: markdown }
  } catch (error) {
    console.warn('Firecrawl scrape failed:', error)
  }

  const html = await fetchHtml(url)
  return { kind: 'html' as const, text: html }
}

function parseCategory(source: { kind: 'markdown' | 'html'; text: string }): AnimanchCandidate[] {
  if (source.kind === 'html') {
    const candidates: AnimanchCandidate[] = []
    const seen = new Set<number>()
    const linkPattern = /href=['"]https:\/\/bbs\.animanch\.com\/board\/(\d+)\/['"][\s\S]{0,500}?<div class=['"]card-body['"]>([\s\S]*?)<p class=['"]threadCount['"]>(\d+)/g
    let match: RegExpExecArray | null
    while ((match = linkPattern.exec(source.text)) !== null) {
      const boardId = Number(match[1])
      if (!boardId || seen.has(boardId)) continue
      seen.add(boardId)
      candidates.push({
        boardId,
        title: stripHtml(match[2]),
        count: Number(match[3]) || 0,
        href: `${ANIMANCH_BASE}/board/${boardId}/`,
      })
    }
    return candidates
  }

  const candidates: AnimanchCandidate[] = []
  const seen = new Set<number>()

  // Firecrawl は「画像リンク」形式で出力する: [![](thumb_url)\n\nTitle\n\nCount](board_url)
  // [\s\S]*? で改行を跨いでキャプチャし、末尾の数字をカウントとして取り出す
  const imageBlockPattern = /\[!\[\]\([^)]+\)([\s\S]*?)\]\(https:\/\/bbs\.animanch\.com\/board\/(\d+)\/?\)/g
  let match: RegExpExecArray | null
  while ((match = imageBlockPattern.exec(source.text)) !== null) {
    const inner = match[1]
    const boardId = Number(match[2])
    if (!boardId || seen.has(boardId)) continue

    // "\\\n\\\nTitle\\\n\\\nCount" → 改行と末尾バックスラッシュを除去してパース
    const lines = inner.split(/\n/).map(l => l.replace(/\\$/, '').trim()).filter(Boolean)
    const lastLine = lines[lines.length - 1]
    const countNum = lastLine && /^\d+$/.test(lastLine) ? Number(lastLine) : 0
    const titleLines = countNum > 0 ? lines.slice(0, -1) : lines
    const title = titleLines.join('').trim()
    if (!title) continue

    seen.add(boardId)
    candidates.push({ boardId, title, count: countNum, href: `${ANIMANCH_BASE}/board/${boardId}/` })
  }

  // フォールバック: プレーンテキストリンク形式 [Title](board_url)
  const mdLinkPattern = /\[([^\]]+)\]\(https:\/\/bbs\.animanch\.com\/board\/(\d+)\/?\)/g
  while ((match = mdLinkPattern.exec(source.text)) !== null) {
    const title = match[1].replace(/\s+\d+$/, '').trim()
    const boardId = Number(match[2])
    if (!title || !boardId || seen.has(boardId)) continue
    seen.add(boardId)
    candidates.push({ boardId, title, count: 0, href: `${ANIMANCH_BASE}/board/${boardId}/` })
  }

  return candidates
}

function parseThreadDetail(boardId: number, source: { kind: 'markdown' | 'html'; text: string }) {
  if (source.kind === 'html') {
    const bodies = [...source.text.matchAll(/<div class=['"]resbody[^'"]*['"]>\s*<p>([\s\S]*?)<\/p>/g)]
      .map(match => normalizeText(stripHtml(match[1])))
      .filter(Boolean)
    return {
      body: bodies[0] ?? '',
      comments: bodies.slice(1).filter(text => text.length >= 8 && text.length <= 320).slice(0, 20),
    }
  }

  const lines = source.text.split('\n').map(line => line.trim()).filter(Boolean)
  const bodyStart = lines.findIndex(line => /匿名さん|二次元好き/.test(line))
  const useful = lines
    .slice(bodyStart >= 0 ? bodyStart + 1 : 0)
    .filter(line => !/^TOP|^レス投稿|^オススメ|^スレッドは/.test(line))
  return {
    body: useful[0] ?? '',
    comments: useful.slice(1).filter(text => text.length >= 8 && text.length <= 320).slice(0, 20),
  }
}

function isLikelyDuema(candidate: AnimanchCandidate, detail?: { body?: string; comments?: string[] }) {
  const text = `${candidate.title}\n${detail?.body ?? ''}\n${detail?.comments?.slice(0, 3).join('\n') ?? ''}`
  if (BANNED_TITLE_RE.test(text)) return false
  if (OTHER_TCG_RE.test(text) && !DUEMA_RE.test(text)) return false
  return DUEMA_RE.test(text)
}

function sourceScore(candidate: AnimanchCandidate, detail: { body: string; comments: string[] }) {
  const text = `${candidate.title}\n${detail.body}\n${detail.comments.join('\n')}`
  let score = 0
  const reasons: string[] = []
  if (DUEMA_RE.test(text)) { score += 5; reasons.push('duema-context') }
  if (/ジャガイスト|ボルシャック|ミロク|轟轟轟|アビス|カリスマ|トランキー/.test(text)) { score += 5; reasons.push('specific-card') }
  if (/強い|弱い|高騰|殿堂|環境|刺さる|微妙|返して|買って|予約|集中|狙い/.test(text)) { score += 4; reasons.push('reply-hook') }
  if (candidate.count >= 10) { score += 3; reasons.push('has-replies') }
  if (detail.comments.length >= 5) { score += 3; reasons.push('enough-comments') }
  if (BANNED_TITLE_RE.test(text)) { score -= 99; reasons.push('banned') }
  if (OTHER_TCG_RE.test(text) && !DUEMA_RE.test(text)) { score -= 20; reasons.push('other-tcg') }
  return { score, reasons }
}

function detectOfficialCard(text: string) {
  for (const [name, data] of Object.entries(OFFICIAL_CARD_IMAGES)) {
    const compact = name.replace(/\s+/g, '')
    if (text.includes(name) || text.includes(compact) || text.includes(name.split(/\s+/).at(-1) ?? name)) {
      return { name, ...data }
    }
  }
  return null
}

function styleComment(comment: string, index: number) {
  let text = normalizeText(comment)
    .replace(/>>?\d+/g, '')
    .replace(/。$/g, '')
    .trim()
  if (index % 3 === 1 && !/[。！？!?]$/.test(text)) text += '。'
  if (index % 3 === 2) text = text.replace(/だと思う$/, 'だと思うんよな')
  return text
}

function templateGenerate(source: SourceThread): GeneratedThread {
  const text = `${source.title}\n${source.body}\n${source.comments.join('\n')}`
  const card = detectOfficialCard(text)

  if (/ジャガイスト/.test(text)) {
    return {
      title: 'ジャガイストって5コスト9000ブロッカーなの今見ても変じゃない？',
      body: [
        'ジャガイスト、改めて見ると5コスト9000ブロッカーなの地味におかしくない？',
        '',
        '出た時に手札2枚捨ててアビス・メクレイド5',
        '山札からクリーチャーが出たら墓地からアビスを出せる',
        'しかも本人が9000ブロッカー',
        '',
        '全盛期の黒緑アビスって、テレスコ・ジャガイスト・デスロードあたりが並ぶだけで盤面が分厚すぎた印象ある',
        '',
        '当時触ってた人、実際こいつの「ブロッカー9000」が一番きつかった？',
        'それとも手札と盤面差が広がる方がしんどかった？',
      ].join('\n'),
      comments: [
        '闇の5コス9000ブロッカーって文字だけ見ると昔なら絶対デメリット持ちだと思うやつ',
        'ジャガイスト単体より、横にテレスコいる時の突破不能感がきつかった記憶ある。',
        'こいつを処理するための札を探したいのに先に手札削られてるのが一番嫌だった',
        'アビスって受け薄そうに見えて盤面サイズで止めてくるのずるい',
        '今返ってきたら悪さするかは置いといて、当時の黒緑アビスの象徴感はかなりある。',
      ],
      categorySlug: 'new-cards',
      cardName: card?.name,
    }
  }

  if (/デュエパ|集中狙い/.test(text)) {
    return {
      title: 'デュエパで「弱めに組んだのに集中攻撃される」時ってどうすればいい？',
      body: [
        'デュエパで毎回なぜか真っ先に狙われる時って、デッキの問題なのか立ち回りの問題なのか分からなくなる',
        '',
        '強いカードを抜く',
        'メタを減らす',
        '受け寄せにする',
        'コンボも控えめにする',
        '',
        'ここまでやっても「危なそうだから」「後で面倒そうだから」で殴られることあるよね',
        '',
        '逆に弱く見えすぎると「反撃されなさそうだから殴られる」みたいなこともある？',
        'ヘイトを買わない立ち回りとか交渉の仕方、何が正解なんだろう',
      ].join('\n'),
      comments: [
        '強い弱いより「最初に殴っても角が立たない人」認定されてるパターンありそう',
        'デッキパワー下げすぎると逆に安全な殴り先になるんよな。',
        '手札枚数が多いだけで「なんか持ってそう」って見られることある',
        '交渉は「俺を殴らないで」より「あっち止めないと全員まずい」の方が通りやすい気がする',
        '同じメンツで毎回なら卓の空気の問題もありそう。',
      ],
      categorySlug: 'special-rules',
    }
  }

  const hook = source.body || source.comments[0] || source.title
  const title = `${source.title.replace(/^【[^】]+】/, '').replace(/スレ$/, '').trim()}、実際どう思う？`
  const archiveLead = source.sourceKind === 'archive'
    ? '過去ログで見かけた話題だけど、今見るとまた評価変わってそう\n\n'
    : ''
  const commentPool = source.comments.length >= 5 ? source.comments : [
    'これ、使う側と使われる側で評価かなり変わりそう',
    '一見地味だけど実戦だとかなり嫌なやつだと思う',
    '環境次第で急に評価上がるタイプに見える',
    '強い弱いより対面した時のめんどくささが気になる',
    'こういう話、実際に使ってる人の感想聞きたい',
  ]
  return {
    title,
    body: `${archiveLead}${hook}\n\nこれ、今のデュエマ目線だとどう評価してる？\n使った側・使われた側の感想が聞きたい`,
    comments: commentPool.slice(0, 5).map(styleComment),
    categorySlug: /デュエパ/.test(text) ? 'special-rules' : 'new-cards',
    cardName: card?.name,
  }
}

async function generateWithOpenAI(source: SourceThread): Promise<GeneratedThread | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const prompt = {
    sourceTitle: source.title,
    sourceBody: source.body,
    sourceComments: source.comments.slice(0, 10),
    sourceKind: source.sourceKind,
    rules: [
      'duema-bbs向けに元スレを別角度でアレンジする',
      source.sourceKind === 'archive'
        ? '過去ログ由来なので「今見ると」「今の環境なら」の角度に変換する'
        : '現在カテゴリ由来なので今話しやすい角度に変換する',
      '文面コピーは禁止',
      'コメント5件を作る',
      '文末の句点「。」を全コメントに付けない。句点あり/なしを混ぜる',
      '短文、くだけた言い方、体言止めを混ぜる',
      '荒らし、R18、CP、誹謗中傷は禁止',
      'JSONのみ返す',
    ],
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      temperature: 0.9,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'あなたはデュエマ掲示板の自然なスレ立て補助です。複数人が書いたように文体をばらしてください。' },
        { role: 'user', content: JSON.stringify(prompt) },
      ],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI failed ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = await res.json()
  const content = json?.choices?.[0]?.message?.content
  if (!content) return null
  const parsed = JSON.parse(content) as Partial<GeneratedThread>
  if (!parsed.title || !parsed.body || !Array.isArray(parsed.comments) || parsed.comments.length < 5) return null
  return {
    title: parsed.title.slice(0, 100),
    body: parsed.body.slice(0, 5000),
    comments: parsed.comments.slice(0, 5).map((c, i) => styleComment(String(c).slice(0, 300), i)),
    categorySlug: parsed.categorySlug || 'new-cards',
    cardName: parsed.cardName,
  }
}

function scoreGenerated(generated: GeneratedThread, source: SourceThread): QualityScore {
  let total = 0
  const reasons: string[] = []
  const all = `${generated.title}\n${generated.body}\n${generated.comments.join('\n')}`
  if (generated.title.length >= 12 && generated.title.length <= 60) { total += 3; reasons.push('title-length') }
  if (DUEMA_RE.test(all)) { total += 5; reasons.push('duema') }
  if (/どう思う|きつい|強い|弱い|実際|評価|使って|対面|当時/.test(all)) { total += 4; reasons.push('replyable') }
  if (generated.comments.length === 5) { total += 3; reasons.push('five-comments') }
  if (new Set(generated.comments.map(c => /。$/.test(c))).size > 1) { total += 3; reasons.push('mixed-periods') }
  if (!BANNED_TITLE_RE.test(all)) { total += 3; reasons.push('safe') }
  if (!generated.body.includes(source.body.slice(0, 40))) { total += 2; reasons.push('not-copy') }
  if (BANNED_TITLE_RE.test(all)) total -= 99
  return { total, reasons }
}

async function collectScoredSources(url: string, sourceKind: SourceThread['sourceKind']) {
  const category = await fetchSource(url)
  const categoryCandidates = parseCategory(category)
    .filter(candidate => !BANNED_TITLE_RE.test(candidate.title))
    .filter(candidate => !OTHER_TCG_RE.test(candidate.title) || DUEMA_RE.test(candidate.title))
    .filter(candidate => !/あにまん|animanch/i.test(candidate.title))
    .filter(candidate => sourceKind === 'current' || candidate.count >= 20)
    .slice(0, 40)

  const scored: Array<{ source: SourceThread; sourceScore: ReturnType<typeof sourceScore> }> = []
  for (const candidate of categoryCandidates) {
    try {
      const detailSource = await fetchSource(candidate.href)
      const detail = parseThreadDetail(candidate.boardId, detailSource)
      if (!isLikelyDuema(candidate, detail)) continue
      const source: SourceThread = { ...candidate, body: detail.body, comments: detail.comments, sourceKind }
      scored.push({ source, sourceScore: sourceScore(candidate, detail) })
    } catch (error) {
      console.warn(`source detail failed ${candidate.href}:`, error)
    }
    if (scored.length >= 8) break
  }

  return { scored, candidateCount: categoryCandidates.length }
}

async function pickSourceThread(): Promise<{ source: SourceThread; sourceScore: ReturnType<typeof sourceScore> }> {
  const current = await collectScoredSources(ANIMANCH_CATEGORY, 'current')
  current.scored.sort((a, b) => b.sourceScore.score - a.sourceScore.score)
  const currentBest = current.scored[0]
  if (currentBest && currentBest.sourceScore.score >= 10) return currentBest

  const archive = await collectScoredSources(ANIMANCH_ARCHIVE, 'archive')
  archive.scored.sort((a, b) => b.sourceScore.score - a.sourceScore.score)
  const archiveBest = archive.scored[0]
  if (archiveBest && archiveBest.sourceScore.score >= 14) return archiveBest

  throw new Error(`No good animanch source found. currentCandidates=${current.candidateCount}, archiveCandidates=${archive.candidateCount}`)
}

async function findCategoryId(supabase: ReturnType<typeof createSupabase>, slug: string) {
  const preferred = slug || 'new-cards'
  const { data: bySlug } = await supabase.from('categories').select('id,name,slug').eq('slug', preferred).maybeSingle()
  if (bySlug) return bySlug
  const { data: fallback } = await supabase.from('categories').select('id,name,slug').order('sort_order').limit(1).maybeSingle()
  return fallback
}

async function isDuplicateTitle(supabase: ReturnType<typeof createSupabase>, title: string) {
  const since = new Date(Date.now() - 14 * 86400000).toISOString()
  const { data } = await supabase
    .from('threads')
    .select('id,title')
    .gte('created_at', since)
    .ilike('title', `%${title.slice(0, 18)}%`)
    .limit(1)
  return Boolean(data?.length)
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ?debug=1 : Firecrawl生markdownと parseCategory 結果を返してデバッグ用
  const debug = req.nextUrl.searchParams.get('debug') === '1'
  if (debug) {
    const src = await fetchSource(ANIMANCH_CATEGORY)
    const candidates = parseCategory(src)
    return NextResponse.json({
      kind: src.kind,
      markdownLength: src.text.length,
      markdownHead: src.text.slice(0, 3000),
      candidatesRaw: candidates.slice(0, 20),
    })
  }

  const supabase = createSupabase()
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'

  try {
    const picked = await pickSourceThread()
    const generated = await generateWithOpenAI(picked.source).catch(error => {
      console.warn('OpenAI generation failed, using template:', error)
      return null
    }) ?? templateGenerate(picked.source)

    const official = detectOfficialCard(`${generated.cardName ?? ''}\n${generated.title}\n${generated.body}\n${picked.source.title}\n${picked.source.body}`)
    const quality = scoreGenerated(generated, picked.source)

    const minScore = picked.source.sourceKind === 'archive' ? MIN_ARCHIVE_SCORE_TO_POST : MIN_SCORE_TO_POST
    if (quality.total < minScore) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'quality_score_too_low',
        quality,
        minScore,
        source: { title: picked.source.title, href: picked.source.href, score: picked.sourceScore },
        generated,
      })
    }

    if (await isDuplicateTitle(supabase, generated.title)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'duplicate_title',
        title: generated.title,
        source: picked.source.href,
      })
    }

    const category = await findCategoryId(supabase, generated.categorySlug)
    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        wouldPost: true,
        category,
        imageUrl: official?.imageUrl ?? null,
        officialCardUrl: official?.cardUrl ?? null,
        source: { title: picked.source.title, href: picked.source.href, kind: picked.source.sourceKind, score: picked.sourceScore },
        quality,
        generated,
      })
    }

    const { data: thread, error: threadError } = await supabase
      .from('threads')
      .insert({
        title: generated.title,
        body: generated.body,
        author_name: AUTHOR_NAME,
        category_id: category?.id ?? null,
        image_url: official?.imageUrl ?? null,
      })
      .select('id,title')
      .single()
    if (threadError || !thread) throw threadError ?? new Error('thread insert failed')

    const rows = generated.comments.map((body, index) => ({
      thread_id: thread.id,
      post_number: index + 1,
      body,
      author_name: COMMENT_AUTHOR_POOL[index % COMMENT_AUTHOR_POOL.length],
      image_url: null,
    }))
    const { error: postsError } = await supabase.from('posts').insert(rows)
    if (postsError) throw postsError

    await notifyNewThread({ threadId: thread.id, title: thread.title, categoryName: category?.name ?? null })

    return NextResponse.json({
      ok: true,
      threadId: thread.id,
      url: `https://www.duema-bbs.com/thread/${thread.id}`,
      category,
      imageUrl: official?.imageUrl ?? null,
      officialCardUrl: official?.cardUrl ?? null,
      source: { title: picked.source.title, href: picked.source.href, score: picked.sourceScore },
      quality,
    })
  } catch (error) {
    console.error('animanch seed failed:', error)
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'error',
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
