export const MAKER_CATEGORIES = ['create', 'play', 'view', 'event', 'archive'] as const
export type MakerCategory = typeof MAKER_CATEGORIES[number]

export const MAKER_CATEGORY_LABELS: Record<MakerCategory, string> = {
  create: '作る',
  play: 'あそぶ',
  view: '見る',
  event: 'イベント',
  archive: 'アーカイブ',
}

export const MAKER_PUBLICATION_STATUSES = ['published', 'draft', 'scheduled', 'ended', 'admin_only'] as const
export type MakerPublicationStatus = typeof MAKER_PUBLICATION_STATUSES[number]

export const MAKER_PUBLICATION_STATUS_LABELS: Record<MakerPublicationStatus, string> = {
  published: '公開',
  draft: '非公開',
  scheduled: '開催前',
  ended: '終了',
  admin_only: '管理者限定',
}

export type MakerCatalogConfig = {
  showInCatalog: boolean
  featured: boolean
  category: MakerCategory
  sortOrder: number
  isNew: boolean
  isLimited: boolean
  showInArchive: boolean
  adminOnly: boolean
  startsAt: string
  endsAt: string
  shortDescription: string
  thumbnailUrl: string
}

export type MakerProjectLike = {
  slug: string
  type: string
  status: string
  is_public: boolean
  config: Record<string, unknown> | null
}

function text(raw: Record<string, unknown>, key: string) {
  return typeof raw[key] === 'string' ? String(raw[key]).trim() : ''
}

function inferredCategory(type: string): MakerCategory {
  if (type === 'tier') return 'create'
  if (type === 'prediction') return 'event'
  if (type === 'select' || type === 'vote' || type === 'quiz' || type === 'qa' || type === 'vs') return 'play'
  return 'play'
}

function normalizeCategory(value: unknown, fallback: MakerCategory): MakerCategory {
  if (MAKER_CATEGORIES.includes(value as MakerCategory)) return value as MakerCategory
  if (value === 'select' || value === 'vote' || value === 'quiz') return fallback
  return fallback
}

function validDate(value: string) {
  const time = value ? new Date(value).getTime() : Number.NaN
  return Number.isFinite(time) ? time : null
}

export function parseMakerCatalogConfig(project: MakerProjectLike): MakerCatalogConfig {
  const raw = project.config ?? {}
  const catalog = raw.catalog && typeof raw.catalog === 'object' && !Array.isArray(raw.catalog)
    ? raw.catalog as Record<string, unknown> : {}
  return {
    showInCatalog: catalog.showInCatalog !== false,
    featured: catalog.featured === true,
    category: normalizeCategory(catalog.category, inferredCategory(project.type)),
    sortOrder: Number.isInteger(Number(catalog.sortOrder)) ? Number(catalog.sortOrder) : 100,
    isNew: catalog.isNew === true,
    isLimited: catalog.isLimited === true,
    showInArchive: catalog.showInArchive === true,
    adminOnly: catalog.adminOnly === true || project.status === 'admin_only',
    startsAt: text(catalog, 'startsAt'),
    endsAt: text(catalog, 'endsAt'),
    shortDescription: text(catalog, 'shortDescription') || text(raw, 'description'),
    thumbnailUrl: text(catalog, 'thumbnailUrl'),
  }
}

export function makerPublicationStatus(project: MakerProjectLike): MakerPublicationStatus {
  return MAKER_PUBLICATION_STATUSES.includes(project.status as MakerPublicationStatus)
    ? project.status as MakerPublicationStatus
    : project.is_public ? 'published' : 'draft'
}

export function isMakerProjectArchived(project: MakerProjectLike, now = new Date()) {
  const catalog = parseMakerCatalogConfig(project)
  const endedAt = validDate(catalog.endsAt)
  return catalog.category === 'archive' || catalog.showInArchive && (
    makerPublicationStatus(project) === 'ended' || endedAt !== null && endedAt < now.getTime()
  )
}

export function isMakerProjectVisible(project: MakerProjectLike, now = new Date()) {
  const catalog = parseMakerCatalogConfig(project)
  if (!project.is_public || !catalog.showInCatalog || catalog.adminOnly) return false
  if (isMakerProjectArchived(project, now)) return catalog.showInArchive
  const status = makerPublicationStatus(project)
  if (status !== 'published' && status !== 'scheduled') return false
  const time = now.getTime()
  const startsAt = validDate(catalog.startsAt)
  const endsAt = validDate(catalog.endsAt)
  if (status === 'scheduled' && startsAt === null) return false
  if (startsAt !== null && startsAt > time) return false
  if (endsAt !== null && endsAt < time) return false
  return true
}

export function isMakerProjectPageAccessible(project: MakerProjectLike, now = new Date()) {
  if (!project.is_public || parseMakerCatalogConfig(project).adminOnly) return false
  const raw = project.config ?? {}
  const rawCatalog = raw.catalog && typeof raw.catalog === 'object' && !Array.isArray(raw.catalog)
    ? raw.catalog as Record<string, unknown>
    : {}
  return isMakerProjectVisible({ ...project, config: { ...raw, catalog: { ...rawCatalog, showInCatalog: true } } }, now)
}

export const STATIC_MAKER_ENTRIES = [
  { id: 'deck-maker', title: 'デッキメーカー', href: '/makers/deck-maker', category: 'create' as const, sortOrder: 10, description: 'カードを検索してデッキ画像を作成できます。' },
  { id: 'memory-zukan', title: '思い出図鑑', href: '/zukan?tab=memories', category: 'view' as const, sortOrder: 10, description: '思い出のカードを選んで、みんなの記憶を見られます。' },
  { id: 'hall-of-fame-zukan', title: '殿堂図鑑', href: '/zukan?tab=hall-of-fame', category: 'view' as const, sortOrder: 20, description: '歴代の殿堂カードを発表日ごとに見られます。' },
  { id: 'premium-hall-zukan', title: 'プレミアム殿堂図鑑', href: '/zukan?tab=hall-of-fame', category: 'view' as const, sortOrder: 30, description: '歴代のプレミアム殿堂カードを確認できます。' },
] as const
