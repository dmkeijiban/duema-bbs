import Link from 'next/link'
import { Category } from '@/types'
import { CategoryDropdown } from './CategoryDropdown'

interface Props {
  currentSort: string
  currentCategory?: string
  categories: Category[]
}

const TABS = [
  { label: '更新順', sort: 'recent',  icon: '↺', short: '更新'  },
  { label: '新着',   sort: 'new',     icon: '⏱', short: '新着'  },
  { label: '人気',   sort: 'popular', icon: '📊', short: '人気'  },
  { label: 'ランダム', sort: 'random', icon: '🎲', short: 'ランダ' },
]

export function SortTabs({ currentSort, currentCategory, categories }: Props) {
  const base = currentCategory ? `/?category=${currentCategory}&` : '/?'

  return (
    <div className="max-w-screen-xl mx-auto px-2">
      <ul className="flex mb-3 mt-2" role="tablist" style={{ borderBottom: '1px solid #dee2e6' }}>
        {TABS.map((tab) => {
          const active = currentSort === tab.sort
          return (
            <li key={tab.sort} className="flex-1 min-w-0" role="presentation">
              <Link
                href={`${base}sort=${tab.sort}`}
                role="tab"
                aria-selected={active}
                className="w-full text-center py-2 font-medium border border-transparent select-none overflow-hidden text-xs md:text-sm flex items-center justify-center gap-0.5"
                style={
                  active
                    ? { background: '#2563eb', color: '#fff', borderColor: '#2563eb', borderRadius: '4px 4px 0 0', marginBottom: -1, display: 'flex' }
                    : { color: '#2563eb', display: 'flex' }
                }
              >
                <span className="opacity-80">{tab.icon}</span>
                <span className="hidden md:inline">{tab.label}</span>
                <span className="md:hidden">{tab.short}</span>
              </Link>
            </li>
          )
        })}
        <CategoryDropdown currentCategory={currentCategory} categories={categories} />
      </ul>
    </div>
  )
}
