// lib/thumbnail.ts の DEFAULT_THREAD_THUMBNAIL と同一パス（supabase-admin依存を避けるため直接定義）
const DEFAULT_FEATURED_CAMPAIGN_IMAGE = '/default-thumbnail.jpg'

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
}

export const TOP_FEATURED_CAMPAIGN_SETTINGS_KEY = 'top_featured_campaign'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
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
  }
}
