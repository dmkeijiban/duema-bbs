'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type AuthState =
  | { status: 'anon' }
  | { status: 'no-profile' }
  | { status: 'has-profile'; slug: string }

interface Props {
  variant: 'desktop' | 'mobile'
  onNavigate?: () => void
}

/**
 * ログイン状態に応じてヘッダー導線を出し分けるクライアントコンポーネント。
 * - 未ログイン: マイページ（未登録者向け匿名履歴ページへ誘導）
 * - ログイン済み + profile未作成: プロフィール作成 → /profile/new
 * - ログイン済み + profile作成済み: マイページ（+ 余裕があれば 投稿者ページ）
 *
 * SSR初期値は 'anon'（匿名利用が大多数 & 従来挙動を維持）。
 * ルートレイアウト/TOPのISRを壊さないため、認証判定はブラウザ側でのみ行う。
 */
export function HeaderAuthNav({ variant, onNavigate }: Props) {
  const [state, setState] = useState<AuthState>({ status: 'anon' })

  useEffect(() => {
    let active = true
    const supabase = createClient()

    const resolve = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active) return
      if (!user) {
        setState({ status: 'anon' })
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('profile_slug')
        .eq('id', user.id)
        .maybeSingle()
      if (!active) return
      if (profile?.profile_slug) {
        setState({ status: 'has-profile', slug: profile.profile_slug })
      } else {
        setState({ status: 'no-profile' })
      }
    }

    resolve()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      resolve()
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const className =
    variant === 'desktop'
      ? 'inline-flex items-center justify-center whitespace-nowrap rounded border border-blue-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 transition-all duration-100 hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
      : 'mx-4 my-2 inline-flex items-center justify-center rounded border border-blue-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 transition-all duration-100 hover:border-blue-400 hover:bg-blue-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'

  if (state.status === 'anon') {
    return (
      <Link href="/mypage" className={className} onClick={onNavigate}>
        マイページ
      </Link>
    )
  }

  if (state.status === 'no-profile') {
    return (
      <Link href="/profile/new" className={className} onClick={onNavigate}>
        プロフィール作成
      </Link>
    )
  }

  // has-profile
  return (
    <Link href="/mypage" className={className} onClick={onNavigate}>
      マイページ
    </Link>
  )
}
