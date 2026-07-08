'use client'

import Link from 'next/link'
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: 'h-5 w-5',
} as const

function TriangleIcon(props: IconProps) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M12 5 20 19 4 19Z" />
    </svg>
  )
}

function RotateCwIcon(props: IconProps) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

function SquarePenIcon(props: IconProps) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.4 2.6a1.9 1.9 0 0 1 2.7 2.7L12 14.4l-3.6.9.9-3.6Z" />
    </svg>
  )
}

function SettingsIcon(props: IconProps) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82A1.65 1.65 0 0 0 3 13.09H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  )
}

const BUTTON_CLASS =
  'flex h-10 w-10 shrink-0 items-center justify-center border border-gray-300 bg-white/50 text-gray-400 active:bg-gray-200/60'

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
      className="md:hidden fixed flex items-center gap-1.5"
      style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))', right: 12, zIndex: 40 }}
    >
      <button type="button" onClick={scrollToTop} aria-label="一番上へ戻る" className={BUTTON_CLASS}>
        <TriangleIcon />
      </button>
      <button type="button" onClick={reload} aria-label="更新" className={BUTTON_CLASS}>
        <RotateCwIcon />
      </button>
      <button type="button" onClick={scrollToCommentForm} aria-label="コメントを書く" className={BUTTON_CLASS}>
        <SquarePenIcon />
      </button>
      <Link href="/mypage" aria-label="設定" className={BUTTON_CLASS}>
        <SettingsIcon />
      </Link>
    </div>
  )
}
