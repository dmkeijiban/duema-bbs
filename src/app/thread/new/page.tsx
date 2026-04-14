'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createThread } from '@/app/actions/thread'
import { ImageUploadField } from '@/components/ImageUploadField'
import { ArrowLeft, PenSquare } from 'lucide-react'
import Link from 'next/link'

// カテゴリはSupabaseから取得するが、クライアントコンポーネントのため
// サーバーコンポーネントでラップする
export default function NewThreadPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          スレッド一覧に戻る
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <PenSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            スレッドを立てる
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            タイトルと本文には日本語を含めてください（スパム対策）
          </p>
        </div>
        <NewThreadForm />
      </div>
    </div>
  )
}

function NewThreadForm() {
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
      // 成功時はredirectがかかる
    })
  }

  return (
    <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
      {/* カテゴリ */}
      <CategorySelect />

      {/* タイトル */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          タイトル <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="title"
          required
          minLength={2}
          maxLength={100}
          placeholder="例：【2024年最新】赤単アグロのデッキ相談"
          className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500 placeholder-gray-400"
        />
      </div>

      {/* 名前 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          名前（省略可）
        </label>
        <input
          type="text"
          name="author_name"
          maxLength={30}
          placeholder="名無しのデュエリスト"
          className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500 placeholder-gray-400"
        />
      </div>

      {/* 本文 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          本文 <span className="text-red-500">*</span>
        </label>
        <textarea
          name="body"
          required
          minLength={5}
          maxLength={5000}
          rows={8}
          placeholder="スレッドの内容を入力してください（5文字以上・5000文字以内）..."
          className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500 resize-y placeholder-gray-400"
        />
      </div>

      {/* 画像添付 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          画像添付（省略可）
        </label>
        <ImageUploadField name="image" />
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
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
          className="px-6 py-3 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          キャンセル
        </Link>
      </div>
    </form>
  )
}

// カテゴリセレクト（クライアントサイドでSupabaseから取得）
function CategorySelect() {
  // 静的なカテゴリリスト（Supabaseのデータと合わせる）
  const categories = [
    { id: 1, name: '総合', slug: 'general' },
    { id: 2, name: 'デッキ相談', slug: 'deck' },
    { id: 3, name: 'カード評価', slug: 'card' },
    { id: 4, name: '大会・環境', slug: 'tournament' },
    { id: 5, name: '売買・交換', slug: 'trade' },
    { id: 6, name: '雑談', slug: 'casual' },
  ]

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        カテゴリ <span className="text-red-500">*</span>
      </label>
      <select
        name="category_id"
        required
        className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500"
      >
        <option value="">カテゴリを選択してください</option>
        {categories.map(cat => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>
    </div>
  )
}
