'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function AdminSummaryPage() {
  const [log, setLog] = useState('')
  const [loading, setLoading] = useState(false)

  const generate = async (type: 'weekly' | 'monthly') => {
    setLoading(true)
    setLog('生成中...')
    try {
      const res = await fetch('/api/admin/summary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const json = await res.json()
      setLog(JSON.stringify(json, null, 2))
    } catch (e) {
      setLog(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-3 flex items-center gap-2">
          <Link href="/admin" className="text-xs text-blue-600 hover:underline">← 管理TOP</Link>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-xs text-gray-600">まとめ記事の生成</span>
        </div>

        <div className="bg-white border border-gray-300 p-5 space-y-4">
          <h1 className="font-bold text-gray-800">📊 まとめ記事の生成</h1>

          <p className="text-xs text-gray-500">
            ボタンを押すと直近の投稿データからTOP5を集計してまとめを生成します。<br />
            同じ期間のまとめが既に存在する場合はスキップされます（キャッシュは更新）。
          </p>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => generate('weekly')}
              disabled={loading}
              className="px-4 py-2 text-sm text-white disabled:opacity-50"
              style={{ background: '#0d6efd' }}
            >
              {loading ? '処理中...' : '週次まとめを生成'}
            </button>
            <button
              onClick={() => generate('monthly')}
              disabled={loading}
              className="px-4 py-2 text-sm text-white disabled:opacity-50"
              style={{ background: '#198754' }}
            >
              {loading ? '処理中...' : '月次まとめを生成'}
            </button>
          </div>

          {log && (
            <pre className="text-xs bg-gray-50 border border-gray-200 p-3 overflow-x-auto whitespace-pre-wrap">
              {log}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
