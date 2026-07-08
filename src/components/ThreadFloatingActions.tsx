'use client'

import Link from 'next/link'

const BUTTON_CLASS =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-700 text-lg leading-none active:bg-gray-200'

export function ThreadFloatingActions() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const reload = () => {
    window.location.reload()
  }

  const scrollToCommentForm = () => {
    document.getElementById('reply-form-bottom')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div
      className="md:hidden fixed flex items-center gap-1 rounded-full border border-gray-300 bg-white/80 px-1 py-1 shadow-md backdrop-blur-sm"
      style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))', right: 12, zIndex: 40 }}
    >
      <button type="button" onClick={scrollToTop} aria-label="一番上へ戻る" className={BUTTON_CLASS}>
        ▲
      </button>
      <button type="button" onClick={reload} aria-label="更新" className={BUTTON_CLASS}>
        ↻
      </button>
      <button type="button" onClick={scrollToCommentForm} aria-label="コメントを書く" className={BUTTON_CLASS}>
        ✏️
      </button>
      <Link href="/mypage" aria-label="設定" className={BUTTON_CLASS}>
        ⚙️
      </Link>
    </div>
  )
}
