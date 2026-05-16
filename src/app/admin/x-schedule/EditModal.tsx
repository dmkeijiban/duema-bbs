'use client'

import { useState } from 'react'
import Image from 'next/image'
import { POST_TYPE_DEFS, STATUS_DEFS } from '@/constants/x-post'

// ----------------------------------------------------------------
// 型定義
// ----------------------------------------------------------------
interface MockPost {
  id: number
  date: string
  slot: string
  postType: string
  text: string
  imageUrl: string | null
  status: string
  sentToTypefully: boolean
}

interface Props {
  post: MockPost
  onSave: (updated: MockPost) => void
  onClose: () => void
}

const SLOTS = ['07:00', '12:00', '19:00', '22:00'] as const

// ----------------------------------------------------------------
// EditModal
// ----------------------------------------------------------------
export function EditModal({ post, onSave, onClose }: Props) {
  const [form, setForm] = useState<MockPost>({ ...post })

  function handleChange<K extends keyof MockPost>(key: K, value: MockPost[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    onSave(form)
  }

  // 画像プレビュー用 state
  const [imgError, setImgError] = useState(false)

  // 画像URL が変わったらエラーをリセット
  function handleImageUrlChange(value: string) {
    setImgError(false)
    handleChange('imageUrl', value === '' ? null : value)
  }

  // 背景クリックで閉じる
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-bold text-gray-800">投稿を編集</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition text-lg leading-none"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {/* フォーム本体 */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* 日付 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">日付</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => handleChange('date', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          {/* スロット */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">スロット</label>
            <select
              value={form.slot}
              onChange={(e) => handleChange('slot', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            >
              {SLOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* 投稿タイプ */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">投稿タイプ</label>
            <select
              value={form.postType}
              onChange={(e) => handleChange('postType', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            >
              {POST_TYPE_DEFS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* 本文 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              本文
              <span className="ml-2 font-normal text-gray-400">{form.text.length}文字</span>
            </label>
            <textarea
              value={form.text}
              onChange={(e) => handleChange('text', e.target.value)}
              rows={6}
              placeholder="投稿本文を入力..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y leading-relaxed"
            />
          </div>

          {/* ステータス */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ステータス</label>
            <select
              value={form.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            >
              {STATUS_DEFS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* 画像URL + プレビュー */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              画像URL
              <span className="ml-2 font-normal text-gray-400">（任意）</span>
            </label>
            <input
              type="text"
              value={form.imageUrl ?? ''}
              onChange={(e) => handleImageUrlChange(e.target.value)}
              placeholder="/images/example.png"
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />

            {/* プレビューエリア */}
            {form.imageUrl && (
              <div className="mt-2">
                {imgError ? (
                  <div className="flex items-center gap-2 text-[11px] text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    画像を読み込めませんでした（URLを確認してください）
                  </div>
                ) : (
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                    <Image
                      src={form.imageUrl}
                      alt="プレビュー"
                      fill
                      className="object-cover"
                      sizes="96px"
                      onError={() => setImgError(true)}
                      unoptimized
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Typefully送信済み */}
          <div className="flex items-center gap-2.5">
            <input
              id="sentToTypefully"
              type="checkbox"
              checked={form.sentToTypefully}
              onChange={(e) => handleChange('sentToTypefully', e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            <label htmlFor="sentToTypefully" className="text-sm text-gray-700 select-none">
              Typefully送信済み
            </label>
          </div>
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 transition"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition font-medium"
          >
            保存する
          </button>
        </div>
      </div>
    </div>
  )
}
