import Link from 'next/link'
import Image from 'next/image'
import { HeaderSearch } from './HeaderSearch'
import { MobileMenu } from './MobileMenu'
import { getCachedNavPages } from '@/lib/cached-queries'

export async function Header() {
  const navPages = await getCachedNavPages()

  return (
    <header className="bg-white border-b border-gray-300 sticky top-0 z-50">
      <nav className="w-full relative">
        <div className="max-w-screen-xl mx-auto px-2 flex items-center gap-2" style={{ minHeight: 46 }}>
          {/* ロゴ */}
          <Link href="/" className="shrink-0 py-1 flex items-center gap-2 leading-tight">
            <Image src="/logo.jpg" alt="デュエマ掲示板" width={32} height={32} className="rounded-sm" priority />
            <div className="flex flex-col">
              <span className="font-bold text-lg" style={{ color: '#1a3a6e', lineHeight: 1.1 }}>デュエマ掲示板</span>
              <span className="text-[10px] text-gray-600" style={{ lineHeight: 1.2 }}>デュエル・マスターズ専門掲示板</span>
            </div>
          </Link>

          {/* ハンバーガー（モバイル） */}
          <MobileMenu navPages={navPages} />

          {/* PC ナビ */}
          <div className="hidden md:flex items-center flex-1 min-w-0 gap-2">
            <ul className="flex items-center justify-evenly flex-1 text-sm text-gray-700">
              {navPages.map(p => (
                <li key={p.id}>
                  {p.external_url ? (
                    <a href={p.external_url} target="_blank" rel="noopener noreferrer"
                      className="px-2 py-3 block hover:text-blue-600 whitespace-nowrap">
                      {p.nav_label || p.title}
                    </a>
                  ) : (
                    <Link href={`/${p.slug}`} className="px-2 py-3 block hover:text-blue-600 whitespace-nowrap">
                      {p.nav_label || p.title}
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
