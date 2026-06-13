'use client'

import { useState } from 'react'
import { SITE_URL } from '@/lib/site-config'

interface Props {
  slug: string
  displayName: string
}

export function ShareButtons({ slug, displayName }: Props) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')

  const url = `${SITE_URL}/u/${slug}`
  const xShareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`${displayName}さんのデュエマ掲示板プロフィール`)}`
  const lineShareUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`

  async function handleCopy() {
    setCopyError('')
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError('コピーに失敗しました。URLを手動でコピーしてください。')
    }
  }

  return (
    <section className="mt-4 bg-white border border-gray-300 rounded-sm overflow-hidden">
      <div className="border-b border-gray-200 px-4 py-2.5 bg-gray-50">
        <h2 className="font-bold text-sm text-gray-800">この投稿者ページを共有</h2>
      </div>
      <div className="px-4 py-3 flex flex-wrap gap-2">
        <a
          href={xShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>𝕏</span><span>Xで共有</span>
        </a>
        <a
          href={lineShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>LINE</span><span>LINEで共有</span>
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>{copied ? '✓' : '🔗'}</span>
          <span>{copied ? 'コピーしました' : 'URLをコピー'}</span>
        </button>
      </div>
      {copyError && <p className="px-4 pb-3 text-xs text-red-600">{copyError}</p>}
    </section>
  )
}
