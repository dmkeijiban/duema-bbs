'use client'

import { useMemo, useState } from 'react'
import type { XPostDraft } from '@/lib/x-post-drafts'

type Props = {
  drafts: XPostDraft[]
}

function makeIntentUrl(text: string) {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`
}

export function XDraftsClient({ drafts }: Props) {
  const [items, setItems] = useState(drafts)
  const [message, setMessage] = useState('')

  const allText = useMemo(() => items.map(item => item.draft).join('\n\n---\n\n'), [items])

  const updateDraft = (threadId: number, draft: string) => {
    setItems(current => current.map(item => item.threadId === threadId ? { ...item, draft } : item))
  }

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setMessage('コピーしました。')
  }

  const downloadTxt = () => {
    const blob = new Blob([allText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `x-post-drafts-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <section className="border border-gray-300 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-gray-800">投稿文案一覧</h2>
            <p className="mt-1 text-xs text-gray-500">
              レス数が多い公開スレから作っています。ここでは投稿せず、コピーかX投稿画面を開くだけです。
            </p>
          </div>
          <button
            type="button"
            onClick={downloadTxt}
            disabled={items.length === 0}
            className="px-3 py-1.5 text-xs text-white font-bold disabled:opacity-50"
            style={{ background: '#198754' }}
          >
            TXT保存
          </button>
        </div>
        {message && <p className="mt-2 text-xs text-gray-600">{message}</p>}
      </section>

      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="border border-gray-300 bg-white p-4 text-center text-gray-400">
            人気スレがまだありません。
          </p>
        ) : (
          items.map((item, index) => (
            <section key={item.threadId} className="border border-gray-300 bg-white p-3">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-lg font-bold text-gray-500">{index + 1}位</span>
                    <span className="px-2 py-0.5 text-xs text-white font-bold" style={{ background: '#6c757d' }}>
                      {item.categoryName}
                    </span>
                    <span className="text-xs text-gray-500">{item.postCount}レス</span>
                  </div>
                  <a href={item.url} target="_blank" rel="noreferrer" className="font-bold text-blue-700 hover:underline">
                    {item.title}
                  </a>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => copyText(item.draft)}
                    className="px-3 py-1.5 text-xs border border-gray-400 text-gray-700 hover:bg-gray-50"
                  >
                    コピー
                  </button>
                  <a
                    href={makeIntentUrl(item.draft)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 text-xs text-white font-bold"
                    style={{ background: '#111827' }}
                  >
                    Xで開く
                  </a>
                </div>
              </div>
              <textarea
                value={item.draft}
                onChange={event => updateDraft(item.threadId, event.target.value)}
                rows={5}
                maxLength={280}
                className="w-full border border-gray-300 px-2 py-1.5 text-sm resize-y"
              />
              <div className="mt-1 text-right text-xs text-gray-500">
                {item.draft.length}/280
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
