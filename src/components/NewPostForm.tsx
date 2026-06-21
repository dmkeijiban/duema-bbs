'use client'

import { useRef, useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createPost } from '@/app/actions/thread'
import { Thread, Category } from '@/types'
import Link from 'next/link'
import { capturePostHogEvent } from '@/lib/posthog-events'
import { createClient } from '@/lib/supabase'
import { ProfileAvatar } from './ProfileAvatar'
import { getDisplayCategory } from '@/lib/categories'

type AuthState =
  | { status: 'loading' }
  | { status: 'anon' }
  | { status: 'user'; displayName: string; avatarUrl: string | null }
  | { status: 'profile_missing' }

const PushSubscribeButton = dynamic(
  () => import('./PushSubscribeButton').then(mod => mod.PushSubscribeButton),
  { ssr: false },
)

const POSTS_PER_PAGE = 50

interface Props {
  threadId: number
  thread: Thread & { categories: Category | null }
  bodyValue: string
  onBodyChange: (v: string) => void
  rules?: string
  isAdmin?: boolean
}

export function NewPostForm({ threadId, thread, bodyValue, onBodyChange }: Props) {
  const [authorName, setAuthorName] = useState('')
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' })
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [scrollTarget, setScrollTarget] = useState<number | null>(null)
  const [showPushButton, setShowPushButton] = useState(false)
  const [pushUnsupported, setPushUnsupported] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const displayCategory = getDisplayCategory(thread.categories)

  useEffect(() => {
    setPushUnsupported(!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window))
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
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

  // プッシュ通知ボタン：スクロール30% OR 10秒滞在で表示
  useEffect(() => {
    let shown = false
    const show = () => {
      if (shown) return
      shown = true
      setShowPushButton(true)
    }

    const timer = setTimeout(show, 10_000)

    const onScroll = () => {
      const el = document.documentElement
      const scrolled = el.scrollTop / (el.scrollHeight - el.clientHeight)
      if (scrolled >= 0.3) show()
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const fd = new FormData()
    fd.set('thread_id', String(threadId))
    fd.set('body', bodyValue)
    fd.set('author_name', authorName)
    const file = fileInputRef.current?.files?.[0]
    if (file) fd.set('image', file)

    startTransition(async () => {
      try {
        const result = await createPost(fd)
        if (result?.error) {
          setError(result.error)
        } else {
          capturePostHogEvent('reply_submit_success', {
            thread_id: threadId,
            category_slug: thread.categories?.slug ?? null,
            has_image: Boolean(file),
          })
          setSubmitted(true)
          onBodyChange('')
          setAuthorName('')
          if (fileInputRef.current) fileInputRef.current.value = ''
          if ('postNumber' in result && typeof result.postNumber === 'number') {
            setScrollTarget(result.postNumber + 1)
          }
        }
      } catch {
        // デプロイ後に古いJSキャッシュを持つタブからアクセスするとサーバーアクションIDが
        // 一致せず404が返る。ページ更新を促すメッセージを表示する。
        setError('ページが古くなっています。再読み込みしてから再度投稿してください。')
      }
    })
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
        <p>
          <Link href="/login?mode=signup" className="font-bold text-blue-700 hover:underline">アカウント作成</Link> でプロフィール・投稿管理が使えます。※登録なしでも匿名投稿できます。
        </p>
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
                    className="border border-gray-300 px-2 py-1 text-sm bg-white focus:outline-none focus:border-blue-400"
                    style={{ width: 240 }}
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
              <td className="py-2 px-3">
                <textarea
                  id="reply-textarea"
                  value={bodyValue}
                  onChange={e => {
                    if (submitted) setSubmitted(false)
                    onBodyChange(e.target.value)
                  }}
                  required
                  rows={5}
                  maxLength={3000}
                  className="w-full px-2 py-1.5 text-sm resize-y focus:outline-none"
                  style={{ border: '1px solid #80bdff' }}
                />
                <div className={`text-right text-[11px] mt-0.5 ${bodyValue.length >= 2800 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                  {bodyValue.length} / 3000
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
            {!pushUnsupported && (
              <tr className="border-b border-gray-200">
                <td className="py-2 px-3 align-middle text-xs font-medium whitespace-nowrap" style={{ background: '#f5f5f5' }}>
                  返信通知
                </td>
                <td className="py-2 px-3">
                  {showPushButton && <PushSubscribeButton threadId={threadId} />}
                </td>
              </tr>
            )}
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
            className="w-full py-2 text-sm text-white disabled:opacity-60"
            style={{ background: '#0d6efd' }}
          >
            {isPending ? '送信中...' : '投稿する'}
          </button>
        </div>
      </form>

      {submitted && (authState.status === 'anon' || authState.status === 'user') && (
        <div className="mx-3 mb-3 border border-green-300 bg-green-50 px-3 py-2.5 text-xs">
          <p className="font-medium text-green-700">投稿しました。</p>
          {authState.status === 'anon' ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-gray-600">
              <span>登録すると、投稿管理・投稿者ページ・ランキング参加が使えて便利です。</span>
              <Link
                href="/login?mode=signup"
                className="inline-block border border-blue-400 px-2 py-0.5 text-xs font-bold text-blue-600 hover:bg-blue-50"
              >
                アカウント登録する
              </Link>
            </div>
          ) : (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-gray-600">
              <span>投稿した内容はマイページから確認できます。</span>
              <Link
                href="/mypage"
                className="inline-block border border-blue-400 px-2 py-0.5 text-xs font-bold text-blue-600 hover:bg-blue-50"
              >
                マイページを見る
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
