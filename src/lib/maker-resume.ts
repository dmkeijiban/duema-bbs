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
export const RESUME_MAX_ABOUT = 120
export const RESUME_MAX_ABOUT_LINES = 4
export const RESUME_MAX_SOCIAL_NOTE = 40

export type ResumeHistoryEntry = { id: string; period: string; content: string }
export type ResumeDeckEntry = { id: string; period: string; deckName: string }
export type ResumePhotoCard = {
  type: 'card'
  cardId: string
  sourceKey: string | null
  faceSideIndex: number | null
  name: string
  imageUrl: string | null
  caption: 'favorite' | 'partner' | 'first' | 'ace'
}
export type ResumePhoto = { type: 'avatar' } | ResumePhotoCard | null

export type ResumeData = {
  version: 1
  handleName: string
  startedAt: string
  region: string
  favoriteCivilization: string
  playStyle: string
  photo: ResumePhoto
  history: ResumeHistoryEntry[]
  deckHistory: ResumeDeckEntry[]
  achievements: string[]
  achievementNote: string
  aboutDuema: string
  socialTags: string[]
  socialNote: string
}

export const RESUME_HISTORY_PRESETS = [
  { key: 'start', label: 'デュエマを始めた' },
  { key: 'first_deck', label: '初めてデッキを作った' },
  { key: 'first_tournament', label: '初めて大会に参加' },
  { key: 'first_win', label: '初優勝' },
  { key: 'cs_debut', label: 'CS初参加' },
  { key: 'retired', label: '引退' },
  { key: 'comeback', label: '復帰' },
  { key: 'other', label: 'その他' },
] as const

export const RESUME_ACHIEVEMENT_PRESETS = [
  { key: 'cs_win', label: 'CS優勝' },
  { key: 'cs_placement', label: 'CS入賞' },
  { key: 'official_win', label: '公認大会優勝' },
  { key: 'national_appearance', label: '全国大会出場' },
  { key: 'judge_license', label: 'ジャッジ資格' },
  { key: 'first_40_cards', label: '初めて40枚そろえた' },
  { key: 'strongest_among_friends', label: '友達内最強だった' },
  { key: 'long_time_favorite', label: '推しカードを長年使っている' },
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

export const RESUME_PHOTO_CAPTION_LABELS: Record<ResumePhotoCard['caption'], string> = {
  favorite: '一番好きなカード',
  partner: '相棒',
  first: '最初に手に入れた切札',
  ace: '俺の切札',
}

export const RESUME_REGIONS = [
  '北海道', '東北', '関東', '甲信越', '北陸', '東海', '関西', '中国', '四国', '九州・沖縄', '海外', '無回答',
] as const

export const RESUME_FAVORITE_CIVILIZATIONS = DUEMA_CIVILIZATIONS
export const RESUME_PLAY_STYLES = DUEMA_PLAY_STYLES

function clampText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function clampAboutText(value: string): string {
  const text = value.slice(0, RESUME_MAX_ABOUT)
  const lines = text.split('\n').slice(0, RESUME_MAX_ABOUT_LINES)
  return lines.join('\n')
}

function clampAbout(value: unknown): string {
  return clampAboutText(typeof value === 'string' ? value : '')
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

function sanitizePhoto(value: unknown): ResumePhoto {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (raw.type === 'avatar') return { type: 'avatar' }
  if (raw.type === 'card') {
    const cardId = typeof raw.cardId === 'string' ? raw.cardId : ''
    if (!cardId) return null
    const caption = ['favorite', 'partner', 'first', 'ace'].includes(String(raw.caption)) ? raw.caption as ResumePhotoCard['caption'] : 'favorite'
    return {
      type: 'card',
      cardId,
      sourceKey: typeof raw.sourceKey === 'string' ? raw.sourceKey : null,
      faceSideIndex: Number.isInteger(raw.faceSideIndex) ? Number(raw.faceSideIndex) : null,
      name: clampText(raw.name, 100),
      imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : null,
      caption,
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

/** 未検証の入力（localStorage・フォーム）を安全なResumeDataへ正規化する。壊れたデータは空値へフォールバックする。 */
export function sanitizeResumeData(value: unknown): ResumeData {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const civilizationValue = clampText(raw.favoriteCivilization, 20)
  const playStyleValue = clampText(raw.playStyle, 20)
  return {
    version: 1,
    handleName: clampText(raw.handleName, RESUME_MAX_HANDLE_NAME),
    startedAt: clampText(raw.startedAt, RESUME_MAX_STARTED_AT),
    region: RESUME_REGIONS.includes(clampText(raw.region, RESUME_MAX_REGION) as typeof RESUME_REGIONS[number]) ? clampText(raw.region, RESUME_MAX_REGION) : '',
    favoriteCivilization: RESUME_FAVORITE_CIVILIZATIONS.some(o => o.value === civilizationValue) ? civilizationValue : '',
    playStyle: RESUME_PLAY_STYLES.some(o => o.value === playStyleValue) ? playStyleValue : '',
    photo: sanitizePhoto(raw.photo),
    history: sanitizeHistory(raw.history),
    deckHistory: sanitizeDeckHistory(raw.deckHistory),
    achievements: sanitizePresetKeys(raw.achievements, RESUME_ACHIEVEMENT_PRESETS, RESUME_ACHIEVEMENT_PRESETS.length),
    achievementNote: clampText(raw.achievementNote, RESUME_MAX_ACHIEVEMENT_NOTE),
    aboutDuema: clampAbout(raw.aboutDuema),
    socialTags: sanitizePresetKeys(raw.socialTags, RESUME_SOCIAL_TAG_PRESETS, RESUME_SOCIAL_TAG_PRESETS.length),
    socialNote: clampText(raw.socialNote, RESUME_MAX_SOCIAL_NOTE),
  }
}

export function emptyResumeData(): ResumeData {
  return sanitizeResumeData({})
}

export function isResumeComplete(data: ResumeData) {
  return data.handleName.trim().length > 0
}
