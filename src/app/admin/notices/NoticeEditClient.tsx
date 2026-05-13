'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { saveNotice, uploadNoticeImage } from './actions'

interface NoticeItem {
  image_url: string
  title: string
  body: string
  link_url: string
}

interface NoticeData {
  id: number
  position: string
  sort_order: number
  is_active: boolean
  header_text: string
  columns: number
  show_in_thread: boolean
  items: NoticeItem[]
}

export function NoticeEditClient({ notice }: { notice: NoticeData }) {
  const [items, setItems] = useState<NoticeItem[]>(notice.items ?? [])
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const addItem = () =>
    setItems(prev => [...prev, { image_url: '', title: '', body: '', link_url: '' }])

  const removeItem = (i: number) =>
    setItems(prev => prev.filter((_, j) => j !== i))

  const moveItem = (i: number, dir: -1 | 1) => {
    setItems(prev => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const update = (i: number, field: keyof NoticeItem, value: string) =>
    setItems(prev => prev.map((item, j) => (j === i ? { ...item, [field]: value } : item)))

  const handleImageUpload = async (i: number, file: File) => {
    setUploadingIdx(i)
    const fd = new FormData()
    fd.append('image', file)
    const result = await uploadNoticeImage(fd)
    if (result.url) update(i, 'image_url', result.url)
    else setError(result.error ?? '画像アップロードに失敗しました')
    setUploadingIdx(null)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    fd.set('items', JSON.stringify(items))
    startTransition(async () => {
      const result = await saveNotice(fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <input type="hidden" name="id" value={notice.id} />

      {/* メタデータ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-gray-600 block mb-1">表示位置</label>
          <select name="position" defaultValue={notice.position}
            className="w-full border border-gray-300 px-2 py-1.5 text-sm">
            <option value="top">スレ上（top）</option>
            <option value="mid">タブ下（mid）</option>
            <option value="bot">スレ下（bot）</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">列数（1〜4）</label>
          <input type="number" name="columns" defaultValue={notice.columns} min={1} max={4}
            className="w-full border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">並び順（数値が小さい順）</label>
          <input type="number" name="sort_order" defaultValue={notice.sort_order}
            className="w-full border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div className="flex flex-col gap-2 pt-5">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" name="is_active" defaultChecked={notice.is_active} className="w-4 h-4" />
            表示ON
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" name="show_in_thread" defaultChecked={notice.show_in_thread} className="w-4 h-4" />
            スレページにも表示
          </label>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-600 block mb-1">セクション見出し（任意）</label>
        <input type="text" name="header_text" defaultValue={notice.header_text}
          placeholder="例：おすすめスレ、公式情報"
          className="w-full border border-gray-300 px-2 py-1.5 text-sm" />
      </div>

      {/* バナー項目 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-gray-700">バナー項目（{items.length}件）</label>
          <button type="button" onClick={addItem}
            className="px-3 py-1 text-xs text-white font-medium"
            style={{ background: '#2563eb' }}>
            ＋ 追加
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="border border-gray-200 p-3 bg-gray-50 relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-600">項目 {i + 1}</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0}
                    className="px-2 py-0.5 text-xs border border-gray-300 bg-white disabled:opacity-40">▲</button>
                  <button type="button" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}
                    className="px-2 py-0.5 text-xs border border-gray-300 bg-white disabled:opacity-40">▼</button>
                  <button type="button" onClick={() => removeItem(i)}
                    className="px-2 py-0.5 text-xs text-white"
                    style={{ background: '#dc3545' }}>削除</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* 画像 */}
                <div className="md:col-span-2">
                  <label className="text-[11px] text-gray-500 block mb-1">画像URL</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={item.image_url}
                      onChange={e => update(i, 'image_url', e.target.value)}
                      placeholder="https://... または下のボタンでアップロード"
                      className="flex-1 border border-gray-300 px-2 py-1 text-xs"
                    />
                    <label className="shrink-0 px-2 py-1 text-xs border border-gray-400 bg-white cursor-pointer hover:bg-gray-50">
                      {uploadingIdx === i ? '処理中…' : '📁 画像選択'}
                      <input type="file" accept="image/*" className="hidden"
                        disabled={uploadingIdx !== null}
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) handleImageUpload(i, f)
                          e.target.value = ''
                        }} />
                    </label>
                  </div>
                  {item.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image_url} alt="" className="mt-1 h-10 object-cover border border-gray-200" />
                  )}
                </div>

                {/* タイトル */}
                <div>
                  <label className="text-[11px] text-gray-500 block mb-1">タイトル（オーバーレイ表示）</label>
                  <input type="text" value={item.title} onChange={e => update(i, 'title', e.target.value)}
                    placeholder="タイトルテキスト"
                    className="w-full border border-gray-300 px-2 py-1 text-xs" />
                </div>

                {/* リンクURL */}
                <div>
                  <label className="text-[11px] text-gray-500 block mb-1">リンク先URL</label>
                  <input type="text" value={item.link_url} onChange={e => update(i, 'link_url', e.target.value)}
                    placeholder="https://..."
                    className="w-full border border-gray-300 px-2 py-1 text-xs" />
                </div>

                {/* サブテキスト */}
                <div className="md:col-span-2">
                  <label className="text-[11px] text-gray-500 block mb-1">サブテキスト（任意）</label>
                  <input type="text" value={item.body} onChange={e => update(i, 'body', e.target.value)}
                    placeholder="補足テキスト（小さく表示）"
                    className="w-full border border-gray-300 px-2 py-1 text-xs" />
                </div>
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <p className="text-xs text-gray-400 py-4 text-center border border-dashed border-gray-300">
              「＋ 追加」でバナー項目を追加してください
            </p>
          )}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 px-3 py-2 bg-red-50 border border-red-200">{error}</p>
      )}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={isPending}
          className="px-8 py-2 text-white text-sm font-medium disabled:opacity-60"
          style={{ background: '#2563eb' }}>
          {isPending ? '保存中…' : '💾 保存する'}
        </button>
        <Link href="/admin/notices"
          className="px-6 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50">
          キャンセル
        </Link>
      </div>
    </form>
  )
}
