'use client'

import { useRef, useState, useTransition } from 'react'
import { createPost } from '@/app/actions/thread'
import { Thread, Category } from '@/types'
import Link from 'next/link'
import { SettingEditButton } from './SettingEditButton'

interface Props {
  threadId: number
  thread: Thread & { categories: Category | null }
  bodyValue: string
  onBodyChange: (v: string) => void
  rules?: string
  isAdmin?: boolean
}

export function NewPostForm({ threadId, thread, bodyValue, onBodyChange, rules, isAdmin }: Props) {
  const [authorName, setAuthorName] = useState('')
  const [notifyEmail, setNotifyEmail] = useState('')
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
    if (notifyEmail.trim()) fd.set('notify_email', notifyEmail.trim())
    const file = fileInputRef.current?.files?.[0]
    if (file) fd.set('image', file)

    startTransition(async () => {
      const result = await createPost(fd)
      if (result?.error) {
        setError(result.error)
      } else {
        onBodyChange('')
        setAuthorName('')
        setNotifyEmail('')
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
            <Link href={`/category/${thread.categories.slug}`} className="text-blue-600 hover:underline">
              カテゴリ『{thread.categories.name}』
            </Link>
          </>
        )}
        <span className="mx-1">{'>'}</span>
        <span className="text-gray-600">{thread.title}</span>
      </div>

      {/* ルール */}
      {(rules || isAdmin) && (
        <div className="px-3 py-2 text-xs relative setting-content"
          style={{ background: '#d1ecf1', borderBottom: '1px solid #bee5eb', whiteSpace: rules?.trimStart().startsWith('<') ? undefined : 'pre-wrap' }}>
          {rules?.trimStart().startsWith('<')
            ? <div dangerouslySetInnerHTML={{ __html: rules }} />
            : rules}
          {isAdmin && (
            <span className="absolute top-1 right-1">
              <SettingEditButton settingKey="thread_rules" initialValue={rules ?? ''} label="スレッド内ルール" />
            </span>
          )}
        </div>
      )}

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
            <tr className="border-b border-gray-200">
              <td className="py-2 px-3 align-middle text-xs font-medium whitespace-nowrap" style={{ background: '#f5f5f5' }}>
                返信通知
              </td>
              <td className="py-2 px-3">
                <input
                  type="email"
                  value={notifyEmail}
                  onChange={e => setNotifyEmail(e.target.value)}
                  placeholder="メールアドレス（省略可・返信時に通知）"
                  className="border border-gray-300 px-2 py-1 text-sm bg-white focus:outline-none focus:border-blue-400"
                  style={{ width: 260 }}
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
