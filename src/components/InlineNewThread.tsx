'use client'

import { useTransition, useState } from 'react'
import { createThread } from '@/app/actions/thread'
import { Category } from '@/types'
import { SettingEditButton } from './SettingEditButton'

interface Props {
  categories: Category[]
  newThreadRules?: string
  isAdmin?: boolean
}

export function InlineNewThread({ categories, newThreadRules, isAdmin }: Props) {
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createThread(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div id="resform" className="mt-3 border border-gray-300 bg-white">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid #dee2e6' }}>
        <span style={{ color: '#0d6efd', fontSize: 14 }}>🚩</span>
        <span className="font-medium text-sm" style={{ color: '#212529' }}>新規スレッド作成</span>
      </div>

      <>
          {/* ルール */}
          {(newThreadRules || isAdmin) && (
            <div className="px-4 py-3 text-xs border-b border-gray-200 leading-relaxed relative setting-content"
              style={{ background: '#d1ecf1', color: '#0c5460', whiteSpace: newThreadRules?.trimStart().startsWith('<') ? undefined : 'pre-wrap' }}>
              {newThreadRules?.trimStart().startsWith('<')
                ? <div dangerouslySetInnerHTML={{ __html: newThreadRules }} />
                : newThreadRules}
              {isAdmin && (
                <span className="absolute top-1 right-1">
                  <SettingEditButton settingKey="new_thread_rules" initialValue={newThreadRules ?? ''} label="新規スレッド作成ルール" />
                </span>
              )}
            </div>
          )}

          {/* フォーム */}
          <form onSubmit={handleSubmit} className="text-sm">
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            <div className="grid gap-0" style={{ gridTemplateColumns: '5rem 1fr' }}>
              {/* タイトル */}
              <label htmlFor="new-thread-title" className="py-2 pr-2 pl-3 text-right text-gray-600 flex items-center justify-end text-xs whitespace-nowrap">タイトル</label>
              <div className="py-2 pr-3 min-w-0">
                <input
                  id="new-thread-title"
                  type="text"
                  name="title"
                  required
                  maxLength={100}
                  placeholder="スレッドタイトルを入力(64文字以内)"
                  className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              {/* カテゴリ */}
              <label htmlFor="new-thread-category" className="py-2 pr-2 pl-3 text-right text-gray-600 flex items-center justify-end text-xs whitespace-nowrap">カテゴリ</label>
              <div className="py-2 pr-3 min-w-0">
                <select
                  id="new-thread-category"
                  name="category_id"
                  className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                >
                  {[
                    ...categories.filter(c => c.name.includes('雑談')),
                    ...categories.filter(c => !c.name.includes('雑談')),
                  ].map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {/* 名前 */}
              <label htmlFor="new-thread-author" className="py-2 pr-2 pl-3 text-right text-gray-600 flex items-center justify-end text-xs whitespace-nowrap">名前</label>
              <div className="py-2 pr-3 min-w-0">
                <input
                  id="new-thread-author"
                  type="text"
                  name="author_name"
                  maxLength={15}
                  placeholder="名前を入力(15文字以内・空欄可)"
                  className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              {/* 本文 */}
              <label htmlFor="new-thread-body" className="py-2 pr-2 pl-3 text-right text-gray-600 text-xs whitespace-nowrap pt-3">本文</label>
              <div className="py-2 pr-3 min-w-0">
                <textarea
                  id="new-thread-body"
                  name="body"
                  required
                  rows={10}
                  placeholder="本文を入力 (最大30行/1000文字まで)"
                  className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 resize-y"
                />
              </div>
              {/* 画像 */}
              <label htmlFor="new-thread-image" className="py-2 pr-2 pl-3 text-right text-gray-600 flex items-center justify-end text-xs whitespace-nowrap">画像</label>
              <div className="py-2 pr-3 min-w-0">
                <input
                  id="new-thread-image"
                  type="file"
                  name="image"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="w-full text-sm cursor-pointer file:mr-2 file:px-3 file:py-1 file:border file:border-gray-400 file:bg-gray-200 file:text-gray-700 file:text-sm file:cursor-pointer hover:file:bg-gray-300"
                />
              </div>
              {/* ボタン */}
              <div></div>
              <div className="py-3 pr-3 min-w-0">
                {error && (
                  <div className="mb-2 px-3 py-2 text-sm" style={{ background: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb' }}>
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isPending}
                  id="respost"
                  className="px-12 py-2 text-white text-sm font-medium disabled:opacity-60"
                  style={{ backgroundColor: '#2563eb' }}
                >
                  {isPending ? '投稿中...' : '投稿する'}
                </button>
              </div>
            </div>
          </form>
        </>
    </div>
  )
}
