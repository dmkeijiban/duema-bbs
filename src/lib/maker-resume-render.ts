import {
  RESUME_ACHIEVEMENT_PRESETS,
  RESUME_REGIONS,
  RESUME_SOCIAL_TAG_PRESETS,
  RESUME_UNANSWERED,
  type ResumeData,
} from '@/lib/maker-resume'

/**
 * 履歴書上では、空白と既存データに残った単独ハイフンを未入力として扱う。
 * 保存値は変更せず、DOMプレビューとPNGの表示判断だけを共通化する。
 */
export function resumeDisplayText(value: unknown): string {
  if (typeof value !== 'string') return ''
  const text = value.trim()
  return text === '-' ? '' : text
}

/** 「未回答」「無回答」のプリセット値は未入力扱いにする（明示的な「特になし」等は回答として残す）。 */
function resumeAnsweredText(value: unknown): string {
  const text = resumeDisplayText(value)
  return text === RESUME_UNANSWERED || text === '無回答' ? '' : text
}

function presetLabels(keys: unknown, presets: readonly { key: string; label: string }[]): string[] {
  if (!Array.isArray(keys)) return []
  const labels = new Map(presets.map(preset => [preset.key, preset.label]))
  return keys.flatMap(key => {
    if (typeof key !== 'string') return []
    const label = labels.get(key)
    return label ? [label] : []
  })
}

export function getResumeSectionContent(data: ResumeData) {
  return {
    interaction: {
      tags: presetLabels(data.socialTags, RESUME_SOCIAL_TAG_PRESETS),
      note: resumeDisplayText(data.socialNote),
    },
    achievements: {
      tags: presetLabels(data.achievements, RESUME_ACHIEVEMENT_PRESETS),
      note: resumeDisplayText(data.achievementNote),
    },
    freeSpace: {
      text: resumeDisplayText(data.freeSpace),
    },
  }
}

/** 全角/半角を問わず文字数ベースで折返し行数を見積もる。実測ではなく、レイアウト側の枠計算に使う概算値。 */
export function estimateWrappedLines(value: string, charactersPerLine: number): number {
  if (!value.trim()) return 0
  return value.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(Array.from(line).length / charactersPerLine)), 0)
}

function truncateToApproxLines(value: string, charactersPerLine: number, maxLines: number): string {
  const lines = value.split('\n')
  const out: string[] = []
  let used = 0
  for (const line of lines) {
    const chars = Array.from(line)
    const neededLines = Math.max(1, Math.ceil(chars.length / charactersPerLine))
    if (used + neededLines > maxLines) {
      const remainingLines = maxLines - used
      if (remainingLines <= 0) break
      const allowedChars = Math.max(0, remainingLines * charactersPerLine - 1)
      out.push(`${chars.slice(0, allowedChars).join('')}…`)
      used = maxLines
      break
    }
    out.push(line)
    used += neededLines
  }
  return out.join('\n')
}

export type ResumeTextFitTier = { fontSize: number; lineHeight: number; charsPerLine: number; maxLines: number }

/**
 * 長文を「行数・余白を増やす→フォントを1段階落とす→末尾を省略する」の順で収める。
 * 最初から極端に小さい文字にはしない（tiersは大きい順に並べること）。
 */
export function fitResumeLongText(value: unknown, tiers: readonly ResumeTextFitTier[]): { text: string; truncated: boolean; tier: ResumeTextFitTier } {
  const text = resumeDisplayText(value)
  for (const tier of tiers) {
    if (estimateWrappedLines(text, tier.charsPerLine) <= tier.maxLines) return { text, truncated: false, tier }
  }
  const last = tiers[tiers.length - 1]
  return { text: truncateToApproxLines(text, last.charsPerLine, last.maxLines), truncated: true, tier: last }
}

/** 使用デッキの自由記述を区切り記号で分割し、大きく表示する件数と「ほか◯件」を求める。 */
export function getResumeDeckList(currentDecksText: unknown, maxShown = 3, maxCharsPerItem = 34): { shown: string[]; extraCount: number } {
  const text = resumeDisplayText(currentDecksText)
  if (!text) return { shown: [], extraCount: 0 }
  const parts = text.split(/[、,，/・\n]+/).map(part => part.trim()).filter(Boolean)
  const items = parts.length > 0 ? parts : [text]
  const shown = items.slice(0, maxShown).map(name => Array.from(name).length > maxCharsPerItem ? `${Array.from(name).slice(0, maxCharsPerItem - 1).join('')}…` : name)
  return { shown, extraCount: Math.max(0, items.length - maxShown) }
}

/** タグ（プリセット選択肢）が多い場合に、表示件数と「ほか◯件」を求める。 */
export function getResumeTagDisplay(tags: readonly string[], maxVisible = 8): { shown: string[]; extraCount: number } {
  return { shown: tags.slice(0, maxVisible), extraCount: Math.max(0, tags.length - maxVisible) }
}

export type ResumeVisualProfile = {
  name: string
  generation: string
  ageGroup: string
  favoriteCivilization: string
  playStyle: string
  region: string
  duelMastersPlayStatus: string
}

/** 見やすさ重視レイアウトの上部プロフィールで使う値。「未回答」「無回答」相当は空扱いにして枠を詰める。 */
export function getResumeVisualProfile(data: ResumeData): ResumeVisualProfile {
  return {
    name: resumeDisplayText(data.handleName),
    generation: resumeDisplayText(data.generation),
    ageGroup: resumeAnsweredText(data.ageGroup),
    favoriteCivilization: resumeDisplayText(data.favoriteCivilization),
    playStyle: resumeDisplayText(data.playStyle),
    region: RESUME_REGIONS.includes(data.region as typeof RESUME_REGIONS[number]) ? resumeAnsweredText(data.region) : resumeDisplayText(data.region),
    duelMastersPlayStatus: resumeDisplayText(data.duelMastersPlayStatus),
  }
}

export const RESUME_VISUAL_FREE_SPACE_TIERS = [
  { fontSize: 28, lineHeight: 40, charsPerLine: 27, maxLines: 6 },
  { fontSize: 24, lineHeight: 34, charsPerLine: 31, maxLines: 9 },
  { fontSize: 21, lineHeight: 29, charsPerLine: 35, maxLines: 12 },
] as const satisfies readonly ResumeTextFitTier[]

export const RESUME_VISUAL_OTHER_INTERESTS_TIERS = [
  { fontSize: 26, lineHeight: 36, charsPerLine: 21, maxLines: 4 },
  { fontSize: 23, lineHeight: 31, charsPerLine: 25, maxLines: 6 },
  { fontSize: 20, lineHeight: 27, charsPerLine: 29, maxLines: 8 },
] as const satisfies readonly ResumeTextFitTier[]

export const RESUME_VISUAL_SHORT_NOTE_TIERS = [
  { fontSize: 26, lineHeight: 34, charsPerLine: 20, maxLines: 2 },
  { fontSize: 22, lineHeight: 29, charsPerLine: 24, maxLines: 3 },
] as const satisfies readonly ResumeTextFitTier[]

export const RESUME_VISUAL_ACHIEVEMENT_NOTE_TIERS = RESUME_VISUAL_SHORT_NOTE_TIERS

export const RESUME_VISUAL_CARD_COMMENT_TIERS = [
  { fontSize: 24, lineHeight: 32, charsPerLine: 17, maxLines: 3 },
  { fontSize: 20, lineHeight: 27, charsPerLine: 21, maxLines: 4 },
] as const satisfies readonly ResumeTextFitTier[]

export type ResumeVisualFavoriteCard = { cardId: string; imageUrl: string | null; name: string; comment: ReturnType<typeof fitResumeLongText> }

export function getResumeVisualFavoriteCard(data: ResumeData): ResumeVisualFavoriteCard | null {
  if (data.photo?.type !== 'card') return null
  return { cardId: data.photo.cardId, imageUrl: data.photo.imageUrl, name: resumeDisplayText(data.photo.name), comment: fitResumeLongText(data.favoriteCardComment, RESUME_VISUAL_CARD_COMMENT_TIERS) }
}

/**
 * 見やすさ重視レイアウトが必要とする表示用データをまとめて算出する。
 * HTMLプレビューとPNG書き出し（同じDOMのスナップショット）の双方から同じ関数を使う。
 */
export function getResumeVisualContent(data: ResumeData) {
  const section = getResumeSectionContent(data)
  return {
    profile: getResumeVisualProfile(data),
    deck: getResumeDeckList(data.currentDecksText),
    duelMastersPlayMainDeck: resumeDisplayText(data.duelMastersPlayMainDeck),
    favoriteYouTuber: resumeDisplayText(data.favoriteYouTuber),
    otherInterests: fitResumeLongText(data.otherInterests, RESUME_VISUAL_OTHER_INTERESTS_TIERS),
    interaction: {
      ...getResumeTagDisplay(section.interaction.tags),
      note: fitResumeLongText(section.interaction.note, RESUME_VISUAL_SHORT_NOTE_TIERS),
    },
    achievements: {
      ...getResumeTagDisplay(section.achievements.tags),
      note: fitResumeLongText(section.achievements.note, RESUME_VISUAL_ACHIEVEMENT_NOTE_TIERS),
    },
    freeSpace: fitResumeLongText(section.freeSpace.text, RESUME_VISUAL_FREE_SPACE_TIERS),
    favoriteCard: getResumeVisualFavoriteCard(data),
  }
}
