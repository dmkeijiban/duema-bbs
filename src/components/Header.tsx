import Link from 'next/link'
import { HeaderSearch } from './HeaderSearch'
import { MobileMenu } from './MobileMenu'

const navLinks = [
  { href: '/terms', label: '利用規約' },
  { href: '/contact', label: 'お問い合わせ' },
  { href: '/settings', label: '個人設定' },
  { href: 'https://www.youtube.com/@darekanizatugaku/featured', label: 'YouTube', external: true },
]

export function Header() {
  return (
    <header className="bg-white border-b border-gray-300 sticky top-0 z-50">
      <nav className="w-full relative">
        <div className="max-w-screen-xl mx-auto px-2 flex items-center gap-2" style={{ minHeight: 46 }}>
          {/* ロゴ */}
          <Link href="/" className="shrink-0 py-1 flex flex-col leading-tight">
            <span className="font-bold text-lg" style={{ color: '#1a3a6e', lineHeight: 1.1 }}>デュエマ掲示板</span>
            <span className="text-[10px] text-gray-600" style={{ lineHeight: 1.2 }}>デュエル・マスターズ専門掲示板</span>
          </Link>

          {/* ハンバーガー（モバイル） */}
          <MobileMenu />

          {/* PC ナビ */}
          <div className="hidden md:flex items-center flex-1 min-w-0 gap-2">
            <ul className="flex items-center justify-evenly flex-1 text-sm text-gray-700">
              {navLinks.map(l => (
                <li key={l.href}>
                  {l.external ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer"
                      className="px-2 py-3 block hover:text-blue-600 whitespace-nowrap">
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="px-2 py-3 block hover:text-blue-600 whitespace-nowrap">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            <HeaderSearch />
          </div>
        </div>
      </nav>
    </header>
  )
}
