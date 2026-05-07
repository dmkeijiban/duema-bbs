'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'

interface Thread {
  id: number
  title: string
  post_count: number
  image_url: string | null
  categories: { name: string; color: string } | null
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'manual-' + Date.now()
}

export default function AdminSummaryPage() {
  // 手動まとめ作成
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<Thread[]>([])
  const [selected, setSelected] = useState<Thread[]>([])
  const [submitLog, setSubmitLog] = useState('')
  const [loading, setLoading] = useState(false)

  // 自動生成
  const [genLog, setGenLog] = useState('')
  const [genLoading, setGenLoading] = useState(false)

  const handleTitleChange = (v: string) => {
    setTitle(v)
    if (!slugManual) setSlug(slugify(v))
  }

  const search = useCallback(async (q: string) => {
    const res = await fetch(`/api/admin/threads/search?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setSearchResults(data)
  }, [])

  const addThread = (t: Thread) => {
    if (selected.find(s => s.id === t.id)) return
    setSelected(prev => [...prev, t])
  }
  const removeThread = (id: number) => setSelected(prev => prev.filter(t => t.id !== id))
  const moveUp = (i: number) => {
    if (i === 0) return
    setSelected(prev => { const a = [...prev]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a })
  }

  const submit = async () => {
    if (!title || !slug || selected.length === 0) {
      setSubmitLog('タイトル・slug・スレッドを入力してください')
      return
    }
    setLoading(true)
    setSubmitLog('作成中...')
    try {
      const res = await fetch('/api/admin/summary/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, slug, threadIds: selected.map(t => t.id) }),
      })
      const json = await res.json()
      if (json.ok) {
        setSubmitLog(`✅ 作成完了！ → /summary/${json.slug}`)
        setTitle(''); setSlug(''); setSelected([]); setSlugManual(false)
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
            キーワード狙いのまとめページを自由に作成できます。<br />
            作成したまとめは /summary/[slug] に公開され、トップページにも表示されます。<br />
            <span className="text-red-500 font-medium">※ 事前にSupabaseのSQL Editorで supabase/add_manual_summary_type.sql を実行してください</span>
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

          {/* スレ検索 */}
          <div>
            <label className="text-xs text-gray-600 block mb-0.5">スレッドを検索して追加</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search(searchQ)}
                placeholder="スレタイトルで検索"
                className="flex-1 border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
              />
              <button
                onClick={() => search(searchQ)}
                className="px-3 py-1.5 text-sm text-white"
                style={{ background: '#6c757d' }}
              >
                検索
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-1 border border-gray-200 max-h-48 overflow-y-auto">
                {searchResults.map(t => (
                  <button
                    key={t.id}
                    onClick={() => addThread(t)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 border-b border-gray-100 flex items-center justify-between"
                  >
                    <span className="line-clamp-1 flex-1">{t.title}</span>
                    <span className="text-gray-400 shrink-0 ml-2">{t.post_count}件 ＋</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 選択済みスレ */}
          {selected.length > 0 && (
            <div>
              <p className="text-xs text-gray-600 mb-1">選択中のスレッド（上から順に掲載）</p>
              <div className="border border-gray-200 divide-y divide-gray-100">
                {selected.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}</span>
                    <span className="text-xs flex-1 line-clamp-1">{t.title}</span>
                    <button onClick={() => moveUp(i)} disabled={i === 0} className="text-xs text-gray-400 disabled:opacity-30 px-1">↑</button>
                    <button onClick={() => removeThread(t.id)} className="text-xs text-red-400 px-1">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
