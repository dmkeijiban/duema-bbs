'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type SVGProps } from 'react'
import {
  moveToCommentForm,
  moveToNewThreadForm,
  reloadCurrentPage,
  scrollToPageTop,
} from './floatingActionHandlers'

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
  'flex h-12 w-[88px] items-center justify-center gap-1.5 border border-gray-300 bg-white/90 px-2 text-xs text-gray-600 shadow-sm hover:bg-gray-100 active:bg-gray-200'

function isTargetPage(pathname: string) {
  if (pathname === '/') return true

  return [
    '/new',
    '/update',
    '/category/',
    '/ranking',
    '/random',
    '/archived',
    '/kakolog',
    '/thread/',
    '/zukan',
    '/summary',
  ].some(prefix => pathname === prefix || pathname.startsWith(prefix))
}

export function DesktopFloatingActions() {
  const pathname = usePathname()
  if (!isTargetPage(pathname)) return null

  const isThreadPage = pathname.startsWith('/thread/') && pathname !== '/thread/new'
  const moveToPostForm = isThreadPage ? moveToCommentForm : moveToNewThreadForm
  const postLabel = isThreadPage ? 'コメント書く' : 'スレッド立てる'

  return (
    <nav
      aria-label="ページ操作"
      className="fixed right-3 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-1.5 md:flex"
    >
      <button type="button" onClick={scrollToPageTop} className={BUTTON_CLASS}>
        <TriangleIcon aria-hidden="true" />
        <span>上に行く</span>
      </button>
      <button type="button" onClick={reloadCurrentPage} className={BUTTON_CLASS}>
        <RotateCwIcon aria-hidden="true" />
        <span>更新</span>
      </button>
      <button type="button" onClick={moveToPostForm} className={BUTTON_CLASS}>
        <SquarePenIcon aria-hidden="true" />
        <span>{postLabel}</span>
      </button>
      <Link href="/mypage" className={BUTTON_CLASS}>
        <SettingsIcon aria-hidden="true" />
        <span>設定</span>
      </Link>
    </nav>
  )
}
