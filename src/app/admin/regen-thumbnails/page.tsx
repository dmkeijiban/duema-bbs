'use client'

import { useState } from 'react'
import { upgradeThreadImages } from './actions'

export default function RegenThumbnailsPage() {
  const [status, setStatus] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const handleRun = async () => {
    if (!confirm('スレッド画像を高解像度版にアップグレードします。続けますか？')) return
    setRunning(true)
    setStatus('処理中...')
    try {
      const result = await upgradeThreadImages()
      setStatus(
        `完了: アップグレード=${result.upgraded}件 / スキップ(既に高解像度)=${result.skipped}件 / 返信画像なし(改善不可)=${result.noPostImage}件`
      )
    } catch {
      setStatus('エラーが発生しました')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-3 py-6 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">🖼 画像アップグレード</h1>
        <a href="/admin" className="text-xs text-gray-500 hover:underline">← 管理画面に戻る</a>
      </div>

      <div className="bg-white border border-gray-200 p-4 mb-4 text-xs text-gray-600 space-y-1.5">
        <p className="font-semibold text-gray-800">何をするのか</p>
        <p>・旧形式で保存された低解像度スレッド画像（max 400px）を、そのスレッドの返信に含まれる高解像度画像（max 1200px）に差し替えます</p>
        <p>・返信に画像がないスレッドは改善できません（元ファイルが残っていないため）</p>
        <p>・既に高解像度パスのスレッドはスキップします</p>
        <p className="font-semibold text-gray-800 pt-1">実行後の効果</p>
        <p>・モーダル拡大時の画質が改善されます</p>
        <p>・一覧サムネは next/image が自動縮小するため速度は変わりません</p>
      </div>

      <button
        onClick={handleRun}
        disabled={running}
        className="w-full py-2 text-white text-sm font-medium disabled:opacity-50"
        style={{ background: running ? '#6c757d' : '#0d6efd' }}
      >
        {running ? '処理中...' : '画像をアップグレードする'}
      </button>

      {status && (
        <p className="mt-3 text-xs text-gray-700 border border-gray-200 bg-gray-50 px-3 py-2 whitespace-pre-wrap">{status}</p>
      )}
    </div>
  )
}
