'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function Header() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [archived, setArchived] = useState('')
  const router = useRouter()

  const search = (e: React.FormEvent) => {
    e.preventDefault()
    if (!q.trim()) return
    const params = new URLSearchParams()
    params.set('q', q.trim())
    if (archived === '1') params.set('archived', '1')
    router.push(`/?${params.toString()}`)
  }

  const navLinks = [
    { href: '/terms', label: '利用規約' },
    { href: '/contact', label: 'お問い合わせ' },
    { href: '/settings', label: '個人設定' },
    { href: 'https://www.youtube.com/@darekanizatugaku/featured', label: 'YouTube', external: true },
  ]

  return (
    <header className="bg-white border-b border-gray-300 sticky top-0 z-50">
      <nav className="w-full">
        <div className="max-w-screen-xl mx-auto px-2 flex items-center gap-2" style={{ minHeight: 46 }}>
          {/* ロゴ */}
          <Link href="/" className="shrink-0 py-1 flex flex-col leading-tight">
            <span className="font-bold text-lg" style={{ color: '#1a3a6e', lineHeight: 1.1 }}>デュエマ掲示板</span>
            <span className="text-[10px] text-gray-400" style={{ lineHeight: 1.2 }}>デュエル・マスターズ専門掲示板</span>
          </Link>

          {/* ハンバーガー（モバイル） */}
          <button
            className="ml-auto md:hidden px-2 py-3 text-gray-600"
            onClick={() => setOpen(v => !v)}
            aria-label="メニュー"
          >
            <span className="block w-5 h-0.5 bg-current mb-1" />
            <span className="block w-5 h-0.5 bg-current mb-1" />
            <span className="block w-5 h-0.5 bg-current" />
          </button>

          {/* PC ナビ */}
          <div className="hidden md:flex items-center flex-1 min-w-0 gap-2">
            {/* 等間隔ナビリンク */}
            <ul className="flex items-center justify-evenly flex-1 text-sm text-gray-700">
              {navLinks.map(l => (
                <li key={l.href}>
                  {l.external ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer"
                      className="px-2 py-3 block hover:text-blue-600 whitespace-nowrap">
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href}
                      className="px-2 py-3 block hover:text-blue-600 whitespace-nowrap">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>

            {/* 検索フォーム */}
            <form onSubmit={search} className="shrink-0 flex items-center gap-1">
              <select
                value={archived}
                onChange={e => setArchived(e.target.value)}
                className="border border-gray-300 text-xs px-1 py-1.5 bg-white text-gray-700"
              >
                <option value="">現行スレ</option>
                <option value="1">過去スレ</option>
              </select>
              <input
                type="text"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="検索ワードを入力"
                className="border border-gray-300 text-xs px-2 py-1.5 w-36"
              />
              <button type="submit"
                className="border border-gray-300 text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200">
                検索
              </button>
            </form>
          </div>
        </div>

        {/* モバイルメニュー */}
        {open && (
          <div className="md:hidden border-t border-gray-200 bg-white text-sm text-gray-700">
            {navLinks.map(l => (
              l.external ? (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"
                  className="block px-4 py-2.5 hover:bg-gray-50">{l.label}</a>
              ) : (
                <Link key={l.href} href={l.href}
                  className="block px-4 py-2.5 hover:bg-gray-50"
                  onClick={() => setOpen(false)}>{l.label}</Link>
              )
            ))}
            <form onSubmit={search} className="flex gap-1 px-4 py-2.5">
              <input
                type="text"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="検索ワード"
                className="border border-gray-300 text-xs px-2 py-1 flex-1"
              />
              <button type="submit" className="border border-gray-300 text-xs px-2 py-1 bg-gray-100">検索</button>
            </form>
          </div>
        )}
      </nav>
    </header>
  )
}
