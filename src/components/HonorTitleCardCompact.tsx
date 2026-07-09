import type { HonorTitle } from '@/lib/honor-title'

interface Props {
  title: HonorTitle
  points: number
  nextTitle: HonorTitle | null
}

function formatPoints(value: number) {
  return new Intl.NumberFormat('ja-JP').format(value)
}

export function HonorTitleCardCompact({ title, points, nextTitle }: Props) {
  const progressPercent = nextTitle
    ? Math.max(
        0,
        Math.min(100, Math.round(((points - title.minPoints) / (nextTitle.minPoints - title.minPoints)) * 100))
      )
    : 100

  return (
    <div className="text-center">
      <div className="text-xl leading-none" aria-hidden="true">{title.icon}</div>
      <p className="mt-1 text-sm font-bold text-gray-900 leading-tight">{title.label}</p>
      <p className="mt-0.5 text-[11px] text-gray-600">累計 {formatPoints(points)}pt</p>

      {nextTitle ? (
        <div className="mt-1.5">
          <p className="text-[10px] leading-tight text-gray-500">
            次まであと{formatPoints(nextTitle.minPoints - points)}pt
          </p>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-500 transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-1.5 text-[10px] font-bold text-blue-600">最高位の称号です</p>
      )}
    </div>
  )
}
