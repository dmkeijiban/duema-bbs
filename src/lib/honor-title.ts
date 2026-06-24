export type HonorTitle = {
  icon: string
  label: string
  minPoints: number
}

export const HONOR_TITLES: readonly HonorTitle[] = [
  { minPoints: 3000, icon: '🌟', label: '殿堂入り' },
  { minPoints: 1500, icon: '👑', label: 'レジェンド' },
  { minPoints: 800,  icon: '🔷', label: 'ダイヤモンド' },
  { minPoints: 400,  icon: '💎', label: 'プラチナ' },
  { minPoints: 150,  icon: '🟡', label: 'ゴールド' },
  { minPoints: 50,   icon: '⚪', label: 'シルバー' },
  { minPoints: 10,   icon: '🟤', label: 'ブロンズ' },
]

export function getHonorTitle(points: number): HonorTitle | null {
  for (const t of HONOR_TITLES) {
    if (points >= t.minPoints) return t
  }
  return null
}
