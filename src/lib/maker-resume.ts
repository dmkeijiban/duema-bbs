import { DUEMA_CIVILIZATIONS, DUEMA_PLAY_STYLES } from '@/lib/duema-profile'

export const RESUME_MAKER_SLUG = 'resume-maker'

export const RESUME_MAX_HANDLE_NAME = 30
export const RESUME_MAX_STARTED_AT = 20
export const RESUME_MAX_REGION = 20
export const RESUME_MAX_HISTORY_ROWS = 6
export const RESUME_MAX_HISTORY_PERIOD = 20
export const RESUME_MAX_HISTORY_CONTENT = 40
export const RESUME_MAX_DECK_ROWS = 5
export const RESUME_MAX_DECK_PERIOD = 20
export const RESUME_MAX_DECK_NAME = 60
export const RESUME_MAX_ACHIEVEMENT_NOTE = 40
export const RESUME_MAX_SOCIAL_NOTE = 40
export const RESUME_MAX_CURRENT_DECKS_TEXT = 150
export const RESUME_MAX_DUEL_MASTERS_PLAY_MAIN_DECK = 60
export const RESUME_MAX_FAVORITE_YOUTUBER = 60
export const RESUME_MAX_OTHER_INTERESTS = 100
export const RESUME_MAX_FREE_SPACE = 200
export const RESUME_MAX_FREE_SPACE_LINES = 8

export type ResumeHistoryEntry = { id: string; period: string; content: string }
export type ResumeDeckEntry = { id: string; period: string; deckName: string }
export type ResumePhotoCard = {
  type: 'card'
  cardId: string
  sourceKey: string | null
  faceSideIndex: number | null
  name: string
  imageUrl: string | null
}
export type ResumePhoto = { type: 'avatar' } | ResumePhotoCard | null

export type ResumeData = {
  version: 1
  handleName: string
  startedAt: string
  generation: string
  region: string
  favoriteCivilization: string
  playStyle: string
  gender: string
  ageGroup: string
  photo: ResumePhoto
  currentDecksText: string
  favoriteYouTuber: string
  otherInterests: string
  duelMastersPlayMainDeck: string
  duelMastersPlayStatus: string
  achievements: string[]
  achievementNote: string
  freeSpace: string
  socialTags: string[]
  socialNote: string
  /** 旧デュエマ歴。新画面には表示欄がないため編集はできないが、既存データを壊さないよう保持する。 */
  history: ResumeHistoryEntry[]
  /** 旧使用デッキ歴。新規保存時は currentDecksText を正本とし、この配列は追記しない。 */
  deckHistory: ResumeDeckEntry[]
}

export const RESUME_ACHIEVEMENT_PRESETS = [
  { key: 'cs_win', label: 'CS優勝' },
  { key: 'cs_placement', label: 'CS入賞' },
  { key: 'official_win', label: '公認大会優勝' },
  { key: 'national_appearance', label: '全国大会出場' },
  { key: 'judge_license', label: 'ジャッジ資格' },
  { key: 'none', label: '特になし' },
] as const

export const RESUME_SOCIAL_TAG_PRESETS = [
  { key: 'offline_ok', label: '対面対戦歓迎' },
  { key: 'remote_ok', label: 'リモート対戦可能' },
  { key: 'deck_advice_ok', label: 'デッキ相談歓迎' },
  { key: 'beginner', label: '初心者です' },
  { key: 'casual', label: 'カジュアル中心' },
  { key: 'cs_active', label: 'CS参加中' },
  { key: 'x_casual', label: 'Xで気軽に絡んでください' },
] as const

export const RESUME_REGIONS = [
  '北海道', '東北', '関東', '甲信越', '北陸', '東海', '関西', '中国', '四国', '九州・沖縄', '海外', '無回答',
] as const

export const RESUME_FAVORITE_CIVILIZATIONS = DUEMA_CIVILIZATIONS
export const RESUME_PLAY_STYLES = DUEMA_PLAY_STYLES

export const RESUME_UNANSWERED = '未回答'

export const RESUME_GENDERS = ['男', '女', 'その他', RESUME_UNANSWERED] as const
export const RESUME_AGE_GROUPS = ['10代', '20代', '30代', '40代', '50代', '60代', 'その他', RESUME_UNANSWERED] as const
export const RESUME_GENERATIONS = ['切札勝舞', '切札勝太', '切札ジョー', 'その他'] as const
export const RESUME_DUEL_MASTERS_PLAY_STATUSES = ['プレイ中', '過去にプレイ', '未経験'] as const
export const RESUME_FAVORITE_CARD_LABEL = '好きなカード'

function clampText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function clampMultilineText(value: unknown, maxChars: number, maxLines: number): string {
  const text = (typeof value === 'string' ? value : '').slice(0, maxChars)
  const lines = text.split('\n').slice(0, maxLines)
  return lines.join('\n')
}

/** @deprecated フリースペースの旧名。互換のため残置。 */
export function clampAboutText(value: string): string {
  return clampMultilineText(value, RESUME_MAX_FREE_SPACE, RESUME_MAX_FREE_SPACE_LINES)
}

export function clampFreeSpaceText(value: string): string {
  return clampMultilineText(value, RESUME_MAX_FREE_SPACE, RESUME_MAX_FREE_SPACE_LINES)
}

export function clampCurrentDecksText(value: string): string {
  return clampMultilineText(value, RESUME_MAX_CURRENT_DECKS_TEXT, 6)
}

export function clampOtherInterestsText(value: string): string {
  return clampMultilineText(value, RESUME_MAX_OTHER_INTERESTS, 4)
}

function sanitizePresetKeys(value: unknown, allowed: readonly { key: string }[], max: number): string[] {
  if (!Array.isArray(value)) return []
  const allowedKeys = new Set(allowed.map(item => item.key))
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !allowedKeys.has(item) || seen.has(item)) continue
    seen.add(item)
    result.push(item)
    if (result.length >= max) break
  }
  return result
}

/** 単純な選択肢配列（region/gender/ageGroup/duelMastersPlay等）を検証し、未該当なら fallback を返す。 */
function sanitizeChoice(value: unknown, allowed: readonly string[], max: number, fallback: string): string {
  const text = clampText(value, max)
  return (allowed as readonly string[]).includes(text) ? text : fallback
}

function sanitizePhoto(value: unknown): ResumePhoto {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (raw.type === 'avatar') return { type: 'avatar' }
  if (raw.type === 'card') {
    const cardId = typeof raw.cardId === 'string' ? raw.cardId : ''
    if (!cardId) return null
    return {
      type: 'card',
      cardId,
      sourceKey: typeof raw.sourceKey === 'string' ? raw.sourceKey : null,
      faceSideIndex: Number.isInteger(raw.faceSideIndex) ? Number(raw.faceSideIndex) : null,
      name: clampText(raw.name, 100),
      imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : null,
    }
  }
  return null
}

function sanitizeHistory(value: unknown): ResumeHistoryEntry[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, RESUME_MAX_HISTORY_ROWS).flatMap((item): ResumeHistoryEntry[] => {
    if (!item || typeof item !== 'object') return []
    const raw = item as Record<string, unknown>
    const period = clampText(raw.period, RESUME_MAX_HISTORY_PERIOD)
    const content = clampText(raw.content, RESUME_MAX_HISTORY_CONTENT)
    if (!period && !content) return []
    return [{ id: typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID(), period, content }]
  })
}

function sanitizeDeckHistory(value: unknown): ResumeDeckEntry[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, RESUME_MAX_DECK_ROWS).flatMap((item): ResumeDeckEntry[] => {
    if (!item || typeof item !== 'object') return []
    const raw = item as Record<string, unknown>
    const period = clampText(raw.period, RESUME_MAX_DECK_PERIOD)
    const deckName = clampText(raw.deckName, RESUME_MAX_DECK_NAME)
    if (!period && !deckName) return []
    return [{ id: typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID(), period, deckName }]
  })
}

/** 新項目「使用デッキ」が未入力の場合のみ、旧・使用デッキ歴のデッキ名を結合して初期値にする（一度きりの移行目的）。 */
function deriveCurrentDecksText(raw: Record<string, unknown>, legacyDeckHistory: ResumeDeckEntry[]): string {
  const direct = clampCurrentDecksText(typeof raw.currentDecksText === 'string' ? raw.currentDecksText : '')
  if (direct) return direct
  if (legacyDeckHistory.length === 0) return ''
  const joined = legacyDeckHistory.map(entry => entry.deckName).filter(Boolean).join('、')
  return clampCurrentDecksText(joined)
}

/** 新項目「フリースペース」が未入力の場合のみ、旧「私にとってデュエマとは」(aboutDuema) を引き継ぐ。 */
function deriveFreeSpace(raw: Record<string, unknown>): string {
  const direct = clampFreeSpaceText(typeof raw.freeSpace === 'string' ? raw.freeSpace : '')
  if (direct) return direct
  return clampFreeSpaceText(typeof raw.aboutDuema === 'string' ? raw.aboutDuema : '')
}

/** 未検証の入力（localStorage・フォーム）を安全なResumeDataへ正規化する。壊れたデータは空値へフォールバックする。 */
export function sanitizeResumeData(value: unknown): ResumeData {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const civilizationValue = clampText(raw.favoriteCivilization, 20)
  const playStyleValue = clampText(raw.playStyle, 20)
  const legacyDeckHistory = sanitizeDeckHistory(raw.deckHistory)
  return {
    version: 1,
    handleName: clampText(raw.handleName, RESUME_MAX_HANDLE_NAME),
    startedAt: clampText(raw.startedAt, RESUME_MAX_STARTED_AT),
    generation: sanitizeChoice(raw.generation, RESUME_GENERATIONS, 10, ''),
    region: RESUME_REGIONS.includes(clampText(raw.region, RESUME_MAX_REGION) as typeof RESUME_REGIONS[number]) ? clampText(raw.region, RESUME_MAX_REGION) : '',
    favoriteCivilization: RESUME_FAVORITE_CIVILIZATIONS.some(o => o.label === civilizationValue) ? civilizationValue : '',
    playStyle: RESUME_PLAY_STYLES.some(o => o.label === playStyleValue) ? playStyleValue : '',
    gender: sanitizeChoice(raw.gender, RESUME_GENDERS, 10, RESUME_UNANSWERED),
    ageGroup: sanitizeChoice(raw.ageGroup, RESUME_AGE_GROUPS, 10, RESUME_UNANSWERED),
    photo: sanitizePhoto(raw.photo),
    currentDecksText: deriveCurrentDecksText(raw, legacyDeckHistory),
    favoriteYouTuber: clampText(raw.favoriteYouTuber, RESUME_MAX_FAVORITE_YOUTUBER),
    otherInterests: clampOtherInterestsText(typeof raw.otherInterests === 'string' ? raw.otherInterests : ''),
    duelMastersPlayMainDeck: clampText(raw.duelMastersPlayMainDeck, RESUME_MAX_DUEL_MASTERS_PLAY_MAIN_DECK),
    duelMastersPlayStatus: sanitizeChoice(raw.duelMastersPlayStatus, RESUME_DUEL_MASTERS_PLAY_STATUSES, 10, ''),
    achievements: sanitizePresetKeys(raw.achievements, RESUME_ACHIEVEMENT_PRESETS, RESUME_ACHIEVEMENT_PRESETS.length),
    achievementNote: clampText(raw.achievementNote, RESUME_MAX_ACHIEVEMENT_NOTE),
    freeSpace: deriveFreeSpace(raw),
    socialTags: sanitizePresetKeys(raw.socialTags, RESUME_SOCIAL_TAG_PRESETS, RESUME_SOCIAL_TAG_PRESETS.length),
    socialNote: clampText(raw.socialNote, RESUME_MAX_SOCIAL_NOTE),
    history: sanitizeHistory(raw.history),
    deckHistory: legacyDeckHistory,
  }
}

export function emptyResumeData(): ResumeData {
  return sanitizeResumeData({})
}

export function isResumeComplete(data: ResumeData) {
  return data.handleName.trim().length > 0
}
