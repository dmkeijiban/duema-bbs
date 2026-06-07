'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type LoginClientProps = {
  nextPath?: string
}

function safeNextPath(value?: string) {
  if (!value) return ''
  if (!value.startsWith('/') || value.startsWith('//')) return ''
  return value
}

export function LoginClient({ nextPath }: LoginClientProps) {
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleLogin = async () => {
    setError('')
    setIsLoading(true)

    const supabase = createClient()
    const safeNext = safeNextPath(nextPath)
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    if (safeNext) callbackUrl.searchParams.set('next', safeNext)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })

    if (error) {
      setError('Googleログインを開始できませんでした。Supabase/Google設定を確認してください。')
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="w-full inline-flex items-center justify-center gap-3 rounded border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white font-bold">
          <span className="text-blue-600">G</span>
        </span>
        {isLoading ? 'Googleログインへ移動中...' : 'Googleでログイン'}
      </button>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <p className="text-xs leading-relaxed text-gray-500">
        ログインすると、
        <a
          href="https://www.duema-bbs.com/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline"
        >
          利用規約
        </a>
        ・
        <a
          href="https://www.duema-bbs.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline"
        >
          プライバシーポリシー
        </a>
        に同意したものとみなされます。
      </p>

      <Link
        href="/"
        className="block w-full rounded border border-gray-300 px-4 py-2.5 text-center text-sm text-gray-700 hover:bg-gray-50"
      >
        匿名のまま掲示板へ戻る
      </Link>
    </div>
  )
}
