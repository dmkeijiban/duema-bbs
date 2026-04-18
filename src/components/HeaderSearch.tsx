'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function HeaderSearch() {
  const [q, setQ] = useState('')
  const [archived, setArchived] = useState('')
  const router = useRouter()

  const search = (e: React.FormEvent) => {
    e.preventDefault()
    if (!q.trim()) return
    const params = new URLSearchParams()
    params.set('q', q.trim())
    if (archived === '1') params.set('archived', '1')
    router.push(`/?${params.toString()}`)
  }

  return (
    <form onSubmit={search} className="shrink-0 flex items-center gap-1">
      <label htmlFor="header-search-scope" className="sr-only">スレッド種別</label>
      <select
        id="header-search-scope"
        value={archived}
        onChange={e => setArchived(e.target.value)}
        className="border border-gray-300 text-xs px-1 py-1.5 bg-white text-gray-700"
      >
        <option value="">現行スレ</option>
        <option value="1">過去スレ</option>
      </select>
      <label htmlFor="header-search-input" className="sr-only">検索ワード</label>
      <input
        id="header-search-input"
        type="text"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="検索ワードを入力"
        className="border border-gray-300 text-xs px-2 py-1.5 w-36"
      />
      <button type="submit" className="border border-gray-300 text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200">
        検索
      </button>
    </form>
  )
}
