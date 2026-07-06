import type { ReactNode } from 'react'

type ZukanPseudoCardProps = {
  name: string
  civilization?: string | null
  cost?: number | null
  cardType?: string | null
  power?: string | null
  rarity?: string | null
  size?: 'sm' | 'md' | 'lg'
  selected?: boolean
  disabled?: boolean
  count?: number
  showMissingLabel?: boolean
  className?: string
  children?: ReactNode
}

const CIV_STYLE: Record<string, { frame: string; header: string; badge: string }> = {
  光: { frame: 'border-yellow-300 bg-yellow-50', header: 'bg-yellow-100 text-yellow-800', badge: 'bg-yellow-200 text-yellow-900' },
  水: { frame: 'border-blue-300 bg-blue-50', header: 'bg-blue-100 text-blue-800', badge: 'bg-blue-200 text-blue-900' },
  闇: { frame: 'border-gray-500 bg-gray-100', header: 'bg-gray-700 text-white', badge: 'bg-gray-700 text-white' },
  火: { frame: 'border-red-300 bg-red-50', header: 'bg-red-100 text-red-800', badge: 'bg-red-200 text-red-900' },
  自然: { frame: 'border-green-300 bg-green-50', header: 'bg-green-100 text-green-800', badge: 'bg-green-200 text-green-900' },
}

const SIZE_STYLE = {
  sm: {
    header: 'min-h-6 px-1.5 py-0.5',
    name: 'text-[9px]',
    cost: 'h-4 w-4 text-[10px]',
    body: 'p-1.5',
    badge: 'text-[9px]',
    center: 'py-1',
    centerText: 'text-[10px]',
    missing: 'text-[9px]',
    footer: 'min-h-5 text-[9px]',
  },
  md: {
    header: 'min-h-7 px-2 py-1',
    name: 'text-[10px]',
    cost: 'h-5 w-5 text-[11px]',
    body: 'p-2',
    badge: 'text-[10px]',
    center: 'py-2',
    centerText: 'text-[11px]',
    missing: 'text-[10px]',
    footer: 'min-h-6 text-[10px]',
  },
  lg: {
    header: 'min-h-9 px-2.5 py-1.5',
    name: 'text-xs',
    cost: 'h-6 w-6 text-xs',
    body: 'p-2.5',
    badge: 'text-[11px]',
    center: 'py-3',
    centerText: 'text-xs',
    missing: 'text-[11px]',
    footer: 'min-h-7 text-[11px]',
  },
} as const

export default function ZukanPseudoCard({
  name,
  civilization,
  cost,
  cardType,
  power,
  rarity,
  size = 'md',
  selected = false,
  disabled = false,
  count,
  showMissingLabel = true,
  className = '',
  children,
}: ZukanPseudoCardProps) {
  const style = civilization ? CIV_STYLE[civilization] : null
  const frame = style?.frame ?? 'border-gray-300 bg-gray-50'
  const header = style?.header ?? 'bg-gray-100 text-gray-700'
  const badge = style?.badge ?? 'bg-gray-200 text-gray-700'
  const sizeStyle = SIZE_STYLE[size]

  return (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-[6px] border-2 ${frame} shadow-sm ${selected ? 'ring-2 ring-blue-500 ring-offset-1' : ''} ${disabled ? 'opacity-50 grayscale' : ''} ${className}`}
      style={{ aspectRatio: '63 / 88' }}
      aria-label={`${name} の擬似カード`}
      aria-disabled={disabled || undefined}
    >
      {count !== undefined && count > 0 && (
        <span className="absolute right-1 top-8 z-10 rounded-full bg-gray-900/85 px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
          x{count}
        </span>
      )}
      <div className={`flex items-start justify-between gap-1 ${sizeStyle.header} ${header}`}>
        <span
          className={`min-w-0 overflow-hidden font-bold leading-tight ${sizeStyle.name}`}
          style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}
        >
          {name}
        </span>
        {cost !== null && cost !== undefined && (
          <span className={`grid shrink-0 place-items-center rounded-full bg-white font-black text-gray-800 ${sizeStyle.cost}`}>
            {cost}
          </span>
        )}
      </div>
      <div className={`flex flex-1 flex-col justify-between ${sizeStyle.body}`}>
        <div className="flex flex-wrap gap-1">
          {civilization && <span className={`rounded px-1 font-bold ${sizeStyle.badge} ${badge}`}>{civilization}</span>}
          {rarity && <span className={`rounded bg-white/80 px-1 font-bold text-gray-500 ${sizeStyle.badge}`}>{rarity}</span>}
        </div>
        <div className={`grid flex-1 place-items-center ${sizeStyle.center}`}>
          {children ?? (
            <div className={`text-center font-bold leading-snug text-gray-700 ${sizeStyle.centerText}`}>
              <div>{cardType ?? 'カード'}</div>
              {showMissingLabel && <div className={`mt-1 text-gray-500 ${sizeStyle.missing}`}>画像なし</div>}
            </div>
          )}
        </div>
        <div className={`flex items-center justify-between border-t border-black/10 pt-1 font-bold text-gray-700 ${sizeStyle.footer}`}>
          <span className="truncate">{cardType ?? ''}</span>
          {power && <span className="ml-1 shrink-0 font-mono">{power}</span>}
        </div>
      </div>
    </div>
  )
}
