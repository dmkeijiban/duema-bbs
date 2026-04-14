import Link from 'next/link'
import { Swords } from 'lucide-react'

export function Header() {
  return (
    <header className="sticky top-0 z-50 shadow-md" style={{ backgroundColor: 'var(--header-bg)' }}>
      <div className="max-w-6xl mx-auto px-3 h-11 flex items-center justify-between gap-4">
        {/* ロゴ */}
        <Link
          href="/"
          className="flex items-center gap-1.5 font-bold text-base text-white hover:opacity-85 transition-opacity shrink-0"
        >
          <Swords className="w-5 h-5 text-yellow-300" />
          <span>デュエルBBS</span>
        </Link>

        {/* ナビ */}
        <nav className="hidden sm:flex items-center gap-0.5 text-sm text-blue-100">
          <Link href="/" className="px-3 py-1.5 rounded hover:bg-white/10 transition-colors whitespace-nowrap">
            トップ
          </Link>
          <Link href="/?sort=popular" className="px-3 py-1.5 rounded hover:bg-white/10 transition-colors whitespace-nowrap">
            人気
          </Link>
          <Link href="/favorites" className="px-3 py-1.5 rounded hover:bg-white/10 transition-colors whitespace-nowrap">
            お気に入り
          </Link>
        </nav>

        {/* スレ立てボタン */}
        <Link
          href="/thread/new"
          className="shrink-0 text-sm font-bold text-white px-4 py-1.5 rounded transition-colors whitespace-nowrap"
          style={{ backgroundColor: '#e67e22' }}
        >
          スレを立てる
        </Link>
      </div>
    </header>
  )
}
