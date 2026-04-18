import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  currentPage: number
  totalPages: number
  searchParams?: Record<string, string | undefined>
}

function buildHref(page: number, searchParams: Record<string, string | undefined>) {
  const params: Record<string, string> = {}
  for (const [k, v] of Object.entries(searchParams)) {
    if (v !== undefined && k !== 'page') params[k] = v
  }
  if (page !== 1) params.page = String(page)
  const str = new URLSearchParams(params).toString()
  return str ? `/?${str}` : '/'
}

export function Pagination({ currentPage, totalPages, searchParams = {} }: Props) {
  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  const base = 'min-w-[2rem] h-8 px-2 rounded text-sm font-medium border flex items-center justify-center'
  const inactive = 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-700'
  const disabled = 'bg-white text-gray-300 border-gray-200 pointer-events-none select-none'

  return (
    <nav aria-label="ページネーション" className="flex items-center justify-center gap-1 flex-wrap py-2">
      {currentPage === 1 ? (
        <span className={`${base} ${disabled}`} aria-disabled="true" aria-label="前のページ">
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </span>
      ) : (
        <Link href={buildHref(currentPage - 1, searchParams)} className={`${base} ${inactive}`} aria-label="前のページ">
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </Link>
      )}

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-1 text-gray-600 text-sm" aria-hidden="true">…</span>
        ) : p === currentPage ? (
          <span
            key={p}
            className={`${base} text-white border-transparent`}
            style={{ backgroundColor: 'var(--header-bg)', borderColor: 'var(--header-bg)' }}
            aria-current="page"
            aria-label={`${p}ページ目（現在のページ）`}
          >
            {p}
          </span>
        ) : (
          <Link
            key={p}
            href={buildHref(p as number, searchParams)}
            className={`${base} ${inactive}`}
            aria-label={`${p}ページ目`}
          >
            {p}
          </Link>
        )
      )}

      {currentPage === totalPages ? (
        <span className={`${base} ${disabled}`} aria-disabled="true" aria-label="次のページ">
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </span>
      ) : (
        <Link href={buildHref(currentPage + 1, searchParams)} className={`${base} ${inactive}`} aria-label="次のページ">
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      )}
    </nav>
  )
}
