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

export function emptyMakerDraft(groups: MakerGroup[]): MakerDraft {
  return Object.fromEntries(groups.map(group => [group.key, []]))
}
