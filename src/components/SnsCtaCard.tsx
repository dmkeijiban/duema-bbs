/**
 * SNSフォロー導線 — スレッド末尾CTAカード
 * 読み終えた満足感のある瞬間に見せるので、コンバージョン率が最も高い配置
 * URLs は Supabase site_settings から取得（管理画面で変更可能）。
 */

import { XLogo, YouTubeLogo, DiscordLogo } from '@/components/Icons'
import { getSnsUrls } from '@/lib/sns-server'

export async function SnsCtaCard() {
  const sns = await getSnsUrls()

  return (
    <div className="my-4 border border-gray-200 rounded-xl overflow-hidden">
      {/* ヘッダー */}
      <div className="px-4 py-3 text-center" style={{ background: 'linear-gradient(135deg, #1a3a6e 0%, #2a5298 100%)' }}>
        <p className="text-white text-sm font-bold leading-snug">
          📢 デュエマ情報をSNSでも発信中！
        </p>
        <p className="text-blue-200 text-xs mt-0.5">
          フォロー・チャンネル登録でデュエマ最新情報をチェック
        </p>
      </div>

      {/* ボタン群 — 1B: 各ボタンに理由ラベルを追加してクリック動機を補強 */}
      <div className="bg-white px-4 py-4 flex flex-col sm:flex-row gap-3 justify-center">

        {/* X */}
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
          <span className="text-[11px] text-gray-500 leading-tight text-center">大会速報・カード情報</span>
        </div>

        {/* YouTube */}
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
          <span className="text-[11px] text-gray-500 leading-tight text-center">デュエマ動画を毎週配信</span>
        </div>

        {/* Discord */}
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
