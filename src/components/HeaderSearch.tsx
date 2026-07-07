'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export function HeaderSearch() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const search = (e: React.FormEvent) => {
    e.preventDefault()
    if (!open) {
      setOpen(true)
      return
    }
    if (!q.trim()) {
      inputRef.current?.focus()
      return
    }
    router.push(`/?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <form onSubmit={search} className="shrink-0 flex items-center gap-1">
      {open && (
        <>
          <label htmlFor="header-search-input" className="sr-only">検索ワード</label>
          <input
            ref={inputRef}
            id="header-search-input"
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="検索ワードを入力"
            className="w-40 border border-gray-300 px-2 py-1.5 text-xs"
          />
        </>
      )}
      <button type="submit" className="border border-gray-300 text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200">
        検索
      </button>
      {open && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          aria-label="検索欄を閉じる"
        >
          閉じる
        </button>
      )}
    </form>
  )
}
