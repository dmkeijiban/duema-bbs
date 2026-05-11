'use client'

import { useMemo, useState, useTransition } from 'react'
import { bulkImportThreadComments, BulkImportResult } from './actions'
import { COMMENT_IMPORT_LIMIT, parsePastedComments } from '@/lib/comment-import'

type PreviewComment = {
  id: string
  body: string
  selected: boolean
}

function makePreview(comments: string[], prefix: string): PreviewComment[] {
  return comments.slice(0, COMMENT_IMPORT_LIMIT).map((body, index) => ({
    id: `${prefix}-${index}-${body.slice(0, 12)}`,
    body,
    selected: true,
  }))
}

export function CommentImportClient() {
  const [threadId, setThreadId] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [preview, setPreview] = useState<PreviewComment[]>([])
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()
  const [isFetchingYoutube, setIsFetchingYoutube] = useState(false)

  const selectedComments = useMemo(
    () => preview.filter(comment => comment.selected && comment.body.trim()),
    [preview],
  )

  const loadYoutubeComments = async () => {
    setMessage('')
    setIsFetchingYoutube(true)
    try {
      const res = await fetch(`/api/admin/comment-import/youtube?url=${encodeURIComponent(youtubeUrl)}`)
      const data = await res.json()
      if (!res.ok) {
        setMessage(data?.error ?? 'YouTubeコメント取得に失敗しました。')
        return
      }
      setPreview(makePreview(data.comments ?? [], 'youtube'))
      setMessage(`${(data.comments ?? []).length}件を読み込みました。`)
    } catch {
      setMessage('YouTubeコメント取得中にエラーが出ました。')
    } finally {
      setIsFetchingYoutube(false)
    }
  }

  const loadPastedComments = () => {
    const comments = parsePastedComments(pasteText)
    setPreview(makePreview(comments, 'paste'))
    setMessage(`${comments.length}件を読み込みました。`)
  }

  const updatePreviewBody = (id: string, body: string) => {
    setPreview(current => current.map(comment => comment.id === id ? { ...comment, body } : comment))
  }

  const togglePreview = (id: string) => {
    setPreview(current => current.map(comment => comment.id === id ? { ...comment, selected: !comment.selected } : comment))
  }

  const submit = () => {
    setMessage('')
    const formData = new FormData()
    formData.set('threadId', threadId)
    for (const comment of selectedComments) {
      formData.append('comments', comment.body.trim())
    }

    startTransition(async () => {
      const result: BulkImportResult = await bulkImportThreadComments(formData)
      setMessage(result.message)
      if (result.ok) setPreview([])
    })
  }

  return (
    <div className="space-y-4">
      <section className="border border-gray-300 bg-white p-3">
        <h2 className="font-bold text-gray-800 mb-2">取り込み先スレッド</h2>
        <input
          value={threadId}
          onChange={event => setThreadId(event.target.value)}
          placeholder="スレッドID 例: 277"
          inputMode="numeric"
          className="w-full max-w-xs border border-gray-300 px-2 py-1.5 text-sm"
        />
      </section>

      <section className="border border-gray-300 bg-white p-3">
        <h2 className="font-bold text-gray-800 mb-2">YouTubeコメント取得</h2>
        <div className="flex gap-2 flex-wrap">
          <input
            value={youtubeUrl}
            onChange={event => setYoutubeUrl(event.target.value)}
            placeholder="YouTube URL"
            className="flex-1 min-w-72 border border-gray-300 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={loadYoutubeComments}
            disabled={isFetchingYoutube || !youtubeUrl.trim()}
            className="px-3 py-1.5 text-sm text-white disabled:opacity-50"
            style={{ background: '#dc3545' }}
          >
            {isFetchingYoutube ? '取得中...' : '30件取得'}
          </button>
        </div>
      </section>

      <section className="border border-gray-300 bg-white p-3">
        <h2 className="font-bold text-gray-800 mb-2">X・あにまん・手動コピー取り込み</h2>
        <textarea
          value={pasteText}
          onChange={event => setPasteText(event.target.value)}
          rows={8}
          placeholder="1行につき1コメント。空行で区切った場合は、空行ごとに1コメントとして扱います。"
          className="w-full border border-gray-300 px-2 py-1.5 text-sm resize-y"
        />
        <button
          type="button"
          onClick={loadPastedComments}
          disabled={!pasteText.trim()}
          className="mt-2 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          style={{ background: '#0d6efd' }}
        >
          貼り付け内容を30件まで読み込み
        </button>
      </section>

      <section className="border border-gray-300 bg-white p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="font-bold text-gray-800">投稿前確認</h2>
          <span className="text-xs text-gray-500">{selectedComments.length}件選択中 / 最大{COMMENT_IMPORT_LIMIT}件</span>
        </div>

        {preview.length === 0 ? (
          <p className="text-xs text-gray-400">まだコメントが読み込まれていません。</p>
        ) : (
          <div className="space-y-2">
            {preview.map((comment, index) => (
              <label key={comment.id} className="block border border-gray-200 p-2">
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    checked={comment.selected}
                    onChange={() => togglePreview(comment.id)}
                  />
                  <span className="text-xs font-bold text-gray-500">#{index + 1}</span>
                </div>
                <textarea
                  value={comment.body}
                  onChange={event => updatePreviewBody(comment.id, event.target.value)}
                  rows={2}
                  maxLength={3000}
                  className="w-full border border-gray-200 px-2 py-1 text-sm resize-y"
                />
              </label>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={isPending || !threadId.trim() || selectedComments.length === 0}
          className="mt-3 w-full py-2 text-sm text-white font-bold disabled:opacity-50"
          style={{ background: '#198754' }}
        >
          {isPending ? '投稿中...' : '選択したコメントを一括投稿'}
        </button>

        {message && (
          <p className="mt-2 text-sm text-gray-700">{message}</p>
        )}
      </section>
    </div>
  )
}
