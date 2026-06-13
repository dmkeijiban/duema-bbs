'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    })
    if (error) {
      const m = error.message.toLowerCase()
      if (m.includes('rate limit') || m.includes('too many') || m.includes('for security purposes')) {
        setError('送信回数が多すぎます。しばらく時間を空けて再度お試しください。')
      } else {
        setError('エラーが発生しました。時間を空けて再度お試しください。')
      }
      setIsLoading(false)
      return
    }
    setSent(true)
    setIsLoading(false)
  }

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <div className="border border-gray-300 bg-white">
        <div className="border-b border-gray-300 bg-gray-100 px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">パスワードの再設定</h1>
        </div>
        <div className="p-4">
          {sent ? (
            <div className="space-y-4">
              <p className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                パスワード再設定用のメールを送信しました。メール内のリンクから新しいパスワードを設定してください。
              </p>
              <p className="text-xs text-gray-500">
                メールが届かない場合は、迷惑メールフォルダをご確認ください。
              </p>
              <Link
                href="/login"
                className="block w-full rounded border border-gray-300 px-4 py-2.5 text-center text-sm text-gray-700 hover:bg-gray-50"
              >
                ログインへ戻る
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-600">
                登録済みのメールアドレスを入力してください。パスワード再設定用のメールをお送りします。
              </p>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="example@email.com"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none disabled:opacity-60"
                />
              </div>
              {error && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? '送信中...' : '再設定メールを送信'}
              </button>
              <Link
                href="/login"
                className="block w-full rounded border border-gray-300 px-4 py-2.5 text-center text-sm text-gray-700 hover:bg-gray-50"
              >
                ログインへ戻る
              </Link>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
