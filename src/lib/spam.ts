// 日本語文字が含まれているか確認（ひらがな・カタカナ・漢字）
export function hasJapanese(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f]/.test(text)
}

export const COMMENT_BODY_MAX_LENGTH = 1000

const EMOJI_RE = /\p{Extended_Pictographic}/u
const IGNORE_FOR_SPAM_RE = /^[\s\uFE0F\u200D。、,.!！?？ー~〜ｗw]+$/u

type SpamValidationResult = {
  ok: boolean
  error?: string
}

function significantUnits(text: string) {
  return Array.from(text.normalize('NFKC')).filter(unit => !IGNORE_FOR_SPAM_RE.test(unit))
}

function isEmojiUnit(unit: string) {
  return EMOJI_RE.test(unit)
}

export function validateCommentBody(body: string): SpamValidationResult {
  const text = body.trim()
  if (!text) return { ok: false, error: '本文を入力してください' }
  if (text.length > COMMENT_BODY_MAX_LENGTH) {
    return { ok: false, error: `本文は${COMMENT_BODY_MAX_LENGTH}文字以内で入力してください` }
  }

  const units = significantUnits(text)
  if (units.length === 0) return { ok: false, error: '本文を入力してください' }

  const counts = new Map<string, number>()
  let emojiCount = 0
  let longestRun = 1
  let currentRun = 1
  let previous = ''

  for (const unit of units) {
    counts.set(unit, (counts.get(unit) ?? 0) + 1)
    if (isEmojiUnit(unit)) emojiCount++

    if (unit === previous) {
      currentRun++
      longestRun = Math.max(longestRun, currentRun)
    } else {
      previous = unit
      currentRun = 1
    }
  }

  const uniqueCount = counts.size
  const maxSameCount = Math.max(...counts.values())
  const mostCommonUnit = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  const emojiRatio = emojiCount / units.length
  const sameRatio = maxSameCount / units.length

  if (emojiCount >= 8 && emojiRatio >= 0.8) {
    return { ok: false, error: '絵文字だけの連投は投稿できません。通常の文章にしてください。' }
  }
  if (isEmojiUnit(mostCommonUnit) && maxSameCount >= 6 && sameRatio >= 0.65) {
    return { ok: false, error: '同じ絵文字が多すぎます。内容を変えて投稿してください。' }
  }
  if (longestRun >= 8 && isEmojiUnit(mostCommonUnit)) {
    return { ok: false, error: '同じ絵文字の連続投稿はできません。' }
  }
  if (longestRun >= 16) {
    return { ok: false, error: '同じ文字の連続投稿はできません。' }
  }
  if (units.length >= 20 && sameRatio >= 0.7) {
    return { ok: false, error: '本文の大半が同じ文字の投稿はできません。' }
  }
  if (units.length >= 24 && uniqueCount <= 2) {
    return { ok: false, error: '同じ文字の繰り返しが多すぎます。内容を変えて投稿してください。' }
  }

  return { ok: true }
}
