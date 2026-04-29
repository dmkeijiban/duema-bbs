'use client'

/**
 * SNSフォロー導線 — 右下固定フローティングバー（全ページ表示）
 * 平常時は半透明、スクロール中〜停止後1.5秒はくっきり表示
 */

import { useEffect, useRef, useState } from 'react'
import { XLogo, YouTubeLogo, DiscordLogo } from '@/components/Icons'
import { SNS } from '@/lib/sns'

const BUTTONS = [
  {
    href: SNS.x,
    label: 'X (Twitter)',
    icon: <XLogo size={18} />,
    bg: 'bg-black',
  },
  {
    href: SNS.youtube,
    label: 'YouTube',
    icon: <YouTubeLogo size={18} />,
    bg: 'bg-[#ff0000]',
  },
  {
    href: SNS.discord,
    label: 'Discord',
    icon: <DiscordLogo size={18} />,
    bg: 'bg-[#5865F2]',
  },
] as const

export function SnsFloatingBar() {
  const [scrolling, setScrolling] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onScroll = () => {
      setScrolling(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setScrolling(false), 1500)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div
      className={`fixed bottom-4 right-3 z-40 flex flex-col gap-2 transition-opacity duration-300 ${
        scrolling ? 'opacity-100' : 'opacity-30'
      }`}
      aria-label="SNSフォローリンク"
    >
      {BUTTONS.map(({ href, label, icon, bg }) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className={`w-10 h-10 flex items-center justify-center rounded-full text-white shadow-md transition-all duration-150 active:scale-95 ${bg}`}
        >
          {icon}
        </a>
      ))}
    </div>
  )
}
