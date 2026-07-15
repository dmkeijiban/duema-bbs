import Link from 'next/link'
import Image from 'next/image'
import { HeaderSearch } from './HeaderSearch'
import { HeaderAuthNav } from './HeaderAuthNav'
import { MobileMenu } from './MobileMenu'
import { HeaderHomeLink } from './HeaderHomeLink'
import { getCachedNavPages } from '@/lib/cached-queries'
import { ADSENSE_REVIEW_MODE } from '@/lib/adsense-review-mode'
import { buildPrimaryNavigationItems } from '@/lib/primary-navigation'

export async function Header() {
  const navItems = buildPrimaryNavigationItems(await getCachedNavPages(), ADSENSE_REVIEW_MODE)

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
