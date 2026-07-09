import type { HonorTitle } from '@/lib/honor-title'

interface Props {
  title: HonorTitle
  points: number
  nextTitle: HonorTitle | null
  className?: string
}

function formatPoints(value: number) {
  return new Intl.NumberFormat('ja-JP').format(value)
}

// プロフィールページで「一番目立つ情報」として使う大きめの称号カード。
// RPGのステータス画面のような見た目を意識し、アイコン・称号名を大きく、
// 進捗バーはカード下部いっぱいに配置する。高さは親（flexコンテナ）に合わせる。
export function HonorTitleCard({ title, points, nextTitle, className }: Props) {
  const progressPercent = nextTitle
    ? Math.max(
        0,
        Math.min(100, Math.round(((points - title.minPoints) / (nextTitle.minPoints - title.minPoints)) * 100))
      )
    : 100

  return (
    <div
      className={`flex h-full flex-col items-center rounded-lg border-2 border-indigo-100 bg-gradient-to-b from-indigo-50/70 via-white to-white px-5 py-6 text-center shadow-sm ${className ?? ''}`}
    >
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="text-6xl leading-none" aria-hidden="true">{title.icon}</div>
        <p className="mt-3 text-2xl font-bold text-gray-900">{title.label}</p>
        <p className="mt-1.5 text-sm text-gray-600">累計 {formatPoints(points)}pt</p>
      </div>

      <div className="w-full">
        {nextTitle ? (
          <>
            <p className="text-xs text-gray-500">次まで あと{formatPoints(nextTitle.minPoints - points)}pt</p>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-blue-500 transition-[width]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-xs font-bold text-blue-600">最高位の称号です</p>
        )}
      </div>
    </div>
  )
}
