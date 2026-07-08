'use client'

import { useTransition, useState, useEffect } from 'react'
import { createThread } from '@/app/actions/thread'
import { Category } from '@/types'
import { getPostableConsolidatedCategories } from '@/lib/categories'
import Link from 'next/link'
import { createClient, getCurrentUser } from '@/lib/supabase'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import { capturePostHogEvent } from '@/lib/posthog-events'

type AuthState =
  | { status: 'loading' }
  | { status: 'anon' }
  | { status: 'user'; displayName: string; avatarUrl: string | null }
  | { status: 'profile_missing' }

interface Props {
  categories: Category[]
  newThreadRules?: string
  isAdmin?: boolean
}

const THREAD_BODY_MAX_LENGTH = 1000

export function InlineNewThread({ categories }: Props) {
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' })
  const [bodyValue, setBodyValue] = useState('')
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
    const imageFile = formData.get('image')
    capturePostHogEvent('thread_create_submit_start', {
      category_id: formData.get('category_id'),
      has_image: imageFile instanceof File && imageFile.size > 0,
      from_path: window.location.pathname,
    })
    startTransition(async () => {
      const result = await createThread(formData)
      if (result?.error) {
        capturePostHogEvent('thread_create_submit_error', {
          category_id: formData.get('category_id'),
          error_message: result.error,
          has_image: imageFile instanceof File && imageFile.size > 0,
          from_path: window.location.pathname,
        })
        setError(result.error)
      }
    })
  }

  return (
    <div id="resform" className="mt-3 overflow-hidden border border-gray-300 bg-white">
      {/* ヘッダー */}
      <div className="px-3 py-2 font-bold text-sm text-white" style={{ background: '#888' }}>
        🚩 新規スレッド作成
      </div>

      {/* 投稿案内 */}
      <div
        className="px-3 py-2 text-xs leading-relaxed"
        style={{ background: '#d1ecf1', borderBottom: '1px solid #bee5eb' }}
      >
        <p>
          投稿する前に <Link href="/guide" className="font-bold text-blue-700 hover:underline">投稿ルール</Link> をご確認ください。
        </p>
        {authState.status === 'anon' && (
          <p>
            <Link href="/login?mode=signup" className="font-bold text-blue-700 hover:underline">アカウント作成</Link> でプロフィール・投稿管理が使えます。※登録なしで匿名投稿できます。
          </p>
        )}
      </div>

      {/* フォーム */}
      <form onSubmit={handleSubmit}>
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        <table className="w-full table-fixed text-sm border-collapse">
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="py-2 px-3 whitespace-nowrap align-middle text-xs font-medium" style={{ background: '#f5f5f5', width: 72 }}>
                タイトル
              </td>
              <td className="py-2 px-3 min-w-0">
                <input
                  id="new-thread-title"
                  type="text"
                  name="title"
                  required
                  maxLength={100}
                  className="w-full min-w-0 border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                />
              </td>
            </tr>

            <tr className="border-b border-gray-200">
              <td className="py-2 px-3 whitespace-nowrap align-middle text-xs font-medium" style={{ background: '#f5f5f5', width: 72 }}>
                カテゴリ
              </td>
              <td className="py-2 px-3 min-w-0">
                <select
                  id="new-thread-category"
                  name="category_id"
                  className="w-full min-w-0 border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                >
                  {categoryOptions.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </td>
            </tr>

            {authState.status === 'loading' && (
              <tr className="border-b border-gray-200">
                <td className="py-2 px-3 whitespace-nowrap align-middle text-xs font-medium" style={{ background: '#f5f5f5', width: 72 }}>
                  投稿者
                </td>
                <td className="py-2 px-3 min-w-0 text-xs text-gray-400">ログイン状態を確認中…</td>
              </tr>
            )}
            {authState.status === 'anon' && (
              <tr className="border-b border-gray-200">
                <td className="py-2 px-3 whitespace-nowrap align-middle text-xs font-medium" style={{ background: '#f5f5f5', width: 72 }}>
                  名前
                </td>
                <td className="py-2 px-3 min-w-0">
                  <input
                    id="new-thread-author"
                    type="text"
                    name="author_name"
                    maxLength={15}
                    placeholder="名前を入力(15文字以内・空欄可)"
                    className="w-full max-w-[240px] min-w-0 border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                  />
                </td>
              </tr>
            )}
            {authState.status === 'user' && (
              <tr className="border-b border-gray-200">
                <td className="py-2 px-3 whitespace-nowrap align-middle text-xs font-medium" style={{ background: '#f5f5f5', width: 72 }}>
                  投稿者
                </td>
                <td className="py-2 px-3 min-w-0">
                  <input type="hidden" name="author_name" value={authState.displayName} />
                  <span className="inline-flex max-w-full items-center gap-1.5 text-sm text-gray-700">
                    <ProfileAvatar src={authState.avatarUrl} alt={`${authState.displayName}のアイコン`} size="sm" />
                    <span className="truncate font-medium">{authState.displayName}</span>
                  </span>
                </td>
              </tr>
            )}
            {authState.status === 'profile_missing' && (
              <tr className="border-b border-gray-200">
                <td className="py-2 px-3 whitespace-nowrap align-middle text-xs font-medium" style={{ background: '#f5f5f5', width: 72 }}>
                  投稿者
                </td>
                <td className="py-2 px-3 min-w-0 text-xs text-red-600">
                  スレッドを作成するにはプロフィールを設定してください。{' '}
                  <Link href="/profile/new" className="underline text-blue-600">プロフィール設定</Link>
                </td>
              </tr>
            )}

            <tr className="border-b border-gray-200">
              <td className="py-2 px-3 align-top text-xs font-medium" style={{ background: '#f5f5f5', paddingTop: 10 }}>
                本文
              </td>
              <td className="p-2 min-w-0">
                <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs leading-relaxed text-amber-800">
                  <p>今のデュエマの話でも、昔の思い出でも大歓迎です！</p>
                  <p>
                    <span className="md:hidden">質問や相談など、気軽にスレッドを立てて下さい！</span>
                    <span className="hidden md:inline">質問・相談・予想など、気軽にスレッドを立ててください！</span>
                  </p>
                </div>
                <textarea
                  id="new-thread-body"
                  name="body"
                  value={bodyValue}
                  onChange={e => setBodyValue(e.target.value)}
                  required
                  rows={5}
                  maxLength={THREAD_BODY_MAX_LENGTH}
                  className="w-full min-w-0 px-2 py-1.5 text-sm resize-y focus:outline-none"
                  style={{ border: '1px solid #80bdff' }}
                />
                <div className={`text-right text-[11px] mt-0.5 ${bodyValue.length >= THREAD_BODY_MAX_LENGTH - 100 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                  {bodyValue.length} / {THREAD_BODY_MAX_LENGTH}
                </div>
              </td>
            </tr>

            <tr className="border-b border-gray-200">
              <td className="py-2 px-3 align-middle text-xs font-medium" style={{ background: '#f5f5f5' }}>
                画像
              </td>
              <td className="py-2 px-3 min-w-0 overflow-hidden">
                <input
                  id="new-thread-image"
                  type="file"
                  name="image"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="block w-full max-w-full min-w-0 text-sm cursor-pointer file:mr-2 file:px-3 file:py-1 file:border file:border-gray-400 file:bg-gray-200 file:text-gray-700 file:text-sm file:cursor-pointer hover:file:bg-gray-300"
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
        <div className="px-3 py-2.5">
          <button
            type="submit"
            disabled={isPending || authState.status === 'loading' || authState.status === 'profile_missing'}
            id="respost"
            className="w-full py-2 text-sm text-white disabled:opacity-60"
            style={{ background: '#0d6efd' }}
          >
            {isPending ? '投稿中...' : '投稿する'}
          </button>
        </div>
      </form>
    </div>
  )
}
