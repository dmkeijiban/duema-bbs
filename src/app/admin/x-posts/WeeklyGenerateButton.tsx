'use client'

import { useState } from 'react'
import { generateWeeklyPosts } from './actions'

/** 今日の日付を YYYY-MM-DD で返す（ブラウザの localtime） */
function todayString(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function WeeklyGenerateButton() {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-xs text-white font-medium"
        style={{ background: '#198754' }}
      >
        📅 1週間分を自動生成
      </button>
    )
  }

  return (
    <form
      action={generateWeeklyPosts}
      className="flex items-center gap-2 bg-green-50 border border-green-200 px-3 py-2"
    >
      <span className="text-xs text-gray-700 shrink-0">開始日：</span>
      <input
        type="date"
        name="start_date"
        defaultValue={todayString()}
        className="border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:border-green-400"
        required
      />
      <button
        type="submit"
        className="px-3 py-1 text-xs text-white font-medium shrink-0"
        style={{ background: '#198754' }}
      >
        28件を生成
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="px-2 py-1 text-xs text-gray-500 border border-gray-300 bg-white hover:bg-gray-50 shrink-0"
      >
        キャンセル
      </button>
    </form>
  )
}
