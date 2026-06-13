'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください。')
      return
    }
    if (password !== passwordConfirm) {
      setError('パスワードと確認用パスワードが一致しません。')
      return
    }
    setIsLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      const m = error.message.toLowerCase()
      if (m.includes('same password')) {
        setError('現在と同じパスワードは使用できません。別のパスワードを入力してください。')
      } else if (m.includes('password should be at least') || m.includes('password too short')) {
        setError('パスワードは6文字以上で入力してください。')
      } else {
        setError('パスワードの更新に失敗しました。もう一度お試しください。')
      }
      setIsLoading(false)
      return
    }
    await supabase.auth.signOut()
    router.push('/login?message=password_reset_done')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          新しいパスワード
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
          placeholder="6文字以上"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none disabled:opacity-60"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          新しいパスワード（確認）
        </label>
        <input
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          required
          disabled={isLoading}
          placeholder="もう一度入力"
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
        {isLoading ? '更新中...' : 'パスワードを更新する'}
      </button>
    </form>
  )
}
