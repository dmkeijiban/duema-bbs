export const TOP_SHOWCASE_MODE_VALUES = [
  'profiles',
  'monthly_ranking',
  'overall_ranking',
  'campaign_ranking',
  'recommended',
  'featured_campaign',
  'hidden',
] as const

export type TopShowcaseMode = (typeof TOP_SHOWCASE_MODE_VALUES)[number]

export const DEFAULT_TOP_SHOWCASE_MODE: TopShowcaseMode = 'profiles'

export const TOP_SHOWCASE_MODE_OPTIONS: Array<{ value: TopShowcaseMode; label: string; description: string }> = [
  {
    value: 'profiles',
    label: 'みんなのプロフィール',
    description: '公開プロフィールのアイコンだけを表示します。',
  },
  {
    value: 'monthly_ranking',
    label: '今月の投稿者ランキング TOP10',
    description: '今月の投稿者ランキングを順位・ptつきで表示します。',
  },
  {
    value: 'overall_ranking',
    label: '総合投稿者ランキング TOP10',
    description: '総合投稿者ランキングを順位・ptつきで表示します。',
  },
  {
    value: 'campaign_ranking',
    label: 'キャンペーンランキング',
    description: '開催中または終了済みキャンペーンのランキングを表示します。',
  },
  {
    value: 'recommended',
    label: 'おすすめ',
    description: 'おすすめスレッドをトップ上部に表示します。',
  },
  {
    value: 'featured_campaign',
    label: 'TOP注目企画',
    description: '管理画面で設定した企画POP（旧カリスマBEST枠）を表示します。',
  },
  {
    value: 'hidden',
    label: '非表示',
    description: 'トップ上部のshowcase枠を非表示にします。',
  },
]

const TOP_SHOWCASE_MODE_SET = new Set<string>(TOP_SHOWCASE_MODE_VALUES)

export function normalizeTopShowcaseMode(value: string | null | undefined): TopShowcaseMode {
  // 旧カリスマBEST専用モードは汎用の注目企画モードへ読み替える（移行後方互換）
  if (value === 'tier_maker') return 'featured_campaign'
  if (value && TOP_SHOWCASE_MODE_SET.has(value)) return value as TopShowcaseMode
  return DEFAULT_TOP_SHOWCASE_MODE
}
