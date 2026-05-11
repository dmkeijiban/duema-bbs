import { ApifyClient } from 'apify-client'

const ACTOR_ID = 'epctex/twitter-scraper'
const DEFAULT_MAX_ITEMS = 50
const MAX_ITEMS_LIMIT = 200

type RawApifyTweet = Record<string, unknown>

export type XReplyItem = {
  text: string
  authorName: string
  likeCount: number
  createdAt: string
  url: string
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function getNestedString(source: RawApifyTweet, keys: string[]): string {
  let current: unknown = source
  for (const key of keys) {
    if (!current || typeof current !== 'object') return ''
    current = (current as Record<string, unknown>)[key]
  }
  return getString(current)
}

export function normalizeXPostUrl(value: string): string | null {
  const rawUrl = value.trim()
  if (!rawUrl) return null

  let parsed: URL
  try {
    parsed = new URL(rawUrl.replace('twitter.com/', 'x.com/'))
  } catch {
    return null
  }

  const hostname = parsed.hostname.replace(/^www\./, '')
  if (hostname !== 'x.com' && hostname !== 'twitter.com') return null

  const match = parsed.pathname.match(/\/status\/(\d+)/)
  if (!match) return null

  return `https://x.com${parsed.pathname.split('/').slice(0, 4).join('/')}`
}

export function extractTweetId(tweetUrl: string): string | null {
  return tweetUrl.match(/\/status\/(\d+)/)?.[1] ?? null
}

function getTwitterAuthTokens(): string[] {
  const value =
    process.env.APIFY_TWITTER_AUTH_TOKENS ||
    process.env.APIFY_TWITTER_AUTH_TOKEN ||
    process.env.X_AUTH_TOKENS ||
    process.env.X_AUTH_TOKEN ||
    ''

  return value
    .split(/[\n,]/)
    .map(token => token.trim())
    .filter(Boolean)
}

function normalizeReply(item: RawApifyTweet): XReplyItem | null {
  const text =
    getString(item.text) ||
    getString(item.fullText) ||
    getString(item.full_text) ||
    getString(item.replyText)

  if (!text) return null

  const authorName =
    getNestedString(item, ['author', 'name']) ||
    getNestedString(item, ['author', 'userName']) ||
    getNestedString(item, ['user', 'name']) ||
    getNestedString(item, ['user', 'screen_name']) ||
    getNestedString(item, ['user_info', 'name']) ||
    getString(item.name) ||
    getString(item.screen_name) ||
    getString(item.authorUsername) ||
    '不明'

  return {
    text,
    authorName,
    likeCount:
      getNumber(item.likeCount) ||
      getNumber(item.favoriteCount) ||
      getNumber(item.favorites) ||
      getNumber(item.likes),
    createdAt:
      getString(item.createdAt) ||
      getString(item.created_at) ||
      getString(item.timestamp),
    url:
      getString(item.url) ||
      getString(item.twitterUrl) ||
      getString(item.replyUrl),
  }
}

export async function fetchXRepliesByApify(tweetUrl: string, requestedMaxItems = DEFAULT_MAX_ITEMS) {
  const token = process.env.APIFY_TOKEN
  if (!token) {
    throw new Error('APIFY_TOKEN が未設定です。Vercelまたは .env.local に追加してください。')
  }

  const normalizedUrl = normalizeXPostUrl(tweetUrl)
  if (!normalizedUrl) {
    throw new Error('Xの投稿URLを読み取れませんでした。https://x.com/.../status/... の形式で入力してください。')
  }

  const tweetId = extractTweetId(normalizedUrl)
  if (!tweetId) {
    throw new Error('X投稿IDを読み取れませんでした。')
  }

  const maxItems = Math.min(Math.max(Math.floor(requestedMaxItems) || DEFAULT_MAX_ITEMS, 1), MAX_ITEMS_LIMIT)
  const authTokens = getTwitterAuthTokens()
  if (authTokens.length === 0) {
    throw new Error('epctex/twitter-scraper 用の X 認証情報が未設定です。APIFY_TWITTER_AUTH_TOKEN または APIFY_TWITTER_AUTH_TOKENS を環境変数に入れてください。')
  }

  const client = new ApifyClient({ token })
  const run = await client.actor(ACTOR_ID).call({
    startUrls: [normalizedUrl],
    conversationIds: [tweetId],
    maxItems,
    sort: 'Latest',
    authTokens,
    proxy: { useApifyProxy: true },
  })

  if (!run.defaultDatasetId) {
    throw new Error('ApifyのDataset IDを取得できませんでした。')
  }

  const { items } = await client.dataset<RawApifyTweet>(run.defaultDatasetId).listItems({ limit: maxItems })
  const replies = items
    .filter(item => {
      const id = getString(item.id) || getString(item.tweet_id) || getString(item.tweetId)
      if (id === tweetId) return false
      const conversationId = getString(item.conversationId) || getString(item.conversation_id)
      return !conversationId || conversationId === tweetId
    })
    .map(normalizeReply)
    .filter((item): item is XReplyItem => Boolean(item))
    .slice(0, maxItems)

  return {
    actorId: ACTOR_ID,
    runId: run.id,
    datasetId: run.defaultDatasetId,
    sourceUrl: normalizedUrl,
    maxItems,
    replies,
  }
}
