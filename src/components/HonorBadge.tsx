import type { HonorTitle } from '@/lib/honor-title'

interface Props {
  title: HonorTitle | null | undefined
  className?: string
}

// コメント欄・ランキング用の「アイコンのみ」称号バッジ。
// 文字ラベルは出さず、hoverのtitle属性でのみ称号名を確認できる。
export function HonorBadge({ title, className }: Props) {
  if (!title) return null
  return (
    <span
      className={`inline-block align-middle leading-none ${className ?? 'text-sm'}`}
      title={title.label}
      aria-label={`称号: ${title.label}`}
    >
      {title.icon}
    </span>
  )
}
