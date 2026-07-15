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
  is_published?: boolean
  show_in_nav?: boolean
}

export const primarySystemNavigation = [
  { key: 'ranking', managementSlug: 'nav-ranking', label: 'ランキング', href: '/ranking' },
  { key: 'tier-maker', managementSlug: 'nav-tier-maker', label: 'Tier表メーカー', href: '/makers/dm26-ex2-charisma-best-tier' },
  { key: 'hall-release-maker', managementSlug: 'nav-hall-release', label: '殿堂解除選手権', href: '/makers/hall-of-fame-release' },
  { key: 'zukan', managementSlug: 'nav-zukan', label: '思い出図鑑', href: '/zukan' },
  { key: 'zukan-articles', managementSlug: 'nav-zukan-articles', label: '記事一覧', href: '/zukan/articles' },
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
  const managedSystemSlugs = new Set(primarySystemNavigation.map(item => item.managementSlug))
  const usesManagedSystemPages = fixedPages.some(page => managedSystemSlugs.has(page.slug))
  const publicNavPages = fixedPages.filter(page => page.is_published !== false && page.show_in_nav !== false)
  const visiblePages = hideNewProduct ? publicNavPages.filter(page => !isNewProductPage(page)) : publicNavPages
  const [leadingPage, ...remainingPages] = visiblePages
  const toItem = (page: FixedNavigationSource): PrimaryNavigationItem => ({
    key: String(page.id),
    label: page.nav_label || page.title,
    href: page.external_url || `/${page.slug}`,
    external: Boolean(page.external_url),
  })

  if (usesManagedSystemPages) return visiblePages.map(toItem)

  return [
    ...(leadingPage ? [toItem(leadingPage)] : []),
    ...primarySystemNavigation.map(item => ({
      key: item.key,
      label: item.label,
      href: item.href,
    })),
    ...remainingPages.map(toItem),
  ]
}
