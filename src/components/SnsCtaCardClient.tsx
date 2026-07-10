'use client'

import { usePathname } from 'next/navigation'
import { XLogo, YouTubeLogo, DiscordLogo } from '@/components/Icons'
import type { SnsUrls } from '@/lib/sns'

function shouldShowSnsCta(pathname: string | null) {
  if (!pathname) return false
  if (pathname === '/') return true
  if (pathname === '/zukan') return true
  if (/^\/thread\/[^/]+$/.test(pathname)) return true
  return false
}

export function SnsCtaCardClient({ sns }: { sns: SnsUrls }) {
  const pathname = usePathname()

  if (!shouldShowSnsCta(pathname)) return null

  return (
    <div className="mt-3 mb-0 overflow-hidden rounded-none border border-gray-200">
      <div className="px-4 py-3 text-center" style={{ background: 'linear-gradient(135deg, #1a3a6e 0%, #2a5298 100%)' }}>
        <p className="text-white text-sm font-bold leading-snug">
          📢 デュエマ情報をSNSでも発信中！
        </p>
        <p className="text-blue-200 text-xs mt-0.5">
          フォロー・チャンネル登録でデュエマ最新情報をチェック
        </p>
      </div>

      <div className="bg-white px-4 py-4 flex flex-col sm:flex-row gap-3 justify-center">
        <div className="flex flex-col items-center gap-1">
          <a
            href={sns.x}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-bold transition-all duration-150 hover:opacity-85 active:scale-95 shadow-sm w-full sm:w-auto"
            style={{ background: '#000' }}
          >
            <XLogo size={16} />
            <span>Xでフォロー</span>
          </a>
          <span className="text-[11px] text-gray-500 leading-tight text-center">カード情報・デュエマ大喜利開催中</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <a
            href={sns.youtube}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-bold transition-all duration-150 hover:opacity-85 active:scale-95 shadow-sm w-full sm:w-auto"
            style={{ background: '#ff0000' }}
          >
            <YouTubeLogo size={16} />
            <span>チャンネル登録</span>
          </a>
          <span className="text-[11px] text-gray-500 leading-tight text-center">デュエマ反応集を毎日配信</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <a
            href={sns.discord}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-bold transition-all duration-150 hover:opacity-85 active:scale-95 shadow-sm w-full sm:w-auto"
            style={{ background: '#5865F2' }}
          >
            <DiscordLogo size={16} />
            <span>Discordに参加</span>
          </a>
          <span className="text-[11px] text-gray-500 leading-tight text-center">リアルタイムで対戦相手を募集</span>
        </div>
      </div>
    </div>
  )
}
