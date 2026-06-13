'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type LoginClientProps = {
  nextPath?: string
}

type Mode = 'login' | 'signup'

function safeNextPath(value?: string) {
  if (!value) return ''
  if (!value.startsWith('/') || value.startsWith('//')) return ''
  return value
}

function mapAuthError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials'))
    return 'メールアドレスまたはパスワードが違います。'
  if (m.includes('email not confirmed'))
    return 'メールアドレスの確認が完了していません。登録時のメールをご確認ください。'
  if (m.includes('user already registered'))
    return 'このメールアドレスはすでに登録されています。Googleログインをお試しいただくか、別のメールアドレスをお使いください。'
  if (m.includes('password should be at least') || m.includes('password too short'))
    return 'パスワードは6文字以上で入力してください。'
  if (m.includes('rate limit') || m.includes('email rate'))
    return 'メール送信の制限に達しました。時間を空けて再度お試しください。'
  if (m.includes('too many requests') || m.includes('for security purposes'))
    return '送信回数が多すぎます。しばらく時間を空けて再度お試しください。'
  if (m.includes('signup is disabled'))
    return '現在、新規登録を受け付けていません。'
  return 'エラーが発生しました。時間を空けて再度お試しください。'
}

export function LoginClient({ nextPath }: LoginClientProps) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const safeNext = safeNextPath(nextPath)

  const handleGoogleLogin = async () => {
    setError('')
    setIsLoading(true)
    const supabase = createClient()
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    if (safeNext) callbackUrl.searchParams.set('next', safeNext)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl.toString() },
    })
    if (error) {
      setError('Googleログインを開始できませんでした。Supabase/Google設定を確認してください。')
      setIsLoading(false)
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) {
      setError(mapAuthError(error.message))
      setIsLoading(false)
      return
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle()
    router.push(profile ? (safeNext || '/') : '/profile/new')
    router.refresh()
  }

  const handleSignUp = async (e: React.FormEvent) => {
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
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    if (safeNext) callbackUrl.searchParams.set('next', safeNext)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: callbackUrl.toString() },
    })
    if (error) {
      setError(mapAuthError(error.message))
      setIsLoading(false)
      return
    }
    // email confirmation disabled — session returned immediately
    if (data.session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user!.id)
        .maybeSingle()
      router.push(profile ? (safeNext || '/') : '/profile/new')
      router.refresh()
      return
    }
    setSuccess('確認メールを送信しました。メール内のリンクから登録を完了してください。')
    setIsLoading(false)
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError('')
    setSuccess('')
  }

  if (success) {
    return (
      <div className="space-y-4">
        <p className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {success}
        </p>
        <p className="text-xs text-gray-500">
          メールが届かない場合は、迷惑メールフォルダをご確認ください。
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

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="flex overflow-hidden rounded border border-gray-200 text-sm">
        <button
          type="button"
          onClick={() => switchMode('login')}
          className={`flex-1 px-3 py-2 font-medium transition-colors ${
            mode === 'login'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          ログイン
        </button>
        <button
          type="button"
          onClick={() => switchMode('signup')}
          className={`flex-1 border-l border-gray-200 px-3 py-2 font-medium transition-colors ${
            mode === 'signup'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          新規登録
        </button>
      </div>

      {/* Email form */}
      <form
        onSubmit={mode === 'login' ? handleEmailLogin : handleSignUp}
        className="space-y-3"
      >
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
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            パスワード
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            placeholder={mode === 'signup' ? '6文字以上' : ''}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none disabled:opacity-60"
          />
        </div>
        {mode === 'signup' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              パスワード（確認）
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
        )}

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
          {isLoading
            ? mode === 'login'
              ? 'ログイン中...'
              : '登録中...'
            : mode === 'login'
              ? 'メールアドレスでログイン'
              : 'メールアドレスで新規登録'}
        </button>

        {mode === 'login' && (
          <div className="text-right">
            <Link
              href="/auth/forgot-password"
              className="text-xs text-blue-600 hover:underline"
            >
              パスワードを忘れた方
            </Link>
          </div>
        )}
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-400">または</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* Google button */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="inline-flex w-full items-center justify-center gap-3 rounded border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white font-bold">
          <span className="text-blue-600">G</span>
        </span>
        {isLoading ? 'Googleログインへ移動中...' : 'Googleでログイン'}
      </button>

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
