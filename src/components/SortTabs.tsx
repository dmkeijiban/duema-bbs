import Link from 'next/link'
import { Category } from '@/types'
import { CategoryDropdown } from './CategoryDropdown'

interface Props {
  currentSort: string
  currentCategory?: string
  categories: Category[]
  /** カテゴリページで使用。指定すると `/basePath?sort=xxx` 形式のリンクを生成する */
  basePath?: string
  recentHref?: string
  rankingHref?: string
  randomHref?: string
}

const TABS = [
  { label: '更新順一覧', sort: 'recent', icon: '🔄', short: '更新', order: 'order-1' },
  { label: 'ランキング', sort: 'popular', icon: '📊', short: '人気', order: 'order-2' },
  { label: 'ランダム', sort: 'random', icon: '🎲', short: 'ランダム', order: 'order-3' },
]

const ROOT_SORT_HREF: Record<string, string> = {
  recent: '/',
  popular: '/?sort=popular',
  random: '/?sort=random',
}

export function SortTabs({
  currentSort,
  currentCategory,
  categories,
  basePath,
  recentHref = '/',
  rankingHref = ROOT_SORT_HREF.popular,
  randomHref = ROOT_SORT_HREF.random,
}: Props) {
  const getTabHref = (sort: string) => {
    if (basePath) return `${basePath}?sort=${sort}`
    if (currentCategory) return `/category/${currentCategory}?sort=${sort}`
    if (sort === 'recent') return recentHref
    if (sort === 'popular') return rankingHref
    if (sort === 'random') return randomHref
    return ROOT_SORT_HREF[sort] ?? '/'
  }

  return (
    <div className="mx-auto max-w-screen-xl px-2">
      <ul
        className="mb-3 mt-2 grid grid-cols-2 items-center gap-1.5 border-b border-gray-200 pb-1.5 sm:flex sm:flex-wrap"
        role="tablist"
      >
        {TABS.map((tab) => {
          const active = currentSort === tab.sort
          return (
            <li key={tab.sort} className={`shrink-0 ${tab.order} sm:order-none`} role="presentation">
              <Link
                href={getTabHref(tab.sort)}
                role="tab"
                aria-selected={active}
                className={
                  active
                    ? 'flex min-h-9 items-center justify-center gap-1 rounded border border-blue-600 bg-blue-600 px-2.5 text-xs font-bold text-white shadow-sm md:px-3 md:text-sm'
                    : 'flex min-h-9 items-center justify-center gap-1 rounded border border-blue-100 bg-white px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-50 md:px-3 md:text-sm'
                }
              >
                <span className="opacity-80">{tab.icon}</span>
                <span className="hidden md:inline">{tab.label}</span>
                <span className="md:hidden">{tab.short}</span>
              </Link>
            </li>
          )
        })}
        <CategoryDropdown
          currentCategory={currentCategory}
          categories={categories}
          className="order-5 sm:order-none"
        />
        <li className="shrink-0 order-4 sm:order-none" role="presentation">
          <Link
            href="/kakolog"
            role="tab"
            aria-selected={currentSort === 'kakolog'}
            className={
              currentSort === 'kakolog'
                ? 'flex min-h-9 items-center justify-center gap-1 rounded border border-blue-600 bg-blue-600 px-2.5 text-xs font-bold text-white shadow-sm md:px-3 md:text-sm'
                : 'flex min-h-9 items-center justify-center gap-1 rounded border border-blue-100 bg-white px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-50 md:px-3 md:text-sm'
            }
          >
            <span className="opacity-80">🕰️</span>
            <span className="hidden md:inline">過去ログ</span>
            <span className="md:hidden">過去</span>
          </Link>
        </li>
      </ul>
    </div>
  )
}
