'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createThread } from '@/app/actions/thread'
import { ImageUploadField } from '@/components/ImageUploadField'
import { PenSquare } from '@/components/Icons'
import Link from 'next/link'

interface Category {
  id: number
  name: string
}

interface Props {
  categories: Category[]
}

export function NewThreadFormClient({ categories }: Props) {
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        const result = await createThread(formData)
        if (result?.error) {
          setError(result.error)
        } else if ('threadId' in result && result.threadId) {
          router.push(`/thread/${result.threadId}`)
        }
      } catch (err) {
        // NEXT_REDIRECT はNext.jsがリダイレクト処理するので再スロー
        if (err && typeof err === 'object' && 'digest' in err && String((err as { digest: unknown }).digest).startsWith('NEXT_REDIRECT')) throw err
        // デプロイ後の古いJSキャッシュによるサーバーアクション404対策
        setError('ページが古くなっています。再読み込みしてから再度投稿してください。')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
      {/* カテゴリ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          カテゴリ <span className="text-red-500">*</span>
        </label>
        <select
          name="category_id"
          required
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">カテゴリを選択してください</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* タイトル */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          タイトル <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="title"
          required
          minLength={2}
          maxLength={100}
          placeholder="例：【2024年最新】赤単アグロのデッキ相談"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-gray-400"
        />
      </div>

      {/* 名前 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          名前（省略可）
        </label>
        <input
          type="text"
          name="author_name"
          maxLength={30}
          placeholder="名無しのデュエリスト"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-gray-400"
        />
      </div>

      {/* 本文 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          本文 <span className="text-red-500">*</span>
        </label>
        <textarea
          name="body"
          required
          minLength={5}
          maxLength={5000}
          rows={8}
          placeholder="スレッドの内容を入力してください（5文字以上・5000文字以内）..."
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y placeholder-gray-400"
        />
      </div>

      {/* 画像添付 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          画像添付（省略可）
        </label>
        <ImageUploadField name="image" />
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-colors"
        >
          <PenSquare className="w-4 h-4" />
          {isPending ? 'スレッドを作成中...' : 'スレッドを立てる'}
        </button>
        <Link
          href="/"
          className="px-6 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          キャンセル
        </Link>
      </div>
    </form>
  )
}
