'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Category } from '@/types'

interface Props {
  categories: Category[]
}

export function CategoryFilter({ categories }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get('category') ?? 'all'

  const select = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (slug === 'all') {
      params.delete('category')
    } else {
      params.set('category', slug)
    }
    params.delete('page')
    router.push(`/?${params.toString()}`)
  }

  const tabs = [
    { id: 'all', name: 'すべて', color: '#64748b' },
    ...categories.map(c => ({ id: c.slug, name: c.name, color: c.color })),
  ]

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tabs.map(tab => {
        const isActive = current === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => select(tab.id)}
            className="px-3 py-1 rounded text-xs font-medium transition-all border"
            style={
              isActive
                ? { backgroundColor: tab.color, color: '#fff', borderColor: tab.color }
                : { backgroundColor: '#fff', color: '#555', borderColor: '#ccc' }
            }
          >
            {tab.name}
          </button>
        )
      })}
    </div>
  )
}
