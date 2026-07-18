export type MakerCard = {
  id: string
  name: string
  cardNumber?: string
  rarity?: string | null
  searchText?: string
  imageUrl: string | null
  civilization: string[]
  cost: number | null
  cardType: string | null
  badge?: { label: string; value: string; className: string }
}

export type MakerGroup = {
  key: string
  label: string
  color: string
}

export type MakerProjectConfig = {
  groups: MakerGroup[]
  unrated: boolean
  allowDuplicates: boolean
  ordered: boolean
  overwrite: boolean
  maxChoices: number | null
}

export type SelectMakerConfig = {
  description: string
  minChoices: number
  maxChoices: number
  exactChoices: boolean
  reorderable: boolean
  duplicateRule: 'card_id' | 'card_name'
  cardPool: 'all' | 'manual'
  resultTitle: string
  showTitle: boolean
  showComment: boolean
  defaultTitle: string
  defaultComment: string
  showSubmissions: boolean
  showAggregates: boolean
  showZeroVotes: boolean
  autoRegisterOnImageSave: boolean
  defaultListPublic: boolean
  shareText: string
  hashtag: string
}

export function parseSelectMakerConfig(value: unknown): SelectMakerConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('企画configが不正です')
  const raw = value as Record<string, unknown>
  const minChoices = Number(raw.minChoices)
  const maxChoices = Number(raw.maxChoices)
  if (!Number.isInteger(minChoices) || !Number.isInteger(maxChoices) || minChoices < 1 || maxChoices < minChoices || maxChoices > 12) {
    throw new Error('SELECT型の選択枚数が不正です')
  }
  const text = (key: string, fallback = '') => typeof raw[key] === 'string' ? String(raw[key]).trim() : fallback
  return {
    description: text('description'), minChoices, maxChoices, exactChoices: raw.exactChoices !== false,
    reorderable: raw.reorderable !== false, duplicateRule: raw.duplicateRule === 'card_id' ? 'card_id' : 'card_name',
    cardPool: raw.cardPool === 'manual' ? 'manual' : 'all', resultTitle: text('resultTitle', 'カード選択結果'),
    showTitle: raw.showTitle !== false, showComment: raw.showComment !== false,
    defaultTitle: text('defaultTitle', '私のカード選択'), defaultComment: text('defaultComment'),
    showSubmissions: raw.showSubmissions !== false, showAggregates: raw.showAggregates !== false,
    showZeroVotes: raw.showZeroVotes === true, autoRegisterOnImageSave: raw.autoRegisterOnImageSave !== false,
    defaultListPublic: raw.defaultListPublic !== false, shareText: text('shareText'), hashtag: text('hashtag'),
  }
}

const DEFAULT_GROUP_COLORS: Record<string, string> = {
  s: 'border-red-300 bg-red-50 text-red-800',
  a: 'border-orange-300 bg-orange-50 text-orange-800',
  b: 'border-amber-300 bg-amber-50 text-amber-800',
  c: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  d: 'border-sky-300 bg-sky-50 text-sky-800',
}

export const TIER_GROUPS: MakerGroup[] = [
  { key: 's', label: 'S', color: DEFAULT_GROUP_COLORS.s },
  { key: 'a', label: 'A', color: DEFAULT_GROUP_COLORS.a },
  { key: 'b', label: 'B', color: DEFAULT_GROUP_COLORS.b },
  { key: 'c', label: 'C', color: DEFAULT_GROUP_COLORS.c },
  { key: 'd', label: 'D', color: DEFAULT_GROUP_COLORS.d },
]

export function parseMakerProjectConfig(value: unknown): MakerProjectConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('企画configが不正です')
  }

  const raw = value as Record<string, unknown>
  if (!Array.isArray(raw.groups) || raw.groups.length === 0) {
    throw new Error('企画configにgroupsがありません')
  }

  const seen = new Set<string>()
  const groups = raw.groups.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`企画configのgroups[${index}]が不正です`)
    }
    const group = item as Record<string, unknown>
    const key = typeof group.key === 'string' ? group.key.trim() : ''
    const label = typeof group.label === 'string' ? group.label.trim() : ''
    if (!/^[a-z0-9_-]+$/i.test(key) || !label || seen.has(key)) {
      throw new Error(`企画configのgroups[${index}]が不正です`)
    }
    seen.add(key)
    return {
      key,
      label,
      color:
        typeof group.color === 'string' && group.color.trim()
          ? group.color.trim()
          : DEFAULT_GROUP_COLORS[key] ?? 'border-slate-300 bg-slate-50 text-slate-800',
    }
  })

  const maxChoices = raw.maxChoices
  if (maxChoices !== undefined && maxChoices !== null && (!Number.isInteger(maxChoices) || Number(maxChoices) < 1)) {
    throw new Error('企画configのmaxChoicesが不正です')
  }

  return {
    groups,
    unrated: raw.unrated !== false,
    allowDuplicates: raw.allowDuplicates === true,
    ordered: raw.ordered !== false,
    overwrite: raw.overwrite !== false,
    maxChoices: maxChoices == null ? null : Number(maxChoices),
  }
}

export type MakerDraft = Record<string, string[]>

export type MakerSubmissionMeta = {
  title: string
  comment: string
}

export function makerCommunityLabel(type: string) {
  if (type === 'tier') return 'みんなのTier表'
  if (type === 'selection' || type === 'prediction') return 'みんなの予想'
  if (type === 'ranking') return 'みんなのランキング'
  if (type === 'select') return 'みんなのカード選択'
  return 'みんなの作品'
}

export function emptyMakerDraft(groups: MakerGroup[]): MakerDraft {
  return Object.fromEntries(groups.map(group => [group.key, []]))
}
