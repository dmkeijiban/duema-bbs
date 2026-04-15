import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { SettingsTabs } from '@/components/SettingsTabs'
import { Thread, Post, Category } from '@/types'

export const metadata = { title: '個人設定 | デュエマ掲示板' }

export type FavThread = Thread & {
  categories: Category | null
}

export type MyPost = Post & {
  thread_title: string
  thread_post_count: number
  thread_last_posted_at: string
}

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('bbs_session')?.value ?? null

  const supabase = await createClient()

  let favThreads: FavThread[] = []
  let myThreads: (Thread & { categories: Category | null })[] = []
  let myPosts: MyPost[] = []

  if (sessionId) {
    // お気に入り
    const { data: favData } = await supabase
      .from('favorites')
      .select('thread_id')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })

    if (favData && favData.length > 0) {
      const ids = favData.map(f => f.thread_id)
      const { data } = await supabase
        .from('threads')
        .select('*, categories(id,name,slug,color,description,sort_order)')
        .in('id', ids)
        .order('last_posted_at', { ascending: false })
      favThreads = (data ?? []) as FavThread[]
    }

    // 自分のスレ
    const { data: tData } = await supabase
      .from('threads')
      .select('*, categories(id,name,slug,color,description,sort_order)')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
    myThreads = (tData ?? []) as (Thread & { categories: Category | null })[]

    // 自分のレス（スレ情報含む）
    const { data: pData } = await supabase
      .from('posts')
      .select('*, threads(title, post_count, last_posted_at)')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(100)

    myPosts = ((pData ?? []) as {
      id: number
      thread_id: number
      post_number: number
      body: string
      author_name: string
      image_url: string | null
      created_at: string
      threads: { title: string; post_count: number; last_posted_at: string } | null
    }[]).map(p => ({
      ...p,
      thread_title: p.threads?.title ?? '',
      thread_post_count: p.threads?.post_count ?? 0,
      thread_last_posted_at: p.threads?.last_posted_at ?? p.created_at,
    })) as MyPost[]
  }

  return (
    <div className="max-w-5xl mx-auto px-3 py-4 text-sm">
      {/* パンくず */}
      <nav className="text-xs text-gray-500 mb-4">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span className="mx-1">{'>'}</span>
        <span className="inline-block px-2 py-0.5 rounded text-white text-[11px]" style={{ background: '#0d6efd' }}>個人設定</span>
      </nav>

      <SettingsTabs
        favThreads={favThreads}
        myThreads={myThreads}
        myPosts={myPosts}
        hasSession={!!sessionId}
      />
    </div>
  )
}
