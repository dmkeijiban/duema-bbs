export type PrimaryNavigationItem = {
  key: string
  label: string
  href: string
  external?: boolean
}

export const primarySystemNavigation: PrimaryNavigationItem[] = [
  { key: 'ranking', label: 'ランキング', href: '/ranking' },
  { key: 'tier-maker', label: 'Tier表メーカー', href: '/makers/dm26-ex2-charisma-best-tier' },
  { key: 'hall-release-maker', label: '殿堂解除選手権', href: '/makers/hall-of-fame-release' },
  { key: 'zukan', label: '思い出図鑑', href: '/zukan' },
  { key: 'zukan-articles', label: '記事一覧', href: '/zukan/articles' },
]
