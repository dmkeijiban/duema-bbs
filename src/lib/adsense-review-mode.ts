export const ADSENSE_REVIEW_MODE = false

const RISKY_TITLE_KEYWORDS = [
  '夜の',
  'エロ',
  '下ネタ',
  '性的',
  'AV',
  'アダルト',
]

export function isAdSenseReviewMode() {
  return ADSENSE_REVIEW_MODE
}

export function isAdSenseRiskyThreadTitle(title: string | null | undefined) {
  if (!ADSENSE_REVIEW_MODE) return false
  const normalized = (title ?? '').toLowerCase()
  return RISKY_TITLE_KEYWORDS.some(keyword => normalized.includes(keyword.toLowerCase()))
}

export function isThinThreadForAdSenseReview(thread: {
  body?: string | null
  post_count?: number | null
}) {
  if (!ADSENSE_REVIEW_MODE) return false
  const text = (thread.body ?? '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/>>?\d+/g, '')
    .replace(/[\s\n\r　]+/g, '')
    .trim()

  return text.length < 40 && (thread.post_count ?? 0) === 0
}

export function isPrNoticeForAdSenseReview(headerText: string | null | undefined) {
  if (!ADSENSE_REVIEW_MODE) return false
  const header = headerText ?? ''
  return header.includes('【PR】') || header.includes('[PR]') || header.includes('新商品予約リンク')
}
