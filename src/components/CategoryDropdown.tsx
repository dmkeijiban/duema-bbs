'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Category } from '@/types'

interface Props {
  currentCategory?: string
  categories: Category[]
}

export function CategoryDropdown({ currentCategory, categories }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <li ref={ref} className="flex-1 min-w-0 relative">
      <button
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="カテゴリを選択"
        className="w-full text-center py-2 font-medium select-none overflow-hidden text-xs md:text-sm"
        style={{ color: '#2563eb' }}
      >
        <span className="opacity-80">📂</span>
        <span className="ml-0.5 hidden md:inline">カテゴリ {open ? '▴' : '▾'}</span>
        <span className="ml-0.5 md:hidden">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="カテゴリ一覧"
          className="absolute right-0 top-full bg-white border border-gray-300 shadow-lg z-50 min-w-max text-sm max-h-64 overflow-y-auto"
        >
          <Link
            href={currentCategory ? '/' : '/'}
            role="option"
            aria-selected={!currentCategory}
            className="block px-4 py-2 hover:bg-gray-100 text-gray-700 border-b border-gray-100"
            onClick={() => setOpen(false)}
          >
            すべて
          </Link>
          {categories.map(c => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              role="option"
              aria-selected={currentCategory === c.slug}
              className="block px-4 py-2 hover:bg-gray-100 text-gray-700 border-b border-gray-100 last:border-b-0"
              onClick={() => setOpen(false)}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}
    </li>
  )
}
