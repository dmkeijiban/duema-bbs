import { formatJstDateTime, formatRate, type MakerUsageStats } from '@/lib/maker-usage-stats'

type Props = {
  stats: MakerUsageStats | null
  errorMessage: string | null
}

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex min-h-[92px] flex-col justify-center rounded-xl border bg-white p-3">
      <p className="text-xs font-bold text-gray-500">{label}</p>
      <p className="mt-1 break-all text-2xl font-black tabular-nums">{value}</p>
      {note && <p className="mt-1 text-[10px] text-gray-400">{note}</p>}
    </div>
  )
}

function TodayStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-h-[56px] flex-col justify-center rounded-lg border bg-white px-3 py-2">
      <p className="text-[10px] font-bold text-gray-500">{label}</p>
      <p className="text-lg font-black tabular-nums">{value}</p>
    </div>
  )
}

export default function UsageStatsSection({ stats, errorMessage }: Props) {
  return (
    <section className="mt-4 rounded-xl border bg-slate-100/60 p-4">
      <h2 className="text-base font-black">利用状況</h2>
      <p className="mt-1 text-xs text-gray-500">回答系は保存済みデータから集計。回数系（Tier作成・画像保存・X共有・閲覧）はイベント計測開始後の公開ページ操作のみが対象で、計測開始前の回数は含まれません。JST基準。</p>

      {!stats ? (
        <p className="mt-3 min-h-[92px] rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          利用状況を取得できませんでした。{errorMessage ? `（${errorMessage}）` : ''}公開設定やTier操作には影響ありません。
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatCard label="回答登録者数" value={`${stats.registrantCount}人`} />
            <StatCard label="回答登録件数" value={`${stats.submissionCount}件`} note="1ユーザー1回答（上書き）" />
            <StatCard label="今日の新規登録者数" value={`${stats.todayNewRegistrantCount}人`} note="更新のみは含まない" />
            <StatCard label="最終回答日時" value={formatJstDateTime(stats.lastSubmissionAt)} />
            <StatCard label="Tier作成回数" value={`${stats.events.tier_created.total}回`} note="計測開始後のみ" />
            <StatCard label="画像保存回数" value={`${stats.events.image_saved.total}回`} note="計測開始後のみ" />
            <StatCard label="X共有回数" value={`${stats.events.x_shared.total}回`} note="計測開始後のみ" />
            <StatCard label="みんなのTier閲覧回数" value={`${stats.events.aggregate_viewed.total}回`} note="計測開始後のみ" />
            <StatCard label="登録率" value={formatRate(stats.registrantCount, stats.events.tier_created.uniqueActors)} note="登録者数 ÷ Tier作成ユニーク数" />
            <StatCard label="共有率" value={formatRate(stats.events.x_shared.total, stats.events.tier_created.total)} note="X共有回数 ÷ Tier作成回数" />
          </div>

          <h3 className="mt-4 text-sm font-black">今日の利用状況（JST）</h3>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <TodayStat label="今日のTier作成" value={stats.events.tier_created.today} />
            <TodayStat label="今日の回答登録" value={stats.todaySubmissionActivityCount} />
            <TodayStat label="今日の画像保存" value={stats.events.image_saved.today} />
            <TodayStat label="今日のX共有" value={stats.events.x_shared.today} />
            <TodayStat label="今日のみんなのTier閲覧" value={stats.events.aggregate_viewed.today} />
          </div>
        </>
      )}
    </section>
  )
}
