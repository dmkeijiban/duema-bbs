const SITE_URL = 'https://www.duema-bbs.com'
const X_SUFFIX = '#デュエマ @dmkeijiban'
const MAX_X_LENGTH = 280

type CategoryLike = {
  name?: string | null
}

export type PopularThreadForDraft = {
  id: number
  title: string
  body?: string | null
  post_count: number
  view_count?: number | null
  created_at?: string | null
  last_posted_at?: string | null
  categories?: CategoryLike | CategoryLike[] | null
}

export type XPostDraft = {
  threadId: number
  title: string
  postCount: number
  url: string
  categoryName: string
  draft: string
}

function getCategoryName(thread: PopularThreadForDraft): string {
  const categories = thread.categories
  if (Array.isArray(categories)) return categories[0]?.name?.trim() || '雑談'
  return categories?.name?.trim() || '雑談'
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s+/g, ' ')
    .replace(/[「」]/g, '')
    .trim()
}

function truncateForX(text: string) {
  if (text.length <= MAX_X_LENGTH) return text

  const suffixMatch = text.match(/\shttps:\/\/www\.duema-bbs\.com\/thread\/\d+\s#デュエマ @dmkeijiban$/)
  const suffix = suffixMatch?.[0] ?? ''
  const baseLimit = MAX_X_LENGTH - suffix.length - 1
  return `${text.slice(0, Math.max(20, baseLimit)).trim()}…${suffix}`
}

function makeLead(thread: PopularThreadForDraft, categoryName: string): string {
  const title = cleanTitle(thread.title)
  const count = thread.post_count ?? 0

  if (count >= 50) return `かなり伸びてるスレ。\n「${title}」\nみんなの意見見たい。`
  if (categoryName.includes('環境') || title.includes('環境')) return `今の環境、これどう思う？\n「${title}」`
  if (title.includes('高騰') || title.includes('買取') || title.includes('相場')) return `このカード周りの話、ちょっと気になる。\n「${title}」`
  if (title.includes('新カード') || title.includes('公開')) return `新カードの反応集まり中。\n「${title}」`
  if (title.includes('デッキ') || title.includes('相談')) return `デッキ相談・構築の話題。\n「${title}」`
  if (count >= 15) return `じわじわ伸びてる話題。\n「${title}」`
  return `このスレどう思う？\n「${title}」`
}

export function makeXPostDraft(thread: PopularThreadForDraft): XPostDraft {
  const categoryName = getCategoryName(thread)
  const url = `${SITE_URL}/thread/${thread.id}`
  const lead = makeLead(thread, categoryName)
  const countText = thread.post_count > 0 ? `\n現在${thread.post_count}レス` : ''
  const draft = truncateForX(`${lead}${countText}\n${url} ${X_SUFFIX}`)

  return {
    threadId: thread.id,
    title: thread.title,
    postCount: thread.post_count,
    url,
    categoryName,
    draft,
  }
}

export function makeXPostDrafts(threads: PopularThreadForDraft[]): XPostDraft[] {
  return threads.map(makeXPostDraft)
}
