const CIV_BADGE: Record<string, string> = {
  火: 'bg-red-100 text-red-700',
  水: 'bg-blue-100 text-blue-700',
  自然: 'bg-green-100 text-green-700',
  光: 'bg-yellow-100 text-yellow-700',
  闇: 'bg-gray-200 text-gray-700',
  ゼロ: 'bg-stone-100 text-stone-700',
}

const CIV_STRIPE_COLORS: Record<string, string> = {
  光: '#f8fafc',
  水: '#2563eb',
  闇: '#111827',
  火: '#dc2626',
  自然: '#16a34a',
  ゼロ: '#a8a29e',
}

function splitCivilizations(civilization: string | null | undefined): string[] {
  return String(civilization ?? '')
    .split('/')
    .map(civ => civ.trim())
    .filter(Boolean)
}

export function isMultiCivilization(civilization: string | null | undefined): boolean {
  return String(civilization ?? '').includes('/') && splitCivilizations(civilization).length > 1
}

export function zukanRainbowStyle(civilization: string | null | undefined) {
  const colors = splitCivilizations(civilization).map(civ => CIV_STRIPE_COLORS[civ] ?? '#9ca3af')
  if (colors.length <= 1) return undefined

  const stops = colors.flatMap((color, index) => {
    const from = (index / colors.length) * 100
    const to = ((index + 1) / colors.length) * 100
    return [`${color} ${from}%`, `${color} ${to}%`]
  })

  return {
    backgroundImage: `linear-gradient(135deg, ${stops.join(', ')})`,
  }
}

export function ZukanRainbowBand({
  civilization,
  className = 'absolute left-0 top-0 z-10 h-1.5 w-full',
}: {
  civilization: string | null | undefined
  className?: string
}) {
  if (!isMultiCivilization(civilization)) return null

  return (
    <span
      aria-hidden="true"
      className={`${className} border-b border-white/50 shadow-[0_1px_2px_rgba(0,0,0,0.2)]`}
      style={zukanRainbowStyle(civilization)}
    />
  )
}

export function ZukanCivilizationBadge({
  civilization,
  size = 'xs',
}: {
  civilization: string
  size?: 'xs' | 'sm'
}) {
  const textSize = size === 'sm' ? 'text-xs leading-5' : 'text-[10px] leading-4'

  if (!isMultiCivilization(civilization)) {
    return (
      <span className={`inline-block rounded px-1 font-bold ${textSize} ${CIV_BADGE[civilization] ?? 'bg-gray-100 text-gray-600'}`}>
        {civilization}
      </span>
    )
  }

  return (
    <span className={`inline-flex max-w-full items-stretch overflow-hidden rounded border border-gray-300 bg-white font-bold text-gray-800 ${textSize}`}>
      <span aria-hidden="true" className="w-2 shrink-0 border-r border-black/10" style={zukanRainbowStyle(civilization)} />
      <span className="min-w-0 truncate px-1">{civilization}</span>
    </span>
  )
}
