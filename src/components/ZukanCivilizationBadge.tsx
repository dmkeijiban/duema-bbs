const CIV_BADGE: Record<string, string> = {
  火: 'bg-red-100 text-red-700',
  水: 'bg-blue-100 text-blue-700',
  自然: 'bg-green-100 text-green-700',
  光: 'bg-yellow-100 text-yellow-700',
  闇: 'bg-gray-200 text-gray-700',
  ゼロ: 'bg-stone-100 text-stone-700',
}

export function splitCivilizations(civilization: string | null | undefined): string[] {
  return String(civilization ?? '')
    .split('/')
    .map(civ => civ.trim())
    .filter(Boolean)
}

export function isMultiCivilization(civilization: string | null | undefined): boolean {
  return String(civilization ?? '').includes('/') && splitCivilizations(civilization).length > 1
}

export function ZukanCivilizationBadge({
  civilization,
  size = 'xs',
}: {
  civilization: string
  size?: 'xs' | 'sm'
}) {
  const textSize = size === 'sm' ? 'text-xs leading-5' : 'text-[10px] leading-4'
  const civilizations = splitCivilizations(civilization)

  if (!isMultiCivilization(civilization)) {
    return (
      <span className={`inline-block rounded px-1 font-bold ${textSize} ${CIV_BADGE[civilization] ?? 'bg-gray-100 text-gray-600'}`}>
        {civilization}
      </span>
    )
  }

  return (
    <>
      {civilizations.map(civ => (
        <span key={civ} className={`inline-block rounded px-1 font-bold ${textSize} ${CIV_BADGE[civ] ?? 'bg-gray-100 text-gray-600'}`}>
          {civ}
        </span>
      ))}
    </>
  )
}
