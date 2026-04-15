'use client'

import { useRef, useState, useTransition } from 'react'
import { createPost } from '@/app/actions/thread'
import { Thread, Category } from '@/types'
import Link from 'next/link'

interface Props {
  threadId: number
  thread: Thread & { categories: Category | null }
  bodyValue: string
  onBodyChange: (v: string) => void
}

export function NewPostForm({ threadId, thread, bodyValue, onBodyChange }: Props) {
  const [authorName, setAuthorName] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      const result = await createPost(fd)
      if (result?.error) {
        setError(result.error)
      } else {
        onBodyChange('')
        setAuthorName('')
        if (fileInputRef.current) fileInputRef.current.value = ''
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      }
    })
  }

  return (
    <div className="border border-gray-300 bg-white">
      {/* ヘッダー */}
      <div className="px-3 py-2 font-bold text-sm text-white" style={{ background: '#888' }}>
        ✏ レス投稿
      </div>

      {/* パンくず */}
      <div className="px-3 py-1.5 text-xs border-b border-gray-200" style={{ background: '#f5f5f5' }}>
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        {thread.categories && (
          <>
            <span className="mx-1">{'>'}</span>
            <Link href={`/?category=${thread.categories.slug}`} className="text-blue-600 hover:underline">
              カテゴリ『{thread.categories.name}』
            </Link>
          </>
        )}
        <span className="mx-1">{'>'}</span>
        <span className="text-gray-600">{thread.title}</span>
      </div>

      {/* ルール */}
      <div className="px-3 py-2 text-xs" style={{ background: '#d1ecf1', borderBottom: '1px solid #bee5eb' }}>
        <p>1.アンカーはレス番号をクリックで自動入力できます。</p>
        <p>2.誹謗中傷・暴言・煽り・スレッドと無関係な投稿は削除・規制対象です。<br />
          他サイト・特定個人への中傷・暴言は禁止です。</p>
        <p>※規約違反は各レスの『報告』からお知らせください。削除依頼は
          <Link href="/contact" className="underline" style={{ color: '#004085' }}>『お問い合わせ』</Link>
          からお願いします。
        </p>
        <p className="mt-0.5" style={{ color: '#dc3545' }}>
          3.二次創作画像は、作者本人でない場合は必ずURLで貼ってください。サムネとリンク先が表示されます。
        </p>
        <p>4.巻き返し規制を受けている方や荒らしを反省した方はお問い合わせから連絡ください。</p>
      </div>

      {/* フォーム */}
      <form onSubmit={handleSubmit}>
        <table className="w-full text-sm border-collapse">
          <tbody>
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
            <tr className="border-b border-gray-200">
              <td className="py-2 px-3 align-top text-xs font-medium" style={{ background: '#f5f5f5', paddingTop: 10 }}>
                本文
              </td>
              <td className="py-2 px-3">
                <textarea
                  id="reply-textarea"
                  value={bodyValue}
                  onChange={e => onBodyChange(e.target.value)}
                  required
                  rows={5}
                  maxLength={3000}
                  className="w-full px-2 py-1.5 text-sm resize-y focus:outline-none"
                  style={{ border: '1px solid #80bdff' }}
                />
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
            disabled={isPending}
            className="w-full py-2 text-sm text-white disabled:opacity-60"
            style={{ background: '#0d6efd' }}
          >
            {isPending ? '送信中...' : '投稿する'}
          </button>
        </div>
      </form>
    </div>
  )
}
