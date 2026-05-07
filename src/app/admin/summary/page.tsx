'use client'

import { useState } from 'react'
import Link from 'next/link'

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'manual-' + Date.now()
}

export default function AdminSummaryPage() {
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [submitLog, setSubmitLog] = useState('')
  const [loading, setLoading] = useState(false)

  // 自動生成
  const [genLog, setGenLog] = useState('')
  const [genLoading, setGenLoading] = useState(false)

  const handleTitleChange = (v: string) => {
    setTitle(v)
    if (!slugManual) setSlug(slugify(v))
  }

  const submit = async () => {
    if (!title || !slug) {
      setSubmitLog('タイトル・slugを入力してください')
      return
    }
    setLoading(true)
    setSubmitLog('作成中...')
    try {
      const res = await fetch('/api/admin/summary/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, slug }),
      })
      const json = await res.json()
      if (json.ok) {
        setSubmitLog(`✅ 作成完了！ → /summary/${json.slug}`)
        setTitle(''); setSlug(''); setSlugManual(false)
      } else {
        setSubmitLog(`❌ ${json.error}`)
      }
    } catch (e) {
      setSubmitLog(String(e))
    } finally {
      setLoading(false)
    }
  }

  const generate = async (type: 'weekly' | 'monthly') => {
    setGenLoading(true)
    setGenLog('生成中...')
    try {
      const res = await fetch('/api/admin/summary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const json = await res.json()
      setGenLog(JSON.stringify(json, null, 2))
    } catch (e) {
      setGenLog(String(e))
    } finally {
      setGenLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/admin" className="text-xs text-blue-600 hover:underline">← 管理TOP</Link>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-xs text-gray-600">まとめ管理</span>
        </div>

        {/* ── 手動まとめ作成 ─────────────────────── */}
        <div className="bg-white border border-gray-300 p-5 space-y-4">
          <h1 className="font-bold text-gray-800">✏️ 手動まとめを作成</h1>
          <p className="text-xs text-gray-500">
            タイトルとslugを入力するだけで作成できます。<br />
            スレッドは自動的におすすめスレ（投稿数TOP10）が使われます。<br />
            作成したまとめは /summary/[slug] に公開され、トップページにも表示されます。
          </p>

          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-600 block mb-0.5">タイトル</label>
              <input
                type="text"
                value={title}
                onChange={e => handleTitleChange(e.target.value)}
                placeholder="例：デュエマ 高額カードまとめ2025"
                className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-0.5">
                slug（URL: /summary/<span className="text-blue-600">{slug || 'xxxx'}</span>）
              </label>
              <input
                type="text"
                value={slug}
                onChange={e => { setSlug(e.target.value); setSlugManual(true) }}
                placeholder="例：koukaku-card-2025"
                className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
              />
              <p className="text-[11px] text-gray-400 mt-0.5">小文字英数字とハイフンのみ</p>
            </div>
          </div>

          <button
            onClick={submit}
            disabled={loading}
            className="px-5 py-2 text-sm text-white disabled:opacity-50"
            style={{ background: '#0d6efd' }}
          >
            {loading ? '作成中...' : 'まとめを作成・公開'}
          </button>

          {submitLog && (
            <p className={`text-xs ${submitLog.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>
              {submitLog}
            </p>
          )}
        </div>

        {/* ── 自動生成 ─────────────────────── */}
        <div className="bg-white border border-gray-300 p-5 space-y-4">
          <h2 className="font-bold text-gray-800">🔄 自動まとめを手動生成</h2>
          <p className="text-xs text-gray-500">
            直近データからTOP5を集計します。同じ期間が既に存在する場合はスキップ（キャッシュ更新のみ）。
          </p>
          <div className="flex gap-3">
            <button onClick={() => generate('weekly')} disabled={genLoading}
              className="px-4 py-2 text-sm text-white disabled:opacity-50" style={{ background: '#0d6efd' }}>
              {genLoading ? '処理中...' : '週次を生成'}
            </button>
            <button onClick={() => generate('monthly')} disabled={genLoading}
              className="px-4 py-2 text-sm text-white disabled:opacity-50" style={{ background: '#198754' }}>
              {genLoading ? '処理中...' : '月次を生成'}
            </button>
          </div>
          {genLog && (
            <pre className="text-xs bg-gray-50 border border-gray-200 p-3 overflow-x-auto whitespace-pre-wrap">{genLog}</pre>
          )}
        </div>
      </div>
    </div>
  )
}
