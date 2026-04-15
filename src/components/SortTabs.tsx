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
  { label: '更新順', sort: 'recent',   icon: '↺', href: (base: string) => `${base}sort=recent` },
  { label: '新着',   sort: 'new',      icon: '⏱', href: (base: string) => `${base}sort=new` },
  { label: '人気',   sort: 'popular',  icon: '📊', href: () => '/ranking' },
  { label: '過去ログ', sort: 'archived', icon: '📂', href: (base: string) => `${base}sort=archived` },
]

export function SortTabs({ currentSort, currentCategory, categories }: Props) {
  const router = useRouter()
  const [activeSort, setActiveSort] = useState(currentSort)
  const [isPending, startTransition] = useTransition()
  const [catOpen, setCatOpen] = useState(false)
  const catRef = useRef<HTMLLIElement>(null)

  const base = currentCategory ? `?category=${currentCategory}&` : '?'

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!catOpen) return
    const handler = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setCatOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [catOpen])

  const handleClick = (tab: typeof TABS[number]) => {
    const url = tab.href(base)
    if (tab.sort === activeSort && url !== '/ranking') return
    setActiveSort(tab.sort)
    startTransition(() => {
      router.push(url)
    })
  }

  return (
    <div className="max-w-screen-xl mx-auto px-2">
      <ul className="flex mb-3 mt-2 text-sm" style={{ borderBottom: '1px solid #dee2e6' }}>
        {TABS.map((tab) => {
          const active = activeSort === tab.sort
          return (
            <li key={tab.sort} className="flex-1">
              <button
                onClick={() => handleClick(tab)}
                className="w-full text-center py-2 font-medium transition-colors border border-transparent select-none"
                style={
                  active
                    ? { background: '#0d6efd', color: '#fff', borderColor: '#0d6efd', borderRadius: '4px 4px 0 0', marginBottom: -1 }
                    : { color: isPending ? '#6c9fef' : '#0d6efd' }
                }
              >
                <span className="mr-0.5 opacity-80 text-xs">{tab.icon}</span>
                <span className="text-xs md:text-sm">{tab.label}</span>
              </button>
            </li>
          )
        })}
        {/* カテゴリドロップダウン（クリック式・スマホ対応） */}
        <li ref={catRef} className="flex-1 relative">
          <button
            onClick={() => setCatOpen(v => !v)}
            className="w-full text-center py-2 font-medium text-xs md:text-sm select-none"
            style={{ color: '#0d6efd' }}
          >
            📂 カテゴリ {catOpen ? '▴' : '▾'}
          </button>
          {catOpen && (
            <div className="absolute right-0 top-full bg-white border border-gray-300 shadow-lg z-50 min-w-max text-sm max-h-64 overflow-y-auto">
              <Link
                href={`/?sort=${activeSort}`}
                className="block px-4 py-2 hover:bg-gray-100 text-gray-700 border-b border-gray-100"
                onClick={() => setCatOpen(false)}
              >
                すべて
              </Link>
              {categories.map(c => (
                <Link
                  key={c.slug}
                  href={`/?category=${c.slug}&sort=${activeSort}`}
                  className="block px-4 py-2 hover:bg-gray-100 text-gray-700 border-b border-gray-100 last:border-b-0"
                  onClick={() => setCatOpen(false)}
                >
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
