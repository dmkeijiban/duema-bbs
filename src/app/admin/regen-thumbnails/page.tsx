'use client'

import { useState } from 'react'
import { regenThumbnails } from './actions'

export default function RegenThumbnailsPage() {
  const [status, setStatus] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const handleRun = async () => {
    if (!confirm('すべてのサムネを再処理します。時間がかかる場合があります。続けますか？')) return
    setRunning(true)
    setStatus('処理中...')
    try {
      const result = await regenThumbnails()
      setStatus(`完了: 更新=${result.updated}件, スキップ=${result.skipped}件, エラー=${result.errors}件`)
    } catch {
      setStatus('エラーが発生しました')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-3 py-6 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">🖼 サムネ再生成</h1>
        <a href="/admin" className="text-xs text-gray-500 hover:underline">← 管理画面に戻る</a>
      </div>

      <div className="bg-white border border-gray-200 p-4 mb-4 text-xs text-gray-600 space-y-1">
        <p>・スレッドに添付された画像を再ダウンロードして高解像度で再処理します</p>
        <p>・<code>posts/</code>パスの画像（レスから自動設定されたもの）はスキップします</p>
        <p>・元画像が極端に小さい場合は改善されないことがあります</p>
        <p>・スレッド数が多い場合は数分かかることがあります</p>
      </div>

      <button
        onClick={handleRun}
        disabled={running}
        className="w-full py-2 text-white text-sm font-medium disabled:opacity-50"
        style={{ background: running ? '#6c757d' : '#0d6efd' }}
      >
        {running ? '処理中...' : 'サムネを再生成する'}
      </button>

      {status && (
        <p className="mt-3 text-xs text-gray-700 border border-gray-200 bg-gray-50 px-3 py-2">{status}</p>
      )}
    </div>
  )
}
