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
    <li ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="カテゴリを選択"
        className={
          currentCategory
            ? 'flex min-h-9 w-full items-center justify-center rounded border border-blue-600 bg-blue-600 px-2.5 text-xs font-bold text-white shadow-sm md:px-3 md:text-sm'
            : 'flex min-h-9 w-full items-center justify-center rounded border border-blue-100 bg-white px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-50 md:px-3 md:text-sm'
        }
      >
        <span className="opacity-80">📁</span>
        <span className="ml-0.5 hidden md:inline">カテゴリ {open ? '▴' : '▾'}</span>
        <span className="ml-0.5 md:hidden">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="カテゴリ一覧"
          className="absolute right-0 top-full z-50 mt-1 max-h-64 min-w-44 overflow-y-auto rounded border border-gray-300 bg-white text-sm shadow-lg"
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
