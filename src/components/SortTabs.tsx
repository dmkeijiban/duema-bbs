'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
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

  const base = currentCategory ? `?category=${currentCategory}&` : '?'

  const handleClick = (sort: string) => {
    if (sort === activeSort) return
    setActiveSort(sort)
    startTransition(() => {
      router.push(`${base}sort=${sort}`)
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
                onClick={() => handleClick(tab.sort)}
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
        {/* カテゴリドロップダウン */}
        <li className="flex-1 relative group">
          <button className="w-full text-center py-2 font-medium text-xs md:text-sm" style={{ color: '#0d6efd' }}>
            📂 カテゴリ ▾
          </button>
          <div className="hidden group-hover:block absolute right-0 top-full bg-white border border-gray-300 shadow-lg z-50 min-w-max text-sm">
            <Link href={`/?sort=${activeSort}`} className="block px-4 py-1.5 hover:bg-gray-100 text-gray-700">すべて</Link>
            {categories.map(c => (
              <Link key={c.slug} href={`/?category=${c.slug}&sort=${activeSort}`}
                className="block px-4 py-1.5 hover:bg-gray-100 text-gray-700">
                {c.name}
              </Link>
            ))}
          </div>
        </li>
      </ul>
    </div>
  )
}
