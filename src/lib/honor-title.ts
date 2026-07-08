// 称号は「累計活動の見える化」。ランキング（今の順位・ポイント）とは別軸の表示。
// ON/OFFは管理画面から site_settings.honor_title_enabled で切り替える
// （cached-queries.ts の getCachedHonorTitleEnabled 参照）。ロジック自体は
// 無効化中も残るので、再度ONにすればすぐ再開できる。

export type HonorTitle = {
  key: string
  icon: string
  label: string
  minPoints: number
}

// 累計ポイントの高い順（0ptのビギナーが必ず最後にマッチするため、常に何かしらの称号が決まる）
export const HONOR_TITLES: readonly HonorTitle[] = [
  { key: 'grand_legend', minPoints: 10000, icon: '👑✨', label: 'グランドレジェンド' },
  { key: 'legend',       minPoints: 6000,  icon: '👑',  label: 'レジェンド' },
  { key: 'master',       minPoints: 3000,  icon: '🔥',  label: 'マスター' },
  { key: 'platinum',     minPoints: 1500,  icon: '💎',  label: 'プラチナ' },
  { key: 'gold',         minPoints: 700,   icon: '⭐',  label: 'ゴールド' },
  { key: 'silver',       minPoints: 300,   icon: '⚔️',  label: 'シルバー' },
  { key: 'bronze',       minPoints: 100,   icon: '🛡️',  label: 'ブロンズ' },
  { key: 'beginner',     minPoints: 0,     icon: '🌱',  label: 'ビギナー' },
]

export function getHonorTitle(points: number): HonorTitle {
  for (const title of HONOR_TITLES) {
    if (points >= title.minPoints) return title
  }
  return HONOR_TITLES[HONOR_TITLES.length - 1]
}

// 次の称号（最高位なら null）
export function getNextHonorTitle(points: number): HonorTitle | null {
  const currentIndex = HONOR_TITLES.findIndex(title => points >= title.minPoints)
  if (currentIndex <= 0) return null
  return HONOR_TITLES[currentIndex - 1]
}

export function getHonorTitleByKey(key: string): HonorTitle | undefined {
  return HONOR_TITLES.find(title => title.key === key)
}
