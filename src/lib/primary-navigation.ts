export type PrimaryNavigationItem = {
  key: string
  label: string
  href: string
  external?: boolean
}

export type FixedNavigationSource = {
  id: number | string
  title: string
  slug: string
  nav_label: string | null
  external_url: string | null
}

export const primarySystemNavigation: PrimaryNavigationItem[] = [
  { key: 'ranking', label: 'ランキング', href: '/ranking' },
  { key: 'tier-maker', label: 'Tier表メーカー', href: '/makers/dm26-ex2-charisma-best-tier' },
  { key: 'hall-release-maker', label: '殿堂解除選手権', href: '/makers/hall-of-fame-release' },
  { key: 'zukan', label: '思い出図鑑', href: '/zukan' },
  { key: 'zukan-articles', label: '記事一覧', href: '/zukan/articles' },
]

function isNewProductPage(page: FixedNavigationSource) {
  const label = page.nav_label || page.title
  const text = `${page.slug} ${label}`.toLowerCase()
  return text.includes('新商品') || text.includes('新着品') || text.includes('new-cards') || text.includes('dmsaishin')
}

export function buildPrimaryNavigationItems(
  fixedPages: FixedNavigationSource[],
  hideNewProduct = false,
): PrimaryNavigationItem[] {
  const visiblePages = hideNewProduct ? fixedPages.filter(page => !isNewProductPage(page)) : fixedPages
  const [leadingPage, ...remainingPages] = visiblePages
  const toItem = (page: FixedNavigationSource): PrimaryNavigationItem => ({
    key: String(page.id),
    label: page.nav_label || page.title,
    href: page.external_url || `/${page.slug}`,
    external: Boolean(page.external_url),
  })

  return [
    ...(leadingPage ? [toItem(leadingPage)] : []),
    ...primarySystemNavigation,
    ...remainingPages.map(toItem),
  ]
}
