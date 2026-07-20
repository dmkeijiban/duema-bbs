export type PlaygroundRecommendSettings = {
  useTopFeatured: boolean
  projectSlug: string
}

export const PLAYGROUND_RECOMMEND_SETTINGS_KEY = 'playground_recommended_campaign'

export const DEFAULT_PLAYGROUND_RECOMMEND_SETTINGS: PlaygroundRecommendSettings = {
  useTopFeatured: false,
  projectSlug: '',
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function parsePlaygroundRecommendSettings(raw: string | null | undefined): PlaygroundRecommendSettings {
  if (!raw) return DEFAULT_PLAYGROUND_RECOMMEND_SETTINGS
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PLAYGROUND_RECOMMEND_SETTINGS
    const record = parsed as Record<string, unknown>
    return {
      useTopFeatured: record.useTopFeatured === true,
      projectSlug: text(record.projectSlug),
    }
  } catch {
    return DEFAULT_PLAYGROUND_RECOMMEND_SETTINGS
  }
}

// 連動ONならTOP注目企画のslugを、OFFなら個別設定のslugを返す（未設定なら空文字）
export function resolvePlaygroundRecommendedSlug(
  settings: PlaygroundRecommendSettings,
  topFeaturedProjectSlug: string
): string {
  if (settings.useTopFeatured) return topFeaturedProjectSlug
  return settings.projectSlug
}
