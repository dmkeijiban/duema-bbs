'use client'

import { useCallback, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatJstDateTime, formatRate, type MakerUsageStats } from '@/lib/maker-usage-stats'

type Props = { stats: MakerUsageStats | null; errorMessage: string | null }

function Card({ label, value, note, compact = false }: { label: string; value: string; note?: string; compact?: boolean }) {
  return <div className="flex min-h-[88px] min-w-0 flex-col justify-center rounded-xl border bg-white p-3">
    <p className="text-[11px] font-bold leading-tight text-gray-500">{label}</p>
    <p className={`${compact ? 'text-sm sm:text-base' : 'text-xl sm:text-2xl'} mt-1 whitespace-nowrap font-black tabular-nums`}>{value}</p>
    {note && <p className="mt-1 text-[10px] leading-tight text-gray-400">{note}</p>}
  </div>
}
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mt-4"><h3 className="text-sm font-black">{title}</h3><div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">{children}</div></div>
}

export default function UsageStatsSection({ stats, errorMessage }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const refresh = useCallback(() => startTransition(() => router.refresh()), [router])

  useEffect(() => {
    const timer = window.setInterval(refresh, 300_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  if (!stats) return <section className="mt-4 rounded-xl border bg-slate-100/60 p-4"><h2 className="font-black">利用状況</h2><p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">統計を取得できませんでした。{errorMessage ? `（${errorMessage}）` : ''}公開設定やTier操作には影響ありません。</p></section>
  const e = stats.events
  return <section className="mt-4 rounded-xl border bg-slate-100/60 p-4">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-black">利用状況</h2>
      <button type="button" onClick={refresh} disabled={isPending} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60">
        {isPending ? '更新中…' : '手動更新'}
      </button>
    </div>
    <p className="mt-1 text-xs text-gray-500">5分ごとに自動更新。イベントは各migration適用後の公開ページ操作のみ。計測開始前のアクセスは含みません。JST基準。</p>
    {stats.acquisitionStatsAvailable && <Group title="アクセス状況">
      <Card label="総アクセス数（PV）" value={`${e.page_viewed.total}PV`} /><Card label="今日のアクセス数（PV・JST）" value={`${e.page_viewed.today}PV`} />
      <Card label="ユニーク利用者数" value={`${e.page_viewed.uniqueActors}人`} note="ログイン時はuser ID、未ログイン時は匿名visitor ID。同一人物を完全には特定できません" />
    </Group>}
    <Group title="回答状況">
      <Card label="回答登録者数" value={`${stats.registrantCount}人`} /><Card label="回答登録件数" value={`${stats.submissionCount}件`} note="1ユーザー1回答（上書き）" />
      <Card label="今日の新規回答者数" value={`${stats.todayNewRegistrantCount}人`} /><Card label="最終回答日時" value={formatJstDateTime(stats.lastSubmissionAt)} compact />
    </Group>
    <Group title="利用状況">
      <Card label="Tier作成回数" value={`${e.tier_created.total}回`} /><Card label="画像保存回数" value={`${e.image_saved.total}回`} /><Card label="X共有回数" value={`${e.x_shared.total}回`} /><Card label="みんなのTier閲覧回数" value={`${e.aggregate_viewed.total}回`} />
      <Card label="登録率" value={formatRate(stats.registrantCount, e.tier_created.uniqueActors)} note="回答登録者 ÷ Tier作成ユニーク" /><Card label="共有率" value={formatRate(e.x_shared.total, e.tier_created.total)} note="X共有 ÷ Tier作成" />
    </Group>
    {stats.acquisitionStatsAvailable && <Group title="流入・登録">
      <Card label="ログイン・登録導線クリック数" value={`${e.auth_cta_clicked.total}回`} /><Card label="Tier表経由の新規登録者数" value={`${e.signup_completed.uniqueActors}人`} />
      <Card label="登録後の回答保存人数" value={`${e.submission_after_signup.uniqueActors}人`} /><Card label="訪問→登録率" value={formatRate(e.signup_completed.uniqueActors, e.page_viewed.uniqueActors)} /><Card label="登録→回答保存率" value={formatRate(e.submission_after_signup.uniqueActors, e.signup_completed.uniqueActors)} />
    </Group>}
    <Group title="今日の利用状況（JST）">
      {stats.acquisitionStatsAvailable && <><Card label="今日の登録導線クリック" value={`${e.auth_cta_clicked.today}回`} /><Card label="今日のTier経由新規登録" value={`${e.signup_completed.today}人`} /><Card label="今日の登録後回答保存" value={`${e.submission_after_signup.today}人`} /></>}
      <Card label="今日のTier作成" value={`${e.tier_created.today}回`} /><Card label="今日の回答登録" value={`${stats.todaySubmissionActivityCount}件`} /><Card label="今日の画像保存" value={`${e.image_saved.today}回`} /><Card label="今日のX共有" value={`${e.x_shared.today}回`} /><Card label="今日のみんなのTier閲覧" value={`${e.aggregate_viewed.today}回`} />
    </Group>
  </section>
}
