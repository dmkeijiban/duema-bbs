import Link from 'next/link'
import Image from 'next/image'
import { HeaderSearch } from './HeaderSearch'
import { HeaderAuthNav } from './HeaderAuthNav'
import { MobileMenu } from './MobileMenu'
import { HeaderHomeLink } from './HeaderHomeLink'
import { getCachedNavPages } from '@/lib/cached-queries'
import { ADSENSE_REVIEW_MODE } from '@/lib/adsense-review-mode'

const HIDE_FROM_NAV = new Set(['terms', 'privacy', 'contact', 'settings'])

type HeaderNavItem = {
  key: string
  label: string
  href: string
  external?: boolean
}

type NavPage = Awaited<ReturnType<typeof getCachedNavPages>>[number]

function pageLabel(page: NavPage) {
  return page.nav_label || page.title
}

function pageHref(page: NavPage) {
  return page.external_url || `/${page.slug}`
}

function isNewProductPage(page: NavPage) {
  const text = `${page.slug} ${pageLabel(page)}`.toLowerCase()
  return text.includes('新商品') || text.includes('新着品') || text.includes('new-cards') || text.includes('dmsaishin')
}

function isYoutubePage(page: NavPage) {
  const text = `${page.slug} ${pageLabel(page)} ${page.external_url ?? ''}`.toLowerCase()
  return text.includes('youtube') || text.includes('youtu.be')
}

function isGuidePage(page: NavPage) {
  const text = `${page.slug} ${pageLabel(page)}`.toLowerCase()
  return text.includes('guide') || text.includes('使い方')
}

function buildHeaderNavItems(navPages: NavPage[]): HeaderNavItem[] {
  const visiblePages = ADSENSE_REVIEW_MODE ? navPages.filter(p => !isNewProductPage(p)) : navPages
  const remaining = [...visiblePages]
  const take = (matcher: (page: NavPage) => boolean) => {
    const index = remaining.findIndex(matcher)
    return index >= 0 ? remaining.splice(index, 1)[0] : null
  }
  const toItem = (page: NavPage): HeaderNavItem => ({
    key: String(page.id),
    label: pageLabel(page),
    href: pageHref(page),
    external: Boolean(page.external_url),
  })

  const newProduct = take(isNewProductPage)
  const youtube = take(isYoutubePage)
  const guide = take(isGuidePage)

  return [
    newProduct ? toItem(newProduct) : null,
    { key: 'ranking', label: 'ランキング', href: '/ranking' },
    { key: 'zukan', label: '思い出図鑑', href: '/zukan' },
    youtube ? toItem(youtube) : null,
    guide ? toItem(guide) : null,
    ...remaining.map(toItem),
  ].filter((item): item is HeaderNavItem => item !== null)
}

export async function Header() {
  const allNavPages = await getCachedNavPages()
  const navPages = allNavPages.filter(p => !HIDE_FROM_NAV.has(p.slug))
  const navItems = buildHeaderNavItems(navPages)

  return (
    <header className="bg-white border-b border-gray-300 sticky top-0 z-50">
      <nav className="w-full relative">
        <div className="max-w-screen-xl mx-auto px-2 flex items-center gap-2" style={{ minHeight: 46 }}>
          {/* ロゴ */}
          <HeaderHomeLink className="shrink-0 py-1 flex items-center gap-2 leading-tight">
            <Image src="/logo.jpg" alt="デュエマ掲示板" width={32} height={32} className="rounded-sm" priority />
            <div className="flex flex-col">
              <span className="font-bold text-lg" style={{ color: '#1a3a6e', lineHeight: 1.1 }}>デュエマ掲示板</span>
              <span className="text-[10px] text-gray-600" style={{ lineHeight: 1.2 }}>デュエル・マスターズ専門掲示板</span>
            </div>
          </HeaderHomeLink>

          {/* ハンバーガー（モバイル） */}
          <MobileMenu navItems={navItems} />

          {/* PC ナビ */}
          <div className="hidden md:flex items-center flex-1 min-w-0 gap-2">
            <ul className="flex items-center justify-evenly flex-1 text-sm text-gray-700">
              {navItems.map(item => (
                <li key={item.key}>
                  {item.external ? (
                    <a href={item.href} target="_blank" rel="noopener noreferrer"
                      className="px-2 py-3 block whitespace-nowrap transition-colors duration-100 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                      {item.label}
                    </a>
                  ) : (
                    <Link href={item.href} className="px-2 py-3 block whitespace-nowrap transition-colors duration-100 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            <HeaderSearch />
            <HeaderAuthNav variant="desktop" />
          </div>
        </div>
      </nav>
    </header>
  )
}
