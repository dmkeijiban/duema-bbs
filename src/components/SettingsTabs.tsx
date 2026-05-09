'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Thread, Category } from '@/types'
import { deleteOwnThread, deleteOwnPost, removeFavorite } from '@/app/actions/delete'
import { formatRelativeTime, formatDateTimeJP } from '@/lib/utils'
import type { FavThread, MyPost } from '@/app/settings/page'

interface Props {
  favThreads: FavThread[]
  myThreads: (Thread & { categories: Category | null })[]
  myPosts: MyPost[]
  hasSession: boolean
}

type Tab = 'favorites' | 'posts' | 'settings'

export function SettingsTabs({ favThreads, myThreads, myPosts, hasSession }: Props) {
  const [tab, setTab] = useState<Tab>('favorites')
  const [isPending, startTransition] = useTransition()
  const [deletedThreadIds, setDeletedThreadIds] = useState<Set<number>>(new Set())
  const [deletedPostIds, setDeletedPostIds] = useState<Set<number>>(new Set())
  const [removedFavIds, setRemovedFavIds] = useState<Set<number>>(new Set())
  const [msg, setMsg] = useState('')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'favorites', label: 'お気に入り' },
    { id: 'posts', label: '自分の書き込み' },
    { id: 'settings', label: '自分のスレ' },
  ]

  const handleDeleteThread = (threadId: number) => {
    if (!confirm('このスレッドを削除しますか？（レスも全て削除されます）')) return
    startTransition(async () => {
      const res = await deleteOwnThread(threadId)
      if (res.error) {
        setMsg(res.error)
      } else {
        setDeletedThreadIds(prev => new Set(prev).add(threadId))
        setMsg('スレッドを削除しました')
      }
    })
  }

  const handleDeletePost = (postId: number, threadId: number) => {
    if (!confirm('このレスを削除しますか？')) return
    startTransition(async () => {
      const res = await deleteOwnPost(postId, threadId)
      if (res.error) {
        setMsg(res.error)
      } else {
        setDeletedPostIds(prev => new Set(prev).add(postId))
        setMsg('レスを削除しました')
      }
    })
  }

  const handleRemoveFavorite = (threadId: number) => {
    startTransition(async () => {
      const res = await removeFavorite(threadId)
      if (res.error) {
        setMsg(res.error)
      } else {
        setRemovedFavIds(prev => new Set(prev).add(threadId))
      }
    })
  }

  // 自分の書き込み: スレッドごとにグループ化
  const visiblePosts = myPosts.filter(p => !deletedPostIds.has(p.id))
  const threadGroups = new Map<number, { title: string; post_count: number; last_posted_at: string; posts: MyPost[] }>()
  for (const post of visiblePosts) {
    if (!threadGroups.has(post.thread_id)) {
      threadGroups.set(post.thread_id, {
        title: post.thread_title,
        post_count: post.thread_post_count,
        last_posted_at: post.thread_last_posted_at,
        posts: [],
      })
    }
    threadGroups.get(post.thread_id)!.posts.push(post)
  }
  const threadGroupCount = threadGroups.size

  const visibleFavs = favThreads.filter(t => !removedFavIds.has(t.id))

  return (
    <div>
      {/* タブバー */}
      <div className="flex border border-gray-300 mb-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 text-center py-2 text-sm font-medium border-r border-gray-300 last:border-r-0 transition-colors"
            style={
              tab === t.id
                ? { background: '#0d6efd', color: '#fff' }
                : { background: '#fff', color: '#0d6efd' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <div
          className="px-3 py-2 text-xs mt-2 border"
          style={{
            background: msg.includes('削除しました') ? '#d4edda' : '#f8d7da',
            color: msg.includes('削除しました') ? '#155724' : '#721c24',
            borderColor: msg.includes('削除しました') ? '#c3e6cb' : '#f5c6cb',
          }}
        >
          {msg}
        </div>
      )}

      {!hasSession && (
        <div className="mt-3 px-4 py-3 text-sm" style={{ background: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb' }}>
          セッションが確立されていません。一度スレッドを閲覧してください。
        </div>
      )}

      {/* ─── お気に入りタブ ─── */}
      {tab === 'favorites' && (
        <div className="border border-t-0 border-gray-300 bg-white">
          {/* 件数バナー */}
          <div className="px-3 py-2 text-xs" style={{ background: '#d4edda', color: '#155724', borderBottom: '1px solid #c3e6cb' }}>
            {visibleFavs.length === 0
              ? 'お気に入りスレッドが1件も登録されていません'
              : `お気に入りスレッドが${visibleFavs.length}件見つかりました(最大200件まで)`}
          </div>

          {visibleFavs.length > 0 && (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th className="px-3 py-2 text-left border-b border-gray-200 font-medium">スレッド名</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200 font-medium w-16">総投稿数</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200 font-medium w-40">最終投稿日時</th>
                  <th className="px-3 py-2 border-b border-gray-200 w-10">削除</th>
                </tr>
              </thead>
              <tbody>
                {visibleFavs.map(thread => (
                  <tr key={thread.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Link href={`/thread/${thread.id}`} className="text-blue-600 hover:underline">
                        {thread.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-bold text-center" style={{ color: '#dc3545' }}>
                      {thread.post_count}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {new Date(thread.last_posted_at).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      <span className="ml-1 text-gray-400">({formatRelativeTime(thread.last_posted_at)})</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleRemoveFavorite(thread.id)}
                        disabled={isPending}
                        className="text-white text-xs px-2 py-0.5 disabled:opacity-50"
                        style={{ background: '#dc3545' }}
                        title="お気に入りを解除"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── 自分の書き込みタブ ─── */}
      {tab === 'posts' && (
        <div className="border border-t-0 border-gray-300 bg-white">
          {/* 件数バナー */}
          <div className="px-3 py-2 text-xs" style={{ background: '#d4edda', color: '#155724', borderBottom: '1px solid #c3e6cb' }}>
            このセッションの書き込み一覧({threadGroupCount}スレッド/{visiblePosts.length}コメント) ※最大100件
          </div>

          {visiblePosts.length === 0 ? (
            <div className="px-4 py-4 text-sm text-gray-500">書き込みがありません</div>
          ) : (
            <div>
              {Array.from(threadGroups.entries()).map(([threadId, group]) => (
                <div key={threadId} className="border-b border-gray-200 last:border-b-0">
                  {/* スレッドヘッダー */}
                  <div
                    className="px-3 py-1.5 flex items-center justify-between"
                    style={{ background: '#f0f0f0', borderBottom: '1px solid #ddd' }}
                  >
                    <Link href={`/thread/${threadId}`} className="text-blue-600 hover:underline font-medium text-xs">
                      {group.title}
                    </Link>
                    <span
                      className="text-white text-[10px] font-bold px-1.5 py-0.5 ml-2 shrink-0"
                      style={{ background: '#555' }}
                    >
                      {group.post_count}レス/{formatRelativeTime(group.last_posted_at)}更新
                    </span>
                  </div>

                  {/* 個々のレス */}
                  {group.posts.map(post => (
                    <div key={post.id} className="border-b border-gray-100 last:border-b-0">
                      <div
                        className="px-3 py-1 text-xs border-b border-gray-100"
                        style={{ background: '#f8f9fa', color: '#0d6efd' }}
                      >
                        &gt;&gt;{post.post_number} {post.author_name} {formatDateTimeJP(post.created_at)}
                      </div>
                      <div className="px-3 py-1.5 flex items-start gap-2">
                        <p className="flex-1 text-xs text-gray-700 whitespace-pre-wrap break-all line-clamp-3">
                          {post.body}
                        </p>
                        <button
                          onClick={() => handleDeletePost(post.id, threadId)}
                          disabled={isPending}
                          className="shrink-0 text-[10px] px-1.5 py-0.5 text-white disabled:opacity-50"
                          style={{ background: '#dc3545' }}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── 自分のスレタブ ─── */}
      {tab === 'settings' && (
        <div className="border border-t-0 border-gray-300 bg-white">
          {myThreads.length === 0 ? (
            <div className="px-4 py-4 text-sm text-gray-500">立てたスレッドがありません</div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th className="px-3 py-2 text-left border-b border-gray-200 font-medium">タイトル</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200 font-medium w-16">レス数</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200 font-medium w-36">最終投稿</th>
                  <th className="px-3 py-2 border-b border-gray-200 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {myThreads
                  .filter(t => !deletedThreadIds.has(t.id))
                  .map(thread => (
                    <tr key={thread.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <Link href={`/thread/${thread.id}`} className="text-blue-600 hover:underline">
                          {thread.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2 font-bold text-center" style={{ color: '#dc3545' }}>
                        {thread.post_count}
                      </td>
                      <td className="px-3 py-2 text-gray-500">
                        {formatRelativeTime(thread.last_posted_at)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleDeleteThread(thread.id)}
                          disabled={isPending}
                          className="text-[11px] px-2 py-0.5 text-white disabled:opacity-50"
                          style={{ background: '#dc3545' }}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
