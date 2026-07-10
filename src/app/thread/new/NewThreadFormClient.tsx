'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createThread } from '@/app/actions/thread'
import Link from 'next/link'
import { getPostableConsolidatedCategories } from '@/lib/categories'
import type { Category } from '@/types'
import { createClient, getCurrentUser } from '@/lib/supabase'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import { POST_SUBMIT_BUTTON_CLASS, POST_SUBMIT_BUTTON_STYLE } from '@/components/postSubmitButtonStyle'

type AuthState =
  | { status: 'loading' }
  | { status: 'anon' }
  | { status: 'user'; displayName: string; avatarUrl: string | null }
  | { status: 'profile_missing' }

interface Props {
  categories: Category[]
}

export function NewThreadFormClient({ categories }: Props) {
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' })
  const router = useRouter()
  const categoryOptions = getPostableConsolidatedCategories(categories)

  useEffect(() => {
    const supabase = createClient()
    getCurrentUser().then(async ({ data }) => {
      if (!data.user) {
        setAuthState({ status: 'anon' })
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', data.user.id)
        .single()
      if (!profile?.display_name) {
        setAuthState({ status: 'profile_missing' })
        return
      }
      setAuthState({
        status: 'user',
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url ?? null,
      })
    })
  }, [])

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
    <form onSubmit={handleSubmit}>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
        <tbody>
          <tr className="border-b border-gray-200">
            <td className="py-2 px-2 align-middle text-xs font-medium text-gray-700 sm:px-3" style={{ background: '#f5f5f5', width: 72 }}>
              カテゴリ
            </td>
            <td className="py-2 px-2 min-w-0 sm:px-3">
              <select
                name="category_id"
                required
                className="w-full border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-blue-400"
              >
                <option value="">カテゴリを選択してください</option>
                {categoryOptions.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </td>
          </tr>
          <tr className="border-b border-gray-200">
            <td className="py-2 px-2 align-middle text-xs font-medium text-gray-700 sm:px-3" style={{ background: '#f5f5f5' }}>
              タイトル
            </td>
            <td className="py-2 px-2 min-w-0 sm:px-3">
              <input
                type="text"
                name="title"
                required
                minLength={2}
                maxLength={100}
                className="w-full border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400"
              />
            </td>
          </tr>
          {authState.status === 'loading' && (
            <tr className="border-b border-gray-200">
              <td className="py-2 px-2 align-middle text-xs font-medium text-gray-700 sm:px-3" style={{ background: '#f5f5f5' }}>
                投稿者
              </td>
              <td className="py-2 px-2 min-w-0 text-sm text-gray-400 sm:px-3">
                ログイン状態を確認中…
              </td>
            </tr>
          )}
          {authState.status === 'anon' && (
            <tr className="border-b border-gray-200">
              <td className="py-2 px-2 align-middle text-xs font-medium text-gray-700 sm:px-3" style={{ background: '#f5f5f5' }}>
                名前
              </td>
              <td className="py-2 px-2 min-w-0 sm:px-3">
                <input
                  type="text"
                  name="author_name"
                  maxLength={30}
                  placeholder="名無しのデュエリスト"
                  className="w-full border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400"
                />
              </td>
            </tr>
          )}
          {authState.status === 'user' && (
            <tr className="border-b border-gray-200">
              <td className="py-2 px-2 align-middle text-xs font-medium text-gray-700 sm:px-3" style={{ background: '#f5f5f5' }}>
                投稿者
              </td>
              <td className="py-2 px-2 min-w-0 sm:px-3">
                <input type="hidden" name="author_name" value={authState.displayName} />
                <div className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                  <ProfileAvatar src={authState.avatarUrl} alt={`${authState.displayName}のアイコン`} size="sm" />
                  <span className="font-medium">{authState.displayName}</span>
                </div>
              </td>
            </tr>
          )}
          {authState.status === 'profile_missing' && (
            <tr className="border-b border-gray-200">
              <td className="py-2 px-2 align-top text-xs font-medium text-gray-700 sm:px-3" style={{ background: '#f5f5f5', paddingTop: 10 }}>
                投稿者
              </td>
              <td className="py-2 px-2 min-w-0 sm:px-3">
                <p className="text-sm text-red-600">
                  スレッドを作成するにはプロフィールを設定してください。{' '}
                  <Link href="/profile/new" className="underline text-blue-600">プロフィール設定</Link>
                </p>
              </td>
            </tr>
          )}
          <tr className="border-b border-gray-200">
            <td className="py-2 px-2 align-top text-xs font-medium text-gray-700 sm:px-3" style={{ background: '#f5f5f5', paddingTop: 10 }}>
              本文
            </td>
            <td className="py-2 px-2 min-w-0 sm:px-3">
              <textarea
                name="body"
                required
                minLength={5}
                maxLength={5000}
                rows={8}
                placeholder={"今のデュエマの話でも、昔の思い出でも大歓迎です。\n質問・相談・予想など、気軽に書いてください！"}
                className="w-full border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 resize-y"
              />
            </td>
          </tr>
          <tr className="border-b border-gray-200">
            <td className="py-2 px-2 align-middle text-xs font-medium text-gray-700 sm:px-3" style={{ background: '#f5f5f5' }}>
              画像
            </td>
            <td className="py-2 px-2 min-w-0 sm:px-3">
              <input
                type="file"
                name="image"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="text-sm cursor-pointer file:mr-2 file:px-3 file:py-1 file:border file:border-gray-400 file:bg-gray-200 file:text-gray-700 file:text-sm file:cursor-pointer hover:file:bg-gray-300"
              />
            </td>
          </tr>
        </tbody>
      </table>

      {error && (
        <div className="mx-3 my-1.5 px-2 py-1.5 text-xs" style={{ background: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb' }}>
          {error}
        </div>
      )}

      <div className="px-3 py-2.5 space-y-2">
        <button
          type="submit"
          disabled={isPending}
          className={POST_SUBMIT_BUTTON_CLASS}
          style={POST_SUBMIT_BUTTON_STYLE}
        >
          {isPending ? 'スレッドを作成中...' : 'スレッドを立てる'}
        </button>
        <Link
          href="/"
          className="block w-full border border-gray-300 px-3 py-2 text-center text-sm text-gray-600 hover:bg-gray-50 transition-colors sm:w-auto"
        >
          キャンセル
        </Link>
      </div>
    </form>
  )
}
