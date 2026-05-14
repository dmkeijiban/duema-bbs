'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createSummaryComment } from '@/app/actions/summary'
import { formatDateTimeJP } from '@/lib/utils'

export interface SummaryComment {
  id: number
  comment_number: number
  body: string
  author_name: string
  created_at: string
}

interface Props {
  summaryId: number
  slug: string
  title: string
  comments: SummaryComment[]
  enabled: boolean
}

export function SummaryCommentSection({ summaryId, slug, title, comments, enabled }: Props) {
  const [body, setBody] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    const formData = new FormData()
    formData.set('summary_id', String(summaryId))
    formData.set('slug', slug)
    formData.set('body', body)
    formData.set('author_name', authorName)

    startTransition(async () => {
      const result = await createSummaryComment(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      setBody('')
      setAuthorName('')
      router.refresh()
    })
  }

  return (
    <div className="border border-gray-300 bg-white mt-3">
      <div className="px-3 py-2 font-bold text-sm text-white" style={{ background: '#888' }}>
        コメント
      </div>

      <div className="divide-y divide-gray-200">
        {comments.length === 0 ? (
          <div className="px-3 py-3 text-sm text-gray-500">まだコメントはありません。</div>
        ) : comments.map(comment => (
          <div key={comment.id} id={`comment-${comment.comment_number}`} className="px-3 py-3">
            <div className="text-xs flex items-center gap-1 flex-wrap mb-1">
              <span className="font-bold text-blue-600">&gt;&gt;{comment.comment_number}</span>
              <span className="font-medium text-gray-700">{comment.author_name}</span>
              <span className="text-gray-400">{formatDateTimeJP(comment.created_at)}</span>
            </div>
            <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap break-words">{comment.body}</p>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="border-t border-gray-300">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        <div className="px-3 py-1.5 text-xs border-b border-gray-200 bg-gray-50 text-gray-600">
          {title}
        </div>
        <div className="p-3 space-y-2">
          {!enabled && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1.5">
              コメント用DBが未反映のため、投稿欄は準備中です。
            </div>
          )}
          <input
            type="text"
            value={authorName}
            onChange={event => setAuthorName(event.target.value)}
            placeholder="名前（空欄可）"
            maxLength={15}
            disabled={!enabled || isPending}
            className="border border-gray-300 px-2 py-1 text-sm bg-white focus:outline-none focus:border-blue-400 disabled:bg-gray-100"
            style={{ width: 240, maxWidth: '100%' }}
          />
          <textarea
            value={body}
            onChange={event => setBody(event.target.value)}
            required
            rows={5}
            maxLength={3000}
            disabled={!enabled || isPending}
            className="w-full px-2 py-1.5 text-sm resize-y focus:outline-none disabled:bg-gray-100"
            style={{ border: '1px solid #80bdff' }}
          />
          {error && (
            <div className="px-2 py-1.5 text-xs" style={{ background: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb' }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={!enabled || isPending}
            className="w-full py-2 text-sm text-white disabled:opacity-60"
            style={{ background: '#0d6efd' }}
          >
            {isPending ? '送信中...' : 'コメントする'}
          </button>
        </div>
      </form>
    </div>
  )
}
