'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const SummaryRichTextEditor = dynamic(
  () => import('./SummaryRichTextEditor').then(m => ({ default: m.SummaryRichTextEditor })),
  { ssr: false, loading: () => <div className="border border-gray-300 rounded p-4 text-sm text-gray-400">エディタを読み込み中...</div> },
)

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'manual-' + Date.now()
}

interface SummaryItem {
  id: number
  slug: string
  title: string
  body: string | null
  created_at: string
  published: boolean
  type: string
}

export default function AdminSummaryPage() {
  // ── 作成・編集フォーム ────────────────────────────────────────
  const [mode, setMode] = useState<'create' | 'edit'>('create')
  const [editSlug, setEditSlug] = useState('')
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [body, setBody] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [submitLog, setSubmitLog] = useState('')
  const [loading, setLoading] = useState(false)

  // ── 既存まとめ一覧 ────────────────────────────────────────────
  const [summaries, setSummaries] = useState<SummaryItem[]>([])
  const [listLoading, setListLoading] = useState(true)

  // ── 自動生成 ─────────────────────────────────────────────────
  const [genLog, setGenLog] = useState('')
  const [genLoading, setGenLoading] = useState(false)

  // ── 公開/非公開・削除 ─────────────────────────────────────
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // 一覧を取得
  const loadList = async () => {
    setListLoading(true)
    try {
      const res = await fetch('/api/admin/summary/list')
      const json = await res.json()
      if (json.summaries) setSummaries(json.summaries)
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => { loadList() }, [])

  const handleTitleChange = (v: string) => {
    setTitle(v)
    if (!slugManual && mode === 'create') setSlug(slugify(v))
  }

  const resetForm = () => {
    setMode('create')
    setEditSlug('')
    setTitle('')
    setSlug('')
    setBody('')
    setSlugManual(false)
    setSubmitLog('')
  }

  const startEdit = (s: SummaryItem) => {
    setMode('edit')
    setEditSlug(s.slug)
    setTitle(s.title)
    setSlug(s.slug)
    setBody(s.body ?? '')
    setSlugManual(true)
    setSubmitLog('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submit = async () => {
    if (!title || !slug) { setSubmitLog('タイトル・slugを入力してください'); return }
    setLoading(true)
    setSubmitLog(mode === 'create' ? '作成中...' : '保存中...')
    try {
      if (mode === 'create') {
        const res = await fetch('/api/admin/summary/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, slug, body }),
        })
        const json = await res.json()
        if (json.ok) {
          setSubmitLog(`✅ 作成完了！ → /summary/${json.slug}`)
          resetForm()
          await loadList()
        } else {
          setSubmitLog(`❌ ${json.error}`)
        }
      } else {
        // 編集モード
        const res = await fetch('/api/admin/summary/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: editSlug, title, body }),
        })
        const json = await res.json()
        if (json.ok) {
          setSubmitLog(`✅ 保存完了！ → /summary/${editSlug}`)
          await loadList()
        } else {
          setSubmitLog(`❌ ${json.error}`)
        }
      }
    } catch (e) {
      setSubmitLog(String(e))
    } finally {
      setLoading(false)
    }
  }

  const togglePublish = async (s: SummaryItem) => {
    setActionLoading(s.slug + '-publish')
    try {
      const res = await fetch('/api/admin/summary/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: s.slug, published: !s.published }),
      })
      const json = await res.json()
      if (json.ok) {
        await loadList()
      } else {
        alert('エラー：' + json.error)
      }
    } catch (e) {
      alert(String(e))
    } finally {
      setActionLoading(null)
    }
  }

  const deleteSummary = async (s: SummaryItem) => {
    if (!window.confirm(`「${s.title}」を削除しますか？\nこの操作は取り消せません。`)) return
    setActionLoading(s.slug + '-delete')
    try {
      const res = await fetch('/api/admin/summary/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: s.slug }),
      })
      const json = await res.json()
      if (json.ok) {
        if (mode === 'edit' && editSlug === s.slug) resetForm()
        await loadList()
      } else {
        alert('エラー：' + json.error)
      }
    } catch (e) {
      alert(String(e))
    } finally {
      setActionLoading(null)
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
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/admin" className="text-xs text-blue-600 hover:underline">← 管理TOP</Link>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-xs text-gray-600">まとめ管理</span>
        </div>

        {/* ── 作成・編集フォーム ─────────────────────── */}
        <div className="bg-white border border-gray-300 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="font-bold text-gray-800">
              {mode === 'create' ? '✏️ 手動まとめを作成' : `📝 編集中：${editSlug}`}
            </h1>
            {mode === 'edit' && (
              <button type="button" onClick={resetForm}
                className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 px-2 py-1 rounded">
                ← 新規作成に戻る
              </button>
            )}
          </div>

          {mode === 'create' && (
            <p className="text-xs text-gray-500">
              タイトルとslugを入力するだけで作成できます。<br />
              スレッドは自動的におすすめスレ（投稿数TOP10）が使われます。<br />
              作成したまとめは /summary/[slug] に公開され、トップページにも表示されます。
            </p>
          )}

          <div className="space-y-3">
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

            {mode === 'create' && (
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
            )}

            <div>
              <label className="text-xs text-gray-600 block mb-1">
                記事本文
                <span className="text-gray-400 font-normal ml-1">— 画像・YouTube・X・リンクカードなど挿入可能</span>
              </label>
              <SummaryRichTextEditor content={body} onChange={setBody} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={submit}
              disabled={loading}
              className="px-5 py-2 text-sm text-white disabled:opacity-50"
              style={{ background: mode === 'create' ? '#0d6efd' : '#198754' }}
            >
              {loading
                ? (mode === 'create' ? '作成中...' : '保存中...')
                : (mode === 'create' ? 'まとめを作成・公開' : '変更を保存')}
            </button>
            {mode === 'edit' && (
              <a
                href={`/summary/${editSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                公開ページを確認 ↗
              </a>
            )}
          </div>

          {submitLog && (
            <p className={`text-xs ${submitLog.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>
              {submitLog}
            </p>
          )}
        </div>

        {/* ── 既存まとめ一覧 ─────────────────────── */}
        <div className="bg-white border border-gray-300 p-5 space-y-3">
          <h2 className="font-bold text-gray-800">📋 まとめ一覧</h2>
          {listLoading ? (
            <p className="text-xs text-gray-400">読み込み中...</p>
          ) : summaries.length === 0 ? (
            <p className="text-xs text-gray-400">まだ手動まとめはありません</p>
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-200">
              {summaries.map(s => (
                <div key={s.id} className="flex items-center gap-2 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${s.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.published ? '公開中' : '非公開'}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${s.type === 'manual' ? 'bg-blue-100 text-blue-600' : s.type === 'weekly' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'}`}>
                        {s.type === 'manual' ? '手動' : s.type === 'weekly' ? '週次' : '月次'}
                      </span>
                      <p className="text-sm font-medium text-gray-800 truncate">{s.title}</p>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      /summary/{s.slug} ·{' '}
                      {new Date(s.created_at).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={`/summary/${s.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-500 hover:underline"
                    >
                      表示 ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
                      className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePublish(s)}
                      disabled={actionLoading === s.slug + '-publish'}
                      className={`text-xs px-2 py-1 border rounded disabled:opacity-50 ${s.published ? 'border-yellow-400 text-yellow-700 hover:bg-yellow-50' : 'border-green-400 text-green-700 hover:bg-green-50'}`}
                    >
                      {actionLoading === s.slug + '-publish' ? '...' : s.published ? '非公開にする' : '公開する'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSummary(s)}
                      disabled={actionLoading === s.slug + '-delete'}
                      className="text-xs px-2 py-1 border border-red-300 rounded text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {actionLoading === s.slug + '-delete' ? '...' : '削除'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
