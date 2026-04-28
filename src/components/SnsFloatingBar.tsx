/**
 * SNSフォロー導線 — 右下固定フローティングバー（全ページ表示）
 * スクロールに関係なく常時見えるので「存在を知らせる」役割
 */

import { XLogo, YouTubeLogo, DiscordLogo } from '@/components/Icons'
import { SNS } from '@/lib/sns'

const BUTTONS = [
  {
    href: SNS.x,
    label: 'X (Twitter)',
    icon: <XLogo size={18} />,
    bg: 'bg-black hover:bg-gray-800',
  },
  {
    href: SNS.youtube,
    label: 'YouTube',
    icon: <YouTubeLogo size={18} />,
    bg: 'bg-[#ff0000] hover:bg-red-700',
  },
  {
    href: SNS.discord,
    label: 'Discord',
    icon: <DiscordLogo size={18} />,
    bg: 'bg-[#5865F2] hover:bg-indigo-700',
  },
] as const

export function SnsFloatingBar() {
  return (
    <div
      className="fixed bottom-20 right-3 z-40 flex flex-col gap-2"
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
