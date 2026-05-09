'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { NavPage } from '@/types/fixed-pages'

interface Props {
  navPages: NavPage[]
}

export function MobileMenu({ navPages }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const router = useRouter()

  const search = (e: React.FormEvent) => {
    e.preventDefault()
    if (!q.trim()) return
    const params = new URLSearchParams()
    params.set('q', q.trim())
    router.push(`/?${params.toString()}`)
    setOpen(false)
  }

  return (
    <>
      <button
        className="ml-auto md:hidden px-2 py-3 text-gray-600"
        onClick={() => setOpen(v => !v)}
        aria-label="メニュー"
        aria-expanded={open}
      >
        <span className="block w-5 h-0.5 bg-current mb-1" aria-hidden="true" />
        <span className="block w-5 h-0.5 bg-current mb-1" aria-hidden="true" />
        <span className="block w-5 h-0.5 bg-current" aria-hidden="true" />
      </button>

      {open && (
        <div className="md:hidden border-t border-gray-200 bg-white text-sm text-gray-700 absolute top-full left-0 right-0 z-40">
          {navPages.map(p =>
            p.external_url ? (
              <a key={p.id} href={p.external_url} target="_blank" rel="noopener noreferrer"
                className="block px-4 py-2.5 hover:bg-gray-50">{p.nav_label || p.title}</a>
            ) : (
              <Link key={p.id} href={`/${p.slug}`}
                className="block px-4 py-2.5 hover:bg-gray-50"
                onClick={() => setOpen(false)}>{p.nav_label || p.title}</Link>
            )
          )}
          <form onSubmit={search} className="flex gap-1 px-4 py-2.5">
            <label htmlFor="mobile-search-input" className="sr-only">検索ワード</label>
            <input
              id="mobile-search-input"
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
    </>
  )
}
