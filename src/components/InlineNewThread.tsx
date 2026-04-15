'use client'

import { useTransition, useState } from 'react'
import { createThread } from '@/app/actions/thread'
import { Category } from '@/types'

interface Props {
  categories: Category[]
}

export function InlineNewThread({ categories }: Props) {
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
          <div className="px-4 py-3 text-xs border-b border-gray-200 leading-relaxed"
            style={{ background: '#d1ecf1', color: '#0c5460' }}>
            1.似たスレッドがないか確認してください。<br />
            2.フライング・リーク情報は禁止です。<br />
            3.タイトルでのネタバレを避けてください。<br />
            4.画像は権利を侵害しない物を添付してください。<br />
            5.ミスで立てたスレは必ず削除を押してください。<br />
            6.他人が不快になるようなタイトルは避けてください。<br />
            7.スレッド作成は承認制とする場合があります。<br />
            8.不適切と判断した場合は削除・ブロックする事があります。
          </div>

          {/* フォーム */}
          <form onSubmit={handleSubmit} className="text-sm">
            <div className="grid gap-0" style={{ gridTemplateColumns: '5rem 1fr' }}>
              {/* タイトル */}
              <div className="py-2 pr-2 pl-3 text-right text-gray-600 flex items-center justify-end text-xs whitespace-nowrap">タイトル</div>
              <div className="py-2 pr-3 min-w-0">
                <input
                  type="text"
                  name="title"
                  required
                  maxLength={100}
                  placeholder="スレッドタイトルを入力(64文字以内)"
                  className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              {/* カテゴリ */}
              <div className="py-2 pr-2 pl-3 text-right text-gray-600 flex items-center justify-end text-xs whitespace-nowrap">カテゴリ</div>
              <div className="py-2 pr-3 min-w-0">
                <select
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
              <div className="py-2 pr-2 pl-3 text-right text-gray-600 flex items-center justify-end text-xs whitespace-nowrap">名前</div>
              <div className="py-2 pr-3 min-w-0">
                <input
                  type="text"
                  name="author_name"
                  maxLength={15}
                  placeholder="名前を入力(15文字以内・空欄可)"
                  className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              {/* 本文 */}
              <div className="py-2 pr-2 pl-3 text-right text-gray-600 text-xs whitespace-nowrap pt-3">本文</div>
              <div className="py-2 pr-3 min-w-0">
                <textarea
                  name="body"
                  required
                  rows={10}
                  placeholder="本文を入力 (最大30行/1000文字まで)"
                  className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 resize-y"
                />
              </div>
              {/* 画像 */}
              <div className="py-2 pr-2 pl-3 text-right text-gray-600 flex items-center justify-end text-xs whitespace-nowrap">画像</div>
              <div className="py-2 pr-3 min-w-0">
                <input
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
                  style={{ backgroundColor: '#0d6efd' }}
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
