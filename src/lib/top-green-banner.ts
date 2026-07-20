export type TopGreenBannerButton = {
  enabled: boolean
  label: string
  href: string
  icon: string
  openInNewTab: boolean
  emphasis: boolean
  order: number
}

export const TOP_GREEN_BANNER_SLOT_COUNT = 3

export const TOP_GREEN_BANNER_SETTINGS_KEY = 'top_green_banner_buttons'

function emptyButton(order: number): TopGreenBannerButton {
  return { enabled: false, label: '', href: '', icon: '', openInNewTab: false, emphasis: false, order }
}

export const DEFAULT_TOP_GREEN_BANNER_BUTTONS: TopGreenBannerButton[] = [
  { enabled: true, label: 'アカウント作成', href: '/login?mode=signup', icon: '', openInNewTab: false, emphasis: false, order: 0 },
  { enabled: true, label: 'デュエマあそびば', href: '/makers', icon: '', openInNewTab: false, emphasis: false, order: 1 },
  { enabled: true, label: '新しいお知らせ', href: '/mypage', icon: '🔔', openInNewTab: false, emphasis: false, order: 2 },
]

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function isSafeHref(value: string): boolean {
  if (!value) return false
  if (value.startsWith('/')) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function parseTopGreenBannerButtons(raw: string | null | undefined): TopGreenBannerButton[] {
  if (!raw) return DEFAULT_TOP_GREEN_BANNER_BUTTONS
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_TOP_GREEN_BANNER_BUTTONS
    const slots = Array.from({ length: TOP_GREEN_BANNER_SLOT_COUNT }, (_, i) => {
      const record = parsed[i] && typeof parsed[i] === 'object' ? parsed[i] as Record<string, unknown> : null
      if (!record) return emptyButton(i)
      return {
        enabled: record.enabled === true,
        label: text(record.label),
        href: text(record.href),
        icon: text(record.icon),
        openInNewTab: record.openInNewTab === true,
        emphasis: record.emphasis === true,
        order: Number.isFinite(Number(record.order)) ? Number(record.order) : i,
      }
    })
    return slots
  } catch {
    return DEFAULT_TOP_GREEN_BANNER_BUTTONS
  }
}

export type ResolvedTopGreenBannerButton = {
  label: string
  href: string
  icon: string
  openInNewTab: boolean
  emphasis: boolean
}

// 表示ONかつラベル・リンクが有効なボタンだけを並び順で返す（0件も許容）
export function resolveVisibleTopGreenBannerButtons(buttons: TopGreenBannerButton[]): ResolvedTopGreenBannerButton[] {
  return buttons
    .filter(button => button.enabled && button.label && isSafeHref(button.href))
    .sort((a, b) => a.order - b.order)
    .map(({ label, href, icon, openInNewTab, emphasis }) => ({ label, href, icon, openInNewTab, emphasis }))
}
