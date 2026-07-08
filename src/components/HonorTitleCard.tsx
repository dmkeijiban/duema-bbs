import type { HonorTitle } from '@/lib/honor-title'

interface Props {
  title: HonorTitle
  points: number
  nextTitle: HonorTitle | null
}

function formatPoints(value: number) {
  return new Intl.NumberFormat('ja-JP').format(value)
}

export function HonorTitleCard({ title, points, nextTitle }: Props) {
  const progressPercent = nextTitle
    ? Math.max(
        0,
        Math.min(100, Math.round(((points - title.minPoints) / (nextTitle.minPoints - title.minPoints)) * 100))
      )
    : 100

  return (
    <section className="mt-4 rounded-sm border border-gray-200 bg-white px-4 py-5 text-center">
      <div className="text-4xl leading-none" aria-hidden="true">{title.icon}</div>
      <p className="mt-2 text-lg font-bold text-gray-900">{title.label}</p>
      <p className="mt-1 text-sm text-gray-600">累計 {formatPoints(points)}pt</p>

      {nextTitle ? (
        <div className="mx-auto mt-3 max-w-xs">
          <p className="text-xs text-gray-500">
            次の称号（{nextTitle.icon} {nextTitle.label}）まで あと{formatPoints(nextTitle.minPoints - points)}pt
          </p>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs font-bold text-blue-600">最高位の称号です</p>
      )}

      <p className="mx-auto mt-4 max-w-sm text-[11px] leading-relaxed text-gray-400">
        称号は累計ポイントで上がる活動バッジです。コメントや投稿を続けるほど成長します。
      </p>
    </section>
  )
}
