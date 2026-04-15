'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Category } from '@/types'

interface Props {
  currentSort: string
  currentCategory?: string
  categories: Category[]
}

const TABS = [
  { label: '更新順', sort: 'recent',   icon: '↺' },
  { label: '新着',   sort: 'new',      icon: '⏱' },
  { label: '人気',   sort: 'popular',  icon: '📊' },
  { label: '過去ログ', sort: 'archived', icon: '📂' },
]

export function SortTabs({ currentSort, currentCategory, categories }: Props) {
  const router = useRouter()
  const [activeSort, setActiveSort] = useState(currentSort)
  const [isPending, startTransition] = useTransition()
  const [catOpen, setCatOpen] = useState(false)
  const catRef = useRef<HTMLLIElement>(null)

  const base = currentCategory ? `?category=${currentCategory}&` : '?'

  useEffect(() => {
    if (!catOpen) return
    const handler = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [catOpen])

  const handleClick = (sort: string) => {
    if (sort === activeSort) return
    setActiveSort(sort)
    startTransition(() => {
      router.push(`${base}sort=${sort}`)
    })
  }

  return (
    <div className="max-w-screen-xl mx-auto px-2">
      <ul className="flex mb-3 mt-2" style={{ borderBottom: '1px solid #dee2e6' }}>
        {TABS.map((tab) => {
          const active = activeSort === tab.sort
          return (
            <li key={tab.sort} className="flex-1 min-w-0">
              <button
                onClick={() => handleClick(tab.sort)}
                className="w-full text-center py-2 font-medium border border-transparent select-none overflow-hidden"
                style={
                  active
                    ? { background: '#0d6efd', color: '#fff', borderColor: '#0d6efd', borderRadius: '4px 4px 0 0', marginBottom: -1, fontSize: 11 }
                    : { color: isPending ? '#6c9fef' : '#0d6efd', fontSize: 11 }
                }
              >
                <span className="opacity-80">{tab.icon}</span>
                <span className="ml-0.5 hidden md:inline">{tab.label}</span>
                {/* スマホ: 短縮ラベル */}
                <span className="ml-0.5 md:hidden text-[10px]">
                  {tab.sort === 'recent' ? '更新' : tab.sort === 'new' ? '新着' : tab.sort === 'popular' ? '人気' : '過去'}
                </span>
              </button>
            </li>
          )
        })}
        {/* カテゴリドロップダウン */}
        <li ref={catRef} className="flex-1 min-w-0 relative">
          <button
            onClick={() => setCatOpen(v => !v)}
            className="w-full text-center py-2 font-medium select-none overflow-hidden"
            style={{ color: '#0d6efd', fontSize: 11 }}
          >
            <span className="opacity-80">📂</span>
            <span className="ml-0.5 hidden md:inline">カテゴリ {catOpen ? '▴' : '▾'}</span>
            <span className="ml-0.5 md:hidden text-[10px]">{catOpen ? '▴' : '▾'}</span>
          </button>
          {catOpen && (
            <div className="absolute right-0 top-full bg-white border border-gray-300 shadow-lg z-50 min-w-max text-sm max-h-64 overflow-y-auto">
              <Link href="/" className="block px-4 py-2 hover:bg-gray-100 text-gray-700 border-b border-gray-100" onClick={() => setCatOpen(false)}>
                すべて
              </Link>
              {categories.map(c => (
                <Link key={c.slug} href={`/?category=${c.slug}`} className="block px-4 py-2 hover:bg-gray-100 text-gray-700 border-b border-gray-100 last:border-b-0" onClick={() => setCatOpen(false)}>
                  {c.name}
                </Link>
              ))}
            </div>
          )}
        </li>
      </ul>
    </div>
  )
}
