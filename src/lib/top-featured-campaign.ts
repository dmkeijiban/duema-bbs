// lib/thumbnail.ts の DEFAULT_THREAD_THUMBNAIL と同一パス（supabase-admin依存を避けるため直接定義）
const DEFAULT_FEATURED_CAMPAIGN_IMAGE = '/default-thumbnail.jpg'

export const CARD_IMAGE_SLOT_COUNT = 3

export type FeaturedCampaignCardImage = {
  imageUrl: string
  positionX: number
  positionY: number
  scale: number
}

export type TopFeaturedCampaignSettings = {
  enabled: boolean
  projectSlug: string
  label: string
  subText: string
  title: string
  description: string
  mainButtonLabel: string
  mainButtonLink: string
  subButtonLabel: string
  subButtonLink: string
  imageUrl: string
  imagePositionX: number
  imagePositionY: number
  imageScale: number
  cardImages: FeaturedCampaignCardImage[]
}

export const DEFAULT_IMAGE_POSITION_X = 50
export const DEFAULT_IMAGE_POSITION_Y = 50
export const DEFAULT_IMAGE_SCALE = 1
export const MIN_IMAGE_SCALE = 1
export const MAX_IMAGE_SCALE = 2

const DEFAULT_CARD_IMAGE: FeaturedCampaignCardImage = {
  imageUrl: '',
  positionX: DEFAULT_IMAGE_POSITION_X,
  positionY: DEFAULT_IMAGE_POSITION_Y,
  scale: DEFAULT_IMAGE_SCALE,
}

export const DEFAULT_TOP_FEATURED_CAMPAIGN: TopFeaturedCampaignSettings = {
  enabled: false,
  projectSlug: '',
  label: '',
  subText: '',
  title: '',
  description: '',
  mainButtonLabel: '',
  mainButtonLink: '',
  subButtonLabel: '',
  subButtonLink: '',
  imageUrl: '',
  imagePositionX: DEFAULT_IMAGE_POSITION_X,
  imagePositionY: DEFAULT_IMAGE_POSITION_Y,
  imageScale: DEFAULT_IMAGE_SCALE,
  cardImages: Array.from({ length: CARD_IMAGE_SLOT_COUNT }, () => ({ ...DEFAULT_CARD_IMAGE })),
}

export const TOP_FEATURED_CAMPAIGN_SETTINGS_KEY = 'top_featured_campaign'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

// NaN・不正文字列はfallbackへ、範囲外はmin〜maxへクランプする（クライアント・サーバー両方の防御に共用）
export function clampFeaturedCampaignNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, num))
}

function parseCardImages(value: unknown): FeaturedCampaignCardImage[] {
  const source = Array.isArray(value) ? value : []
  return Array.from({ length: CARD_IMAGE_SLOT_COUNT }, (_, index) => {
    const raw = source[index]
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_CARD_IMAGE }
    const record = raw as Record<string, unknown>
    return {
      imageUrl: text(record.imageUrl),
      positionX: clampFeaturedCampaignNumber(record.positionX, 0, 100, DEFAULT_IMAGE_POSITION_X),
      positionY: clampFeaturedCampaignNumber(record.positionY, 0, 100, DEFAULT_IMAGE_POSITION_Y),
      scale: clampFeaturedCampaignNumber(record.scale, MIN_IMAGE_SCALE, MAX_IMAGE_SCALE, DEFAULT_IMAGE_SCALE),
    }
  })
}

export function parseTopFeaturedCampaignSettings(raw: string | null | undefined): TopFeaturedCampaignSettings {
  if (!raw) return DEFAULT_TOP_FEATURED_CAMPAIGN
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_TOP_FEATURED_CAMPAIGN
    const record = parsed as Record<string, unknown>
    return {
      enabled: record.enabled === true,
      projectSlug: text(record.projectSlug),
      label: text(record.label),
      subText: text(record.subText),
      title: text(record.title),
      description: text(record.description),
      mainButtonLabel: text(record.mainButtonLabel),
      mainButtonLink: text(record.mainButtonLink),
      subButtonLabel: text(record.subButtonLabel),
      subButtonLink: text(record.subButtonLink),
      imageUrl: text(record.imageUrl),
      imagePositionX: clampFeaturedCampaignNumber(record.imagePositionX, 0, 100, DEFAULT_IMAGE_POSITION_X),
      imagePositionY: clampFeaturedCampaignNumber(record.imagePositionY, 0, 100, DEFAULT_IMAGE_POSITION_Y),
      imageScale: clampFeaturedCampaignNumber(record.imageScale, MIN_IMAGE_SCALE, MAX_IMAGE_SCALE, DEFAULT_IMAGE_SCALE),
      cardImages: parseCardImages(record.cardImages),
    }
  } catch {
    return DEFAULT_TOP_FEATURED_CAMPAIGN
  }
}

// 内部リンク（"/"始まり）または http/https の絶対URLのみ許可し、リンク切れ・不正値を弾く
export function isSafeTopFeaturedLink(value: string): boolean {
  if (!value) return false
  if (value.startsWith('/')) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export type TopFeaturedCampaignProject = {
  slug: string
  title: string
  description: string
  thumbnailUrl: string
  visible: boolean
}

export type ResolvedTopFeaturedCampaign = {
  projectSlug: string
  label: string
  subText: string
  title: string
  description: string
  mainHref: string
  mainLabel: string
  subHref: string | null
  subLabel: string | null
  imageUrl: string
  imagePositionX: number
  imagePositionY: number
  imageScale: number
}

// TOPの表示とPC/SP管理画面プレビューの両方で使い、見た目の食い違いを防ぐ
export type FeaturedCampaignImageStyle = {
  objectPosition: string
  transform: string
  transformOrigin: string
}

export function computeFeaturedCampaignImageStyle(
  positionX: number,
  positionY: number,
  scale: number
): FeaturedCampaignImageStyle {
  const x = clampFeaturedCampaignNumber(positionX, 0, 100, DEFAULT_IMAGE_POSITION_X)
  const y = clampFeaturedCampaignNumber(positionY, 0, 100, DEFAULT_IMAGE_POSITION_Y)
  const s = clampFeaturedCampaignNumber(scale, MIN_IMAGE_SCALE, MAX_IMAGE_SCALE, DEFAULT_IMAGE_SCALE)
  return {
    objectPosition: `${x}% ${y}%`,
    transform: `scale(${s})`,
    transformOrigin: 'center',
  }
}

const DEFAULT_MAIN_BUTTON_LABEL = '見る'

export function resolveTopFeaturedCampaign(
  settings: TopFeaturedCampaignSettings,
  project: TopFeaturedCampaignProject | null
): ResolvedTopFeaturedCampaign | null {
  if (!settings.enabled) return null
  if (!settings.projectSlug) return null
  // 対象企画が非公開・削除済みの場合はPOP全体を自動非表示
  if (!project || !project.visible) return null

  const mainHref = settings.mainButtonLink || `/makers/${settings.projectSlug}`
  if (!isSafeTopFeaturedLink(mainHref)) return null

  const title = settings.title || project.title
  if (!title) return null

  const subHrefRaw = settings.subButtonLink
  const subLabelRaw = settings.subButtonLabel
  const hasSub = Boolean(subHrefRaw && subLabelRaw && isSafeTopFeaturedLink(subHrefRaw))

  // カード画像3枚設定は後方互換のため読み取るが、表示は1枚画像方式へ戻す。
  const imageUrl =
    (settings.imageUrl && isSafeTopFeaturedLink(settings.imageUrl) && settings.imageUrl) ||
    (project.thumbnailUrl && isSafeTopFeaturedLink(project.thumbnailUrl) && project.thumbnailUrl) ||
    DEFAULT_FEATURED_CAMPAIGN_IMAGE

  return {
    projectSlug: settings.projectSlug,
    label: settings.label,
    subText: settings.subText,
    title,
    description: settings.description || project.description,
    mainHref,
    mainLabel: settings.mainButtonLabel || DEFAULT_MAIN_BUTTON_LABEL,
    subHref: hasSub ? subHrefRaw : null,
    subLabel: hasSub ? subLabelRaw : null,
    imageUrl,
    imagePositionX: clampFeaturedCampaignNumber(settings.imagePositionX, 0, 100, DEFAULT_IMAGE_POSITION_X),
    imagePositionY: clampFeaturedCampaignNumber(settings.imagePositionY, 0, 100, DEFAULT_IMAGE_POSITION_Y),
    imageScale: clampFeaturedCampaignNumber(settings.imageScale, MIN_IMAGE_SCALE, MAX_IMAGE_SCALE, DEFAULT_IMAGE_SCALE),
  }
}
