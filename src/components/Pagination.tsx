'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  currentPage: number
  totalPages: number
}

export function Pagination({ currentPage, totalPages }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  if (totalPages <= 1) return null

  const go = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (page === 1) {
      params.delete('page')
    } else {
      params.set('page', String(page))
    }
    router.push(`/?${params.toString()}`)
  }

  const pages: (number | '...')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  const btnBase = 'min-w-[2rem] h-8 px-2 rounded text-sm font-medium transition-colors border'
  const btnActive = 'text-white border-transparent'
  const btnInactive = 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-700'
  const btnDisabled = 'bg-white text-gray-300 border-gray-200 cursor-not-allowed'

  return (
    <div className="flex items-center justify-center gap-1 flex-wrap py-2">
      <button
        onClick={() => go(currentPage - 1)}
        disabled={currentPage === 1}
        className={`${btnBase} ${currentPage === 1 ? btnDisabled : btnInactive}`}
      >
        <ChevronLeft className="w-4 h-4 mx-auto" />
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-1 text-gray-400 text-sm">…</span>
        ) : (
          <button
            key={p}
            onClick={() => go(p as number)}
            className={`${btnBase} ${p === currentPage ? btnActive : btnInactive}`}
            style={p === currentPage ? { backgroundColor: 'var(--header-bg)', borderColor: 'var(--header-bg)' } : {}}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => go(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`${btnBase} ${currentPage === totalPages ? btnDisabled : btnInactive}`}
      >
        <ChevronRight className="w-4 h-4 mx-auto" />
      </button>
    </div>
  )
}
