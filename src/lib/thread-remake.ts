import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

export const THREAD_REMAKE_AUTHOR = 'スレアレンジ'
export const THREAD_REMAKE_TYPE = 'popular_thread_remake'
const REQUIRED_INITIAL_COMMENTS = 5
const MIN_POST_COUNT = 11
const CANDIDATE_LIMIT = 120
const CATEGORY_SLUG = 'classic'
const RECENT_EXCLUSION_DAYS = 14

type DbThread = {
  id: number
  title: string
  body: string
  author_name: string | null
  image_url: string | null
  post_count: number | null
  view_count: number | null
  is_archived: boolean | null
  created_at: string
  last_posted_at: string | null
  source?: string | null
  source_id?: string | null
  session_id?: string | null
  remake_type?: string | null
  remade_from_thread_id?: number | null
}

type DbPost = {
  id: number
  thread_id: number
  post_number: number
  body: string
  author_name: string | null
  image_url: string | null
  created_at: string
  session_id?: string | null
}

function createReadClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !key) {
    throw new Error('Supabase環境変数が未設定です。.env.local を確認してください。')
  }
  return createClient(supabaseUrl, key, { auth: { persistSession: false } })
}

export type RemakeCandidate = {
  thread: DbThread
  posts: DbPost[]
  score: number
}

export type GeneratedRemake = {
  title: string
  body: string
  comments: string[]
}

export type ExclusionLog = {
  threadId: number
  title: string
  reasons: string[]
}

export type ThreadRemakeDryRun = {
  status: 'dry_run'
  selected: null | {
    id: number
    title: string
    postCount: number
    score: number
    imageUrl: string | null
  }
  generated: GeneratedRemake | null
  candidateCount: number
  excluded: ExclusionLog[]
  excludedByReason: Record<string, number>
  skippedReason?: string
}

export type ThreadRemakeResult =
  | ThreadRemakeDryRun
  | {
      status: 'created'
      sourceThreadId: number
      threadId: number
      title: string
      commentCount: number
    }
  | { status: 'skipped'; reason: string; excluded: ExclusionLog[] }
  | { status: 'error'; error: string }

const PRIORITY_THEME_RE =
  /懐か|思い出|好きな|好きだった|といえば|昔|当時|初代|勝舞|勝太|ジョー|アニメ|漫画|パック|弾|箱|開封|切札|相棒|使ってた|覚えてる|クラシック/

const EXCLUDED_THEME_RE =
  /新カード|判明|フラゲ|発売前|発売日|発売直後|新弾|収録|商標|ネタバレ|殿堂発表|速報|CS|大会結果|入賞|優勝|選手権|高騰|下落|相場|買取|値段|デッキ相談|デッキ診断|構築相談|デッキリスト|リスト|個人|店舗|炎上|晒し|荒らし|不具合|バグ|メンテ/

const TEMPORAL_WORD_RE =
  /今日|昨日|明日|今回|新カード|判明|フラゲ|発売前|発売日|商標|ネタバレ|殿堂発表|CS|大会結果|メンテ|不具合|バグ/

const IMAGE_DEPENDENT_RE =
  /^(これ|このカード|この画像|これ覚えてる[？?]?|このデッキ|このリスト|この構築)\s*$|この(カード|画像|デッキ|リスト|構築)|画像(見て|のやつ|前提)|写真|添付|スクショ/m

const BANNED_TONE_RE =
  /死ね|殺す|消えろ|障害|ガイジ|カス|ゴミ|クソ|糞|エロ|R-?18|晒し|詐欺|転売ヤー|炎上/

const LOW_CONTEXT_RE = /^(これ|何これ|どう思う|語ろう|教えて|助けて|質問)$/u

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function compact(text: string, max = 220): string {
  const normalized = normalizeText(text)
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized
}

function includesBadContext(text: string): boolean {
  return EXCLUDED_THEME_RE.test(text) || TEMPORAL_WORD_RE.test(text) || IMAGE_DEPENDENT_RE.test(text)
}

function countPrioritySignals(text: string): number {
  return (text.match(PRIORITY_THEME_RE) ?? []).length
}

function titleLooksReusable(title: string): boolean {
  if (title.length < 8 || title.length > 60) return false
  if (LOW_CONTEXT_RE.test(title.trim())) return false
  return PRIORITY_THEME_RE.test(title)
}

function collectThreadExclusionReasons(thread: DbThread, remadeSourceIds: Set<number>, bannedSessionIds: Set<string>, now: Date): string[] {
  const reasons: string[] = []
  const text = `${thread.title}\n${thread.body}`
  const createdAt = new Date(thread.created_at)
  const ageMs = now.getTime() - createdAt.getTime()
  const recentExclusionMs = RECENT_EXCLUSION_DAYS * 86400000
  const fiveYears = 5 * 365 * 86400000

  if (thread.is_archived) reasons.push('archived_or_private')
  if ((thread.post_count ?? 0) < MIN_POST_COUNT) reasons.push('comment_count_lt_10')
  if (ageMs < recentExclusionMs) reasons.push('within_14_days')
  if (ageMs > fiveYears) reasons.push('too_old')
  if (remadeSourceIds.has(thread.id)) reasons.push('already_remade')
  if (thread.remake_type || thread.remade_from_thread_id) reasons.push('source_is_remake')
  if (thread.source) reasons.push(`external_source:${thread.source}`)
  if (thread.session_id && bannedSessionIds.has(thread.session_id)) reasons.push('banned_session_source')
  if (includesBadContext(text)) reasons.push('excluded_theme_or_context')
  if (BANNED_TONE_RE.test(text)) reasons.push('unsafe_or_toxic_text')
  if (!titleLooksReusable(thread.title)) reasons.push('not_reusable_theme')

  return reasons
}

function buildExcludedByReason(excluded: ExclusionLog[]): Record<string, number> {
  const summary: Record<string, number> = {}
  for (const item of excluded) {
    for (const reason of item.reasons) {
      summary[reason] = (summary[reason] ?? 0) + 1
    }
  }
  return Object.fromEntries(Object.entries(summary).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
}

function buildDryRunResult(params: {
  selected: RemakeCandidate | null
  generated: GeneratedRemake | null
  candidateCount: number
  excluded: ExclusionLog[]
  skippedReason?: string
}): ThreadRemakeDryRun {
  return {
    status: 'dry_run',
    selected: params.selected
      ? {
          id: params.selected.thread.id,
          title: params.selected.thread.title,
          postCount: params.selected.thread.post_count ?? 0,
          score: params.selected.score,
          imageUrl: params.selected.thread.image_url,
        }
      : null,
    generated: params.generated,
    candidateCount: params.candidateCount,
    excluded: params.excluded,
    excludedByReason: buildExcludedByReason(params.excluded),
    ...(params.skippedReason ? { skippedReason: params.skippedReason } : {}),
  }
}

function scoreCandidate(thread: DbThread): number {
  const text = `${thread.title}\n${thread.body}`
  const postScore = Math.min(thread.post_count ?? 0, 80)
  const viewScore = Math.min(Math.floor((thread.view_count ?? 0) / 50), 30)
  const priorityScore = countPrioritySignals(text) * 12
  const imageBonus = thread.image_url ? 4 : 0
  return postScore + viewScore + priorityScore + imageBonus
}

function safeComment(text: string): string | null {
  const body = compact(text.replace(/>>?\d+/g, '').replace(/#res\d+/gi, ''), 160)
  if (body.length < 4 || body.length > 180) return null
  if (includesBadContext(body) || BANNED_TONE_RE.test(body)) return null
  if (IMAGE_DEPENDENT_RE.test(body)) return null
  return body
}

function diversifyFallbackComment(comment: string, index: number): string {
  const trimmed = comment.replace(/[。.]+$/g, '')
  const suffixes = ['', 'って感じある', '懐かしい', '今でもちょっと分かる', 'あったなあ']
  if (index === 0 || /[！？!?]$/.test(trimmed)) return trimmed
  return `${trimmed}${suffixes[index % suffixes.length]}`
}

function isOldThemeBoostCandidate(source: RemakeCandidate): boolean {
  const text = `${source.thread.title}\n${source.thread.body}`
  return /強化|テーマ/.test(source.thread.title) && /サムライ|昔|過去|関連テーマ/.test(text)
}

function buildOldThemeBoostOpening(): Pick<GeneratedRemake, 'title' | 'body'> {
  return {
    title: '昔テーマの強化で嬉しかったやつある？',
    body: [
      'サムライみたいに、昔のテーマが急に強化される流れってけっこう好き。',
      '',
      '昔使ってたテーマ、強化されて嬉しかったテーマ、逆にまだ待ってるテーマとかあれば聞きたい。',
    ].join('\n'),
  }
}

function normalizeGeneratedForSource(generated: GeneratedRemake, source: RemakeCandidate): GeneratedRemake {
  if (!isOldThemeBoostCandidate(source)) return generated
  return {
    ...generated,
    ...buildOldThemeBoostOpening(),
  }
}

function fallbackGenerate(source: RemakeCandidate): GeneratedRemake | null {
  const titleBase = source.thread.title
    .replace(/スレ$/g, '')
    .replace(/について語る?$/g, '')
    .replace(/選手権|優勝/g, '')
    .trim()

  if (!titleLooksReusable(titleBase) || includesBadContext(titleBase)) return null

  const isOldThemeBoost = isOldThemeBoostCandidate(source)
  const oldThemeBoostOpening = isOldThemeBoost ? buildOldThemeBoostOpening() : null
  const title = isOldThemeBoost
    ? oldThemeBoostOpening!.title
    : titleBase.includes('といえば') || titleBase.includes('好き')
    ? `${titleBase}で今でも語れるやつ`
    : `${titleBase}の思い出を語ろう`

  const body = isOldThemeBoost
    ? oldThemeBoostOpening!.body
    : [
        `${titleBase}について、今でも自然に話せそうな思い出を聞きたい。`,
        '',
        '当時使ってた人、対戦で印象に残ってる人、今見ても好きなところがある人いたら教えてください。',
      ].join('\n')

  const comments = source.posts
    .map((post) => safeComment(post.body))
    .filter((body): body is string => Boolean(body))
    .filter((body, index, arr) => arr.findIndex((other) => other.slice(0, 24) === body.slice(0, 24)) === index)
    .slice(0, REQUIRED_INITIAL_COMMENTS)
    .map(diversifyFallbackComment)

  if (comments.length < REQUIRED_INITIAL_COMMENTS) return null
  return { title, body, comments }
}

async function generateWithOpenAI(source: RemakeCandidate): Promise<GeneratedRemake | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return fallbackGenerate(source)

  const prompt = {
    featureName: 'スレアレンジ',
    sourceThread: {
      id: source.thread.id,
      title: source.thread.title,
      body: compact(source.thread.body, 500),
      comments: source.posts.map((p) => compact(p.body, 220)).slice(0, 14),
    },
    rules: [
      'デュエマ掲示板内の既存スレだけを元に、今投稿しても自然なリメイクスレを作る',
      'タイトル、本文、初期コメント5件をJSONで返す',
      '元スレに存在しないカード名・人物名・新知識・時事情報を追加しない',
      '新カード発表、発売直後、殿堂速報、CS、大会結果、価格、デッキ相談、炎上、画像前提の話題にしない',
      'コメントは短文、ぼやき、懐古、ツッコミを混ぜる',
      '説明口調、評論口調、優等生っぽい感想にしない',
      '意味が怪しい時は {"reject": true, "reason": "..."} を返す',
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
      temperature: 0.75,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'あなたはデュエマ掲示板のスレ立て補助です。元スレの範囲から出ず、掲示板らしい短い文体で返します。',
        },
        { role: 'user', content: JSON.stringify(prompt) },
      ],
    }),
  })

  if (!res.ok) throw new Error(`OpenAI failed ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = await res.json()
  const content = json?.choices?.[0]?.message?.content
  if (!content) return null
  const parsed = JSON.parse(content) as Partial<GeneratedRemake> & { reject?: boolean }
  if (parsed.reject) return null
  if (!parsed.title || !parsed.body || !Array.isArray(parsed.comments)) return null
  return {
    title: normalizeText(parsed.title),
    body: normalizeText(parsed.body),
    comments: parsed.comments.map((c) => normalizeText(String(c))).filter(Boolean).slice(0, REQUIRED_INITIAL_COMMENTS),
  }
}

function validateGenerated(generated: GeneratedRemake, source: RemakeCandidate): string[] {
  const reasons: string[] = []
  const all = `${generated.title}\n${generated.body}\n${generated.comments.join('\n')}`
  const sourceAll = `${source.thread.title}\n${source.thread.body}\n${source.posts.map((p) => p.body).join('\n')}`

  if (generated.title.length < 8 || generated.title.length > 64) reasons.push('bad_title_length')
  if (generated.body.length < 20 || generated.body.length > 500) reasons.push('bad_body_length')
  if (generated.comments.length !== REQUIRED_INITIAL_COMMENTS) reasons.push('comment_count_not_5')
  if (generated.comments.some((c) => c.length < 2 || c.length > 180)) reasons.push('bad_comment_length')
  if (includesBadContext(all)) reasons.push('excluded_word_in_generated')
  if (BANNED_TONE_RE.test(all)) reasons.push('unsafe_word_in_generated')
  if (/考察すると|本スレでは|以下の観点|重要なのは|総じて|と言えるでしょう/.test(all)) {
    reasons.push('too_explanatory')
  }

  const quotedCards = [...all.matchAll(/《([^》]+)》/g)].map((m) => m[1])
  const unknownCards = quotedCards.filter((name) => !sourceAll.includes(name))
  if (unknownCards.length > 0) reasons.push(`unknown_card_names:${unknownCards.slice(0, 3).join(',')}`)

  const uniqueComments = new Set(generated.comments.map((c) => c.slice(0, 24)))
  if (uniqueComments.size < REQUIRED_INITIAL_COMMENTS) reasons.push('duplicate_comments')

  return reasons
}

async function getRemadeSourceIds(): Promise<Set<number>> {
  const supabase = createReadClient()
  const { data, error } = await supabase
    .from('threads')
    .select('remade_from_thread_id')
    .eq('remake_type', THREAD_REMAKE_TYPE)
    .not('remade_from_thread_id', 'is', null)

  if (error) {
    if (error.code === '42703') return new Set()
    throw new Error(`remade-source-check: ${error.message}`)
  }
  return new Set((data ?? []).map((row) => Number(row.remade_from_thread_id)).filter(Number.isFinite))
}

function isMissingColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '42703' || Boolean(error?.message?.includes('remade_from_thread_id') || error?.message?.includes('remake_type'))
}

function getJstDayStartIso(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const dateKey = jst.toISOString().slice(0, 10)
  return new Date(`${dateKey}T00:00:00.000+09:00`).toISOString()
}

async function hasRemakeCreatedToday(): Promise<boolean> {
  const supabase = createReadClient()
  const { data, error } = await supabase
    .from('threads')
    .select('id')
    .eq('remake_type', THREAD_REMAKE_TYPE)
    .gte('created_at', getJstDayStartIso())
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isMissingColumn(error)) return false
    throw new Error(`today-remake-check: ${error.message}`)
  }
  return Boolean(data)
}

async function getBannedSessionIds(): Promise<Set<string>> {
  const supabase = createReadClient()
  const { data, error } = await supabase
    .from('moderation_bans')
    .select('ban_value')
    .eq('ban_type', 'session')
    .eq('is_active', true)

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('moderation_bans')) {
      return new Set()
    }
    throw new Error(`banned-session-check: ${error.message}`)
  }
  return new Set((data ?? []).map((row) => String(row.ban_value)).filter(Boolean))
}

async function fetchPosts(threadIds: number[]): Promise<Map<number, DbPost[]>> {
  if (threadIds.length === 0) return new Map()
  const supabase = createReadClient()
  const { data, error } = await supabase
    .from('posts')
    .select('id, thread_id, post_number, body, author_name, image_url, created_at, session_id')
    .in('thread_id', threadIds)
    .eq('is_deleted', false)
    .order('post_number', { ascending: true })

  if (error) throw new Error(`posts: ${error.message}`)
  const map = new Map<number, DbPost[]>()
  for (const post of (data ?? []) as DbPost[]) {
    const list = map.get(post.thread_id) ?? []
    list.push(post)
    map.set(post.thread_id, list)
  }
  return map
}

async function resolveCategoryId(): Promise<number | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('categories').select('id').eq('slug', CATEGORY_SLUG).maybeSingle()
  return data?.id ?? null
}

export async function selectRemakeCandidate(now: Date = new Date()): Promise<{
  candidates: RemakeCandidate[]
  excluded: ExclusionLog[]
}> {
  const supabase = createReadClient()
  const [remadeSourceIds, bannedSessionIds] = await Promise.all([getRemadeSourceIds(), getBannedSessionIds()])
  let threadRows: DbThread[] | null = null
  let threadError: { code?: string; message: string } | null = null

  const primary = await supabase
    .from('threads')
    .select('id, title, body, author_name, image_url, post_count, view_count, is_archived, created_at, last_posted_at, source, source_id, session_id, remake_type, remade_from_thread_id')
    .eq('is_archived', false)
    .gte('post_count', MIN_POST_COUNT)
    .order('post_count', { ascending: false })
    .limit(CANDIDATE_LIMIT)

  threadRows = (primary.data ?? null) as DbThread[] | null
  threadError = primary.error

  if (threadError && isMissingColumn(threadError)) {
    const fallback = await supabase
      .from('threads')
      .select('id, title, body, author_name, image_url, post_count, view_count, is_archived, created_at, last_posted_at, source, source_id, session_id')
      .eq('is_archived', false)
      .gte('post_count', MIN_POST_COUNT)
      .order('post_count', { ascending: false })
      .limit(CANDIDATE_LIMIT)
    threadRows = (fallback.data ?? null) as DbThread[] | null
    threadError = fallback.error
  }

  if (threadError) throw new Error(`threads: ${threadError.message}`)

  const excluded: ExclusionLog[] = []
  const preCandidates: DbThread[] = []
  for (const thread of threadRows ?? []) {
    const reasons = collectThreadExclusionReasons(thread, remadeSourceIds, bannedSessionIds, now)
    if (reasons.length > 0) {
      excluded.push({ threadId: thread.id, title: thread.title, reasons })
    } else {
      preCandidates.push(thread)
    }
  }

  const postsByThread = await fetchPosts(preCandidates.map((thread) => thread.id))
  const candidates: RemakeCandidate[] = []
  for (const thread of preCandidates) {
    const posts = postsByThread.get(thread.id) ?? []
    const activeCommentCount = posts.length
    if (activeCommentCount < 10) {
      excluded.push({ threadId: thread.id, title: thread.title, reasons: ['active_comment_count_lt_10'] })
      continue
    }
    const commentText = posts.map((post) => post.body).join('\n')
    if (includesBadContext(commentText) || BANNED_TONE_RE.test(commentText)) {
      excluded.push({ threadId: thread.id, title: thread.title, reasons: ['bad_context_in_comments'] })
      continue
    }
    candidates.push({ thread, posts, score: scoreCandidate(thread) })
  }

  candidates.sort((a, b) => b.score - a.score || (b.thread.post_count ?? 0) - (a.thread.post_count ?? 0))
  return { candidates, excluded }
}

export async function runThreadRemake(options: { dryRun?: boolean } = {}): Promise<ThreadRemakeResult> {
  try {
    if (!options.dryRun && await hasRemakeCreatedToday()) {
      return { status: 'skipped', reason: 'already_created_today', excluded: [] }
    }

    const { candidates, excluded } = await selectRemakeCandidate()
    const selected = candidates[0] ?? null

    if (!selected) {
      return options.dryRun
        ? buildDryRunResult({
            selected: null,
            generated: null,
            candidateCount: 0,
            excluded,
            skippedReason: 'no_candidates',
          })
        : { status: 'skipped', reason: 'no_candidates', excluded }
    }

    const rawGenerated = await generateWithOpenAI(selected)
    const generated = rawGenerated ? normalizeGeneratedForSource(rawGenerated, selected) : null
    if (!generated) {
      return options.dryRun
        ? buildDryRunResult({
            selected,
            generated: null,
            candidateCount: candidates.length,
            excluded,
            skippedReason: 'generation_rejected',
          })
        : { status: 'skipped', reason: 'generation_rejected', excluded }
    }

    const validationReasons = validateGenerated(generated, selected)
    if (validationReasons.length > 0) {
      excluded.unshift({ threadId: selected.thread.id, title: selected.thread.title, reasons: validationReasons })
      return options.dryRun
        ? buildDryRunResult({
            selected,
            generated,
            candidateCount: candidates.length,
            excluded,
            skippedReason: 'generated_validation_failed',
          })
        : { status: 'skipped', reason: 'generated_validation_failed', excluded }
    }

    if (options.dryRun) {
      return buildDryRunResult({
        selected,
        generated,
        candidateCount: candidates.length,
        excluded,
      })
    }

    const admin = createAdminClient()
    const categoryId = await resolveCategoryId()
    const { data: created, error: threadError } = await admin
      .from('threads')
      .insert({
        title: generated.title,
        body: generated.body,
        author_name: THREAD_REMAKE_AUTHOR,
        category_id: categoryId,
        image_url: selected.thread.image_url,
        source: 'duema-bbs',
        source_id: String(selected.thread.id),
        remade_from_thread_id: selected.thread.id,
        remake_type: THREAD_REMAKE_TYPE,
      })
      .select('id, title')
      .single()

    if (threadError || !created) {
      if (threadError?.code === '23505') return { status: 'skipped', reason: 'duplicate_remake', excluded }
      return { status: 'error', error: `thread: ${threadError?.message ?? 'unknown'}` }
    }

    const postRows = generated.comments.map((body, index) => ({
      thread_id: created.id,
      post_number: index + 1,
      body,
      author_name: THREAD_REMAKE_AUTHOR,
    }))
    const { error: postsError } = await admin.from('posts').insert(postRows)
    if (postsError) return { status: 'error', error: `posts: ${postsError.message}` }

    console.log('[thread-remake] created', {
      sourceThreadId: selected.thread.id,
      threadId: created.id,
      title: created.title,
      commentCount: postRows.length,
    })

    return {
      status: 'created',
      sourceThreadId: selected.thread.id,
      threadId: created.id,
      title: created.title,
      commentCount: postRows.length,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[thread-remake] error:', message)
    return { status: 'error', error: message }
  }
}
