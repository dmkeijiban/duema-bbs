'use client'

import Link from 'next/link'

interface Props {
  threadId: number
}

function trackClick(target: string, threadId: number) {
  if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
    ;(window as any).gtag('event', 'next_read_click', {
      link_target: target,
      thread_id: threadId,
    })
  }
}

export function NextReadNav({ threadId }: Props) {
  return (
    <nav className="mt-3 mb-4" aria-label="次に読む">
      <p className="text-[11px] text-gray-400 mb-1.5 px-0.5">次に読む</p>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <Link
          href="/"
          prefetch={true}
          onClick={() => trackClick('/', threadId)}
          className="flex items-center justify-center gap-1.5 min-h-[44px] px-2 border border-gray-300 bg-white rounded text-xs text-gray-700 font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          <span>🏠</span><span>トップへ戻る</span>
        </Link>
        <Link
          href="/new"
          prefetch={true}
          onClick={() => trackClick('/new', threadId)}
          className="flex items-center justify-center gap-1.5 min-h-[44px] px-2 border border-blue-300 bg-blue-50 rounded text-xs text-blue-700 font-medium hover:bg-blue-100 active:bg-blue-200 transition-colors"
        >
          <span>⏱</span><span>新着スレ一覧</span>
        </Link>
        <Link
          href="/ranking"
          prefetch={true}
          onClick={() => trackClick('/ranking', threadId)}
          className="flex items-center justify-center gap-1.5 min-h-[44px] px-2 border border-gray-300 bg-white rounded text-xs text-gray-700 font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          <span>📊</span><span>人気スレ一覧</span>
        </Link>
        <Link
          href="/random"
          prefetch={true}
          onClick={() => trackClick('/random', threadId)}
          className="flex items-center justify-center gap-1.5 min-h-[44px] px-2 border border-gray-300 bg-white rounded text-xs text-gray-700 font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          <span>🎲</span><span>ランダムで読む</span>
        </Link>
      </div>
    </nav>
  )
}
