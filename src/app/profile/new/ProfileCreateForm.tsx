'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createProfile } from './actions'

export function ProfileCreateForm() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [slug, setSlug] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (formData: FormData) => {
    setError('')
    startTransition(async () => {
      const result = await createProfile(formData)
      if (result?.error) setError(result.error)
      if (result?.redirectTo) router.push(result.redirectTo)
    })
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="display_name" className="mb-1 block text-sm font-bold text-gray-700">
          表示名 <span className="text-red-500">*</span>
        </label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          required
          maxLength={20}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          placeholder="例：デュエマ好き"
        />
        <p className="mt-1 text-xs text-gray-500">1〜20文字。空白のみは使えません。</p>
      </div>

      <div>
        <label htmlFor="profile_slug" className="mb-1 block text-sm font-bold text-gray-700">
          投稿者ページURL ID <span className="text-red-500">*</span>
        </label>
        <input
          id="profile_slug"
          name="profile_slug"
          type="text"
          required
          minLength={3}
          maxLength={20}
          value={slug}
          onChange={event => setSlug(event.target.value.toLowerCase())}
          pattern="[a-z0-9][a-z0-9_]{1,18}[a-z0-9]"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          placeholder="例：duema_user"
        />
        <p className="mt-1 text-xs text-gray-500">
          半角英小文字・数字・_ の3〜20文字。先頭末尾は英数字にしてください。
        </p>
        <p className="mt-1 rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
          プレビュー：/u/{slug || 'duema_user'}
        </p>
      </div>

      <div>
        <label htmlFor="bio" className="mb-1 block text-sm font-bold text-gray-700">
          自己紹介
        </label>
        <textarea
          id="bio"
          name="bio"
          maxLength={300}
          rows={4}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          placeholder="デュエマ歴や好きなカードなど（任意）"
        />
        <p className="mt-1 text-xs text-gray-500">300文字まで。あとから編集できる想定です。</p>
      </div>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? '保存中…' : '投稿者ページを作る'}
        </button>
        <Link
          href="/"
          className="rounded border border-gray-300 px-5 py-2.5 text-center text-sm text-gray-700 hover:bg-gray-50"
        >
          あとで設定する
        </Link>
      </div>
    </form>
  )
}
