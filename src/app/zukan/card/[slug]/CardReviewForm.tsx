'use client'

import { useActionState, useEffect, useState } from 'react'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import { createClient } from '@/lib/supabase'
import { normalizeZukanDisplayName, ZUKAN_DEFAULT_DISPLAY_NAME, ZUKAN_MAX_ANON_DISPLAY_NAME_LENGTH } from '@/lib/zukan-display'
import { submitCardReview, type CardReviewFormState } from './actions'

const INITIAL: CardReviewFormState = { status: 'idle' }

type ViewerState =
  | { status: 'checking' }
  | { status: 'anonymous' }
  | { status: 'profile'; displayName: string; avatarUrl: string | null }
  | { status: 'profile_hidden'; displayName: string; avatarUrl: string | null }

export default function CardReviewForm({ cardId, slug }: { cardId: string; slug: string }) {
  const action = submitCardReview.bind(null, cardId, slug)
  const [state, dispatch, isPending] = useActionState(action, INITIAL)
  const [viewer, setViewer] = useState<ViewerState>({ status: 'checking' })

  useEffect(() => {
    let active = true
    const supabase = createClient()

    async function resolveViewer() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active) return
      if (!user) {
        setViewer({ status: 'anonymous' })
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, profile_hidden, account_suspended, withdrawn_at')
        .eq('id', user.id)
        .maybeSingle()

      if (!active) return
      if (profile && !profile.account_suspended && !profile.withdrawn_at) {
        const avatarUrl = typeof profile.avatar_url === 'string' ? profile.avatar_url : null
        const displayName = normalizeZukanDisplayName(profile.display_name)
        if (profile.profile_hidden) {
          setViewer({ status: 'profile_hidden', displayName, avatarUrl })
        } else {
          setViewer({ status: 'profile', displayName, avatarUrl })
        }
      } else {
        setViewer({ status: 'anonymous' })
      }
    }

    resolveViewer()

    return () => {
      active = false
    }
  }, [])

  if (state.status === 'success') {
    return (
      <p className="border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
        投稿しました！ありがとうございます。
      </p>
    )
  }

  return (
    <form action={dispatch} className="border border-gray-200 bg-white p-3">
      {viewer.status === 'checking' ? (
        <p className="mb-2 rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-500">
          投稿者情報を確認中です。
        </p>
      ) : viewer.status === 'profile' ? (
        <div className="mb-2 flex items-center gap-2 rounded border border-blue-100 bg-blue-50 px-2 py-1.5 text-xs text-blue-800">
          <ProfileAvatar src={viewer.avatarUrl} alt={`${viewer.displayName}のアイコン`} size="sm" />
          <span>投稿者：<span className="font-bold">{viewer.displayName}</span></span>
        </div>
      ) : viewer.status === 'profile_hidden' ? (
        <div className="mb-2">
          <div className="flex items-center gap-2 rounded border border-blue-100 bg-blue-50 px-2 py-1.5 text-xs text-blue-800">
            <ProfileAvatar src={viewer.avatarUrl} alt={`${viewer.displayName}のアイコン`} size="sm" />
            <span>投稿者：<span className="font-bold">{viewer.displayName}</span></span>
          </div>
          <p className="mt-1 text-[10px] text-amber-600">プロフィール非公開中のため、公開画面では匿名表示されます。</p>
        </div>
      ) : (
        <div className="mb-2">
          <label className="block text-xs font-bold text-gray-600 mb-1" htmlFor="card-display-name">
            名前
          </label>
          <input
            id="card-display-name"
            name="display_name"
            type="text"
            maxLength={ZUKAN_MAX_ANON_DISPLAY_NAME_LENGTH}
            placeholder={`名前を入力（${ZUKAN_MAX_ANON_DISPLAY_NAME_LENGTH}文字以内・空欄可）`}
            className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
          />
          <p className="mt-1 text-[10px] text-gray-400">空欄の場合は「{ZUKAN_DEFAULT_DISPLAY_NAME}」になります。</p>
        </div>
      )}
      <div className="mb-2">
        <label className="block text-xs font-bold text-gray-600 mb-1" htmlFor="card-body">
          思い出 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="card-body"
          name="body"
          required
          maxLength={1000}
          rows={4}
          placeholder="このカードにまつわる思い出、対戦での記憶など..."
          className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none resize-none"
        />
        <p className="text-right text-[10px] text-gray-400">最大1000文字</p>
      </div>
      {state.status === 'error' && (
        <p className="mb-2 text-xs text-red-600">{state.message}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-blue-600 px-4 py-1.5 text-xs font-bold text-white transition-all duration-100 hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        {isPending ? '投稿中…' : '思い出を投稿する'}
      </button>
    </form>
  )
}
