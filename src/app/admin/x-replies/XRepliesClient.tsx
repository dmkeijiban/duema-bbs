'use client'

import { useMemo, useState } from 'react'

type XReplyItem = {
  text: string
  authorName: string
  likeCount: number
  createdAt: string
  url: string
}

type ApiResult = {
  actorId: string
  runId: string
  datasetId: string
  sourceUrl: string
  maxItems: number
  replies: XReplyItem[]
}

function escapeCsv(value: string | number): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function makeCsv(items: XReplyItem[]): string {
  const header = ['投稿者名', '本文', 'いいね数', '投稿日時', 'URL']
  const rows = items.map(item => [
    item.authorName,
    item.text,
    item.likeCount,
    item.createdAt,
    item.url,
  ])

  return [header, ...rows].map(row => row.map(escapeCsv).join(',')).join('\r\n')
}

export function XRepliesClient() {
  const [tweetUrl, setTweetUrl] = useState('')
  const [maxItems, setMaxItems] = useState(50)
  const [result, setResult] = useState<ApiResult | null>(null)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const csv = useMemo(() => result ? makeCsv(result.replies) : '', [result])

  const fetchReplies = async () => {
    setMessage('')
    setResult(null)
    setIsLoading(true)

    try {
      const res = await fetch('/api/admin/x-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweetUrl, maxItems }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data?.error ?? 'Xリプライ取得に失敗しました。')
        return
      }
      setResult(data)
      setMessage(`${data.replies?.length ?? 0}件取得しました。`)
    } catch {
      setMessage('通信中にエラーが出ました。')
    } finally {
      setIsLoading(false)
    }
  }

  const downloadCsv = () => {
    if (!csv) return
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `x-replies-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <section className="border border-gray-300 bg-white p-3">
        <h2 className="font-bold text-gray-800 mb-2">取得条件</h2>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_9rem_auto] gap-2">
          <input
            value={tweetUrl}
            onChange={event => setTweetUrl(event.target.value)}
            placeholder="https://x.com/ユーザー名/status/123..."
            className="border border-gray-300 px-2 py-1.5 text-sm"
          />
          <input
            type="number"
            min={1}
            max={200}
            value={maxItems}
            onChange={event => setMaxItems(Number(event.target.value))}
            className="border border-gray-300 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={fetchReplies}
            disabled={isLoading || !tweetUrl.trim()}
            className="px-4 py-1.5 text-sm text-white font-bold disabled:opacity-50"
            style={{ background: '#111827' }}
          >
            {isLoading ? '取得中...' : '実行'}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          初期値は50件です。Apify Actorの完了まで待つため、投稿によっては少し時間がかかります。
        </p>
      </section>

      {message && (
        <p className="border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">{message}</p>
      )}

      {result && (
        <section className="border border-gray-300 bg-white p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="min-w-0">
              <h2 className="font-bold text-gray-800">取得結果</h2>
              <p className="text-xs text-gray-500 break-all">
                run: {result.runId} / dataset: {result.datasetId}
              </p>
            </div>
            <button
              type="button"
              onClick={downloadCsv}
              disabled={result.replies.length === 0}
              className="px-3 py-1.5 text-xs text-white font-bold disabled:opacity-50"
              style={{ background: '#198754' }}
            >
              CSVダウンロード
            </button>
          </div>

          <div className="overflow-x-auto border border-gray-200">
            <table className="w-full min-w-[880px] text-xs">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="border-b border-gray-200 px-2 py-1.5 text-left w-40">投稿者名</th>
                  <th className="border-b border-gray-200 px-2 py-1.5 text-left">本文</th>
                  <th className="border-b border-gray-200 px-2 py-1.5 text-right w-20">いいね</th>
                  <th className="border-b border-gray-200 px-2 py-1.5 text-left w-44">投稿日時</th>
                  <th className="border-b border-gray-200 px-2 py-1.5 text-left w-48">URL</th>
                </tr>
              </thead>
              <tbody>
                {result.replies.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-4 text-center text-gray-400">
                      取得できたリプライがありません。
                    </td>
                  </tr>
                ) : (
                  result.replies.map((reply, index) => (
                    <tr key={`${reply.url}-${index}`} className="align-top odd:bg-white even:bg-gray-50">
                      <td className="border-t border-gray-100 px-2 py-1.5 text-gray-700 break-all">{reply.authorName}</td>
                      <td className="border-t border-gray-100 px-2 py-1.5 text-gray-800 whitespace-pre-wrap break-words">{reply.text}</td>
                      <td className="border-t border-gray-100 px-2 py-1.5 text-right text-gray-700">{reply.likeCount}</td>
                      <td className="border-t border-gray-100 px-2 py-1.5 text-gray-600">{reply.createdAt || '-'}</td>
                      <td className="border-t border-gray-100 px-2 py-1.5 break-all">
                        {reply.url ? (
                          <a href={reply.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                            開く
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
