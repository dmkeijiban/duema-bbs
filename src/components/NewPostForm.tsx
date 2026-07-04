'use client'

import { useRef, useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPost } from '@/app/actions/thread'
import { Thread, Category, Post } from '@/types'
import Link from 'next/link'
import { capturePostHogEvent } from '@/lib/posthog-events'
import { createClient, getCurrentUser } from '@/lib/supabase'
import { ProfileAvatar } from './ProfileAvatar'
import { getDisplayCategory } from '@/lib/categories'
import { COMMENT_BODY_MAX_LENGTH } from '@/lib/spam'

type AuthState =
  | { status: 'loading' }
  | { status: 'anon' }
  | { status: 'user'; displayName: string; avatarUrl: string | null }
  | { status: 'profile_missing' }

const POSTS_PER_PAGE = 100

interface Props {
  threadId: number
  thread: Thread & { categories: Category | null }
  bodyValue: string
  onBodyChange: (v: string) => void
  onOptimisticPost: (draft: { body: string; authorName: string; imageUrl: string | null }) => string
  onPostSucceeded: (optimisticId: string, post: Post) => void
  onPostFailed: (optimisticId: string) => void
  rules?: string
  isAdmin?: boolean
}

export function NewPostForm({
  threadId,
  thread,
  bodyValue,
  onBodyChange,
  onOptimisticPost,
  onPostSucceeded,
  onPostFailed,
}: Props) {
  const [authorName, setAuthorName] = useState('')
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [, startRefreshTransition] = useTransition()
  const [scrollTarget, setScrollTarget] = useState<number | null>(null)
  const submitInFlightRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const displayCategory = getDisplayCategory(thread.categories)

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

  useEffect(() => {
    if (scrollTarget === null) return
    let tries = 0
    const attempt = () => {
      const el = document.getElementById(`post-${scrollTarget}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setScrollTarget(null)
        return
      }
      tries++
      if (tries < 20) {
        setTimeout(attempt, 150)
      } else {
        // 別ページに投稿された場合はそのページに遷移してアンカーへ
        const postNumber = scrollTarget - 1
        const targetPage = Math.ceil(postNumber / POSTS_PER_PAGE)
        const url = targetPage <= 1
          ? `/thread/${threadId}#post-${scrollTarget}`
          : `/thread/${threadId}/p/${targetPage}#post-${scrollTarget}`
        router.push(url)
        setScrollTarget(null)
      }
    }
    attempt()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTarget])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitInFlightRef.current) return
    submitInFlightRef.current = true
    setError('')
    setIsSubmitting(true)

    const form = e.currentTarget
    const currentFormData = new FormData(form)
    const submittedBody = String(currentFormData.get('body') ?? bodyValue)
    const submittedAuthorName = authState.status === 'user'
      ? authState.displayName
      : authorName
    const fd = new FormData()
    fd.set('thread_id', String(threadId))
    fd.set('body', submittedBody)
    fd.set('author_name', authorName)
    const file = fileInputRef.current?.files?.[0]
    if (file) fd.set('image', file)
    const previewUrl = file ? URL.createObjectURL(file) : null
    const optimisticId = onOptimisticPost({
      body: submittedBody,
      authorName: submittedAuthorName,
      imageUrl: previewUrl,
    })
    onBodyChange('')

    const startedAt = performance.now()
    const finishSubmit = () => {
      submitInFlightRef.current = false
      setIsSubmitting(false)
    }

    ;(async () => {
      try {
        const result = await createPost(fd)
        const actionReturnedAt = performance.now()
        if (result?.error) {
          onPostFailed(optimisticId)
          if (previewUrl) URL.revokeObjectURL(previewUrl)
          capturePostHogEvent('reply_submit_error', {
            thread_id: threadId,
            category_slug: thread.categories?.slug ?? null,
            error_message: result.error,
            has_image: Boolean(file),
          })
          setError(result.error)
          onBodyChange(submittedBody)
          finishSubmit()
        } else {
          const isPreviewHost = window.location.hostname === 'localhost' || window.location.hostname.endsWith('.vercel.app')
          const resultRecord = result && typeof result === 'object' ? result as Record<string, unknown> : {}
          if ('post' in resultRecord && resultRecord.post && typeof resultRecord.post === 'object') {
            onPostSucceeded(optimisticId, resultRecord.post as Post)
            if (previewUrl) URL.revokeObjectURL(previewUrl)
          } else {
            const fallbackPostNumber = typeof resultRecord.postNumber === 'number'
              ? resultRecord.postNumber
              : 0
            onPostSucceeded(optimisticId, {
              id: -Date.now(),
              thread_id: threadId,
              post_number: fallbackPostNumber,
              body: submittedBody,
              author_name: submittedAuthorName.trim() || '名無しのデュエリスト',
              user_id: null,
              session_id: null,
              image_url: previewUrl,
              thumbnail_url: null,
              created_at: new Date().toISOString(),
              is_deleted: false,
              deleted_by: null,
              deleted_at: null,
            })
            if (previewUrl) {
              window.setTimeout(() => URL.revokeObjectURL(previewUrl), 30000)
            }
          }
          capturePostHogEvent('reply_submit_success', {
            thread_id: threadId,
            category_slug: thread.categories?.slug ?? null,
            has_image: Boolean(file),
          })
          setAuthorName('')
          if (fileInputRef.current) fileInputRef.current.value = ''
          finishSubmit()
          const formReleasedAt = performance.now()
          if ('postNumber' in result && typeof result.postNumber === 'number') {
            setScrollTarget(result.postNumber + 1)
          }
          if (isPreviewHost) {
            console.warn('[reply submit result]', JSON.stringify({
              keys: Object.keys(resultRecord),
              debugTimingJson: resultRecord.debugTimingJson ?? null,
            }))
          }
          if ('debugTiming' in result && result.debugTiming && isPreviewHost) {
            console.warn('[reply submit timing]', JSON.stringify({
              total_ms: Math.round(actionReturnedAt - startedAt),
              action_return_ms: Math.round(actionReturnedAt - startedAt),
              form_release_ms: Math.round(formReleasedAt - startedAt),
              server: result.debugTiming,
              has_image: Boolean(file),
              thread_id: threadId,
            }))
          }
          window.setTimeout(() => {
            startRefreshTransition(() => {
              router.refresh()
            })
          }, 2500)
        }
      } catch {
        onPostFailed(optimisticId)
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        capturePostHogEvent('reply_submit_exception', {
          thread_id: threadId,
          category_slug: thread.categories?.slug ?? null,
          has_image: Boolean(file),
        })
        // デプロイ後に古いJSキャッシュを持つタブからアクセスするとサーバーアクションIDが
        // 一致せず404が返る。ページ更新を促すメッセージを表示する。
        setError('ページが古くなっています。再読み込みしてから再度投稿してください。')
        onBodyChange(submittedBody)
        finishSubmit()
      }
    })()
  }

  return (
    <div className="border border-gray-300 bg-white">
      {/* ヘッダー */}
      <div className="px-3 py-2 font-bold text-sm text-white" style={{ background: '#888' }}>
        ✏ コメント投稿
      </div>

      {/* パンくず */}
      <div className="px-3 py-1.5 text-xs border-b border-gray-200" style={{ background: '#f5f5f5' }}>
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        {displayCategory && (
          <>
            <span className="mx-1">{'>'}</span>
            <Link href={`/category/${displayCategory.slug}`} className="text-blue-600 hover:underline">
              カテゴリ『{displayCategory.name}』
            </Link>
          </>
        )}
        <span className="mx-1">{'>'}</span>
        <span className="text-gray-600">{thread.title}</span>
      </div>

      {/* ルール・投稿案内 */}
      <div
        className="px-3 py-2 text-xs leading-relaxed"
        style={{ background: '#d1ecf1', borderBottom: '1px solid #bee5eb' }}
      >
        <p>
          投稿する前に <Link href="/guide" className="font-bold text-blue-700 hover:underline">投稿ルール</Link> をご確認ください。
        </p>
        {authState.status === 'anon' && (
          <p>
            <Link href="/login?mode=signup" className="font-bold text-blue-700 hover:underline">アカウント作成</Link> で投稿管理が行え便利です。※登録なしでも匿名投稿できます。
          </p>
        )}
      </div>

      {/* フォーム */}
      <form onSubmit={handleSubmit}>
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
          <tbody>
            {authState.status === 'loading' && (
              <tr className="border-b border-gray-200">
                <td className="py-2 px-3 whitespace-nowrap align-middle text-xs font-medium" style={{ background: '#f5f5f5', width: 72 }}>
                  投稿者
                </td>
                <td className="py-2 px-3 text-xs text-gray-400">ログイン状態を確認中…</td>
              </tr>
            )}
            {authState.status === 'anon' && (
              <tr className="border-b border-gray-200">
                <td className="py-2 px-3 whitespace-nowrap align-middle text-xs font-medium" style={{ background: '#f5f5f5', width: 72 }}>
                  名前
                </td>
                <td className="py-2 px-3">
                  <input
                    type="text"
                    value={authorName}
                    onChange={e => setAuthorName(e.target.value)}
                    placeholder="名前を入力(15文字以内・空欄可)"
                    maxLength={15}
                    className="w-full max-w-[240px] border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                  />
                </td>
              </tr>
            )}
            {authState.status === 'user' && (
              <tr className="border-b border-gray-200">
                <td className="py-2 px-3 whitespace-nowrap align-middle text-xs font-medium" style={{ background: '#f5f5f5', width: 72 }}>
                  投稿者
                </td>
                <td className="py-2 px-3">
                  <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                    <ProfileAvatar src={authState.avatarUrl} alt={`${authState.displayName}のアイコン`} size="sm" />
                    <span className="font-medium">{authState.displayName}</span>
                  </span>
                </td>
              </tr>
            )}
            {authState.status === 'profile_missing' && (
              <tr className="border-b border-gray-200">
                <td className="py-2 px-3 whitespace-nowrap align-middle text-xs font-medium" style={{ background: '#f5f5f5', width: 72 }}>
                  投稿者
                </td>
                <td className="py-2 px-3 text-xs text-red-600">
                  コメントするにはプロフィールを設定してください。{' '}
                  <Link href="/profile/new" className="underline text-blue-600">プロフィール設定</Link>
                </td>
              </tr>
            )}
            <tr className="border-b border-gray-200">
              <td className="py-2 px-3 align-top text-xs font-medium" style={{ background: '#f5f5f5', paddingTop: 10 }}>
                本文
              </td>
              <td className="p-2 min-w-0">
                <p className="mb-1 text-xs leading-relaxed text-gray-500">
                  一言だけでもOKです。デッキ相談・感想・思い出話など、気軽にどうぞ。
                </p>
                <textarea
                  id="reply-textarea"
                  name="body"
                  value={bodyValue}
                  onChange={e => {
                    onBodyChange(e.target.value)
                  }}
                  required
                  rows={5}
                  maxLength={COMMENT_BODY_MAX_LENGTH}
                  className="w-full px-2 py-1.5 text-sm resize-y focus:outline-none"
                  style={{ border: '1px solid #80bdff' }}
                />
                <div className={`text-right text-[11px] mt-0.5 ${bodyValue.length >= COMMENT_BODY_MAX_LENGTH - 100 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                  {bodyValue.length} / {COMMENT_BODY_MAX_LENGTH}
                </div>
              </td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-2 px-3 align-middle text-xs font-medium" style={{ background: '#f5f5f5' }}>
                画像
              </td>
              <td className="py-2 px-3">
                <input
                  ref={fileInputRef}
                  type="file"
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
        <div className="px-3 py-2.5">
          <button
            type="submit"
            disabled={isSubmitting || authState.status === 'loading' || authState.status === 'profile_missing'}
            className="w-full py-2 text-sm text-white disabled:opacity-60"
            style={{ background: '#0d6efd' }}
          >
            {isSubmitting ? '送信中...' : '投稿する'}
          </button>
        </div>
      </form>

    </div>
  )
}
