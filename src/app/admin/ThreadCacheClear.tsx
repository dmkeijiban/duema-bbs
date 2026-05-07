'use client'

import { useState } from 'react'

export function ThreadCacheClear() {
  const [threadId, setThreadId] = useState('')
  const [log, setLog] = useState('')
  const [loading, setLoading] = useState(false)

  const handleClear = async () => {
    const id = parseInt(threadId)
    if (!id) { setLog('スレッドIDを入力してください'); return }
    setLoading(true)
    setLog('クリア中...')
    try {
      const res = await fetch('/api/admin/cache/revalidate-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: id }),
      })
      const json = await res.json()
      if (json.ok) setLog(`✅ スレッド ${id} のキャッシュをクリアしました`)
      else setLog(`❌ ${json.error}`)
    } catch (e) {
      setLog(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-300 p-3 mb-4">
      <h2 className="font-bold text-gray-700 mb-2 text-sm">🗑 スレッドキャッシュクリア</h2>
      <p className="text-xs text-gray-500 mb-2">コメントが表示されないなど、キャッシュ起因の問題を修正します。</p>
      <div className="flex gap-2 items-center">
        <input
          type="number"
          value={threadId}
          onChange={e => setThreadId(e.target.value)}
          placeholder="スレッドID（例：14）"
          className="border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 w-40"
        />
        <button
          onClick={handleClear}
          disabled={loading}
          className="px-3 py-1.5 text-sm text-white disabled:opacity-50"
          style={{ background: '#dc3545' }}
        >
          {loading ? '処理中...' : 'キャッシュクリア'}
        </button>
      </div>
      {log && (
        <p className={`text-xs mt-1 ${log.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>{log}</p>
      )}
    </div>
  )
}
