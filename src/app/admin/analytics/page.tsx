import Link from 'next/link'
import { AnalyticsRefresh } from '@/components/admin/AnalyticsRefresh'
import MakerPublishToggle from '@/components/admin/MakerPublishToggle'
import { TotalPvChart } from '@/components/admin/TotalPvChart'
import {
  getGa4DashboardData,
  getInternalDashboardData,
  type Ga4PageRow,
  type RecentThreadActivity,
} from '@/lib/admin-dashboard'
import { createAdminClient } from '@/lib/supabase-admin'
import { fetchProjectSummaries, normalizePeriod, type ProjectSummary } from '@/lib/admin-maker-analytics'

function Tabs({ active }: { active: 'site' | 'makers' }) {
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto border-b">
      <Link prefetch={false} className={`shrink-0 px-3 py-2 text-sm font-bold ${active === 'site' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500'}`} href="/admin/analytics?tab=site">サイト全体</Link>
      <Link prefetch={false} className={`shrink-0 px-3 py-2 text-sm font-bold ${active === 'makers' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500'}`} href="/admin/analytics?tab=makers">メーカー企画</Link>
      <Link className="shrink-0 px-3 py-2 text-sm font-bold text-gray-500 hover:text-blue-700" href="/admin/campaign-ranking">キャンペーン</Link>
      <Link className="shrink-0 px-3 py-2 text-sm font-bold text-gray-500 hover:text-blue-700" href="/admin/duema-stats">ユーザー・プロフィール</Link>
      <Link className="shrink-0 px-3 py-2 text-sm font-bold text-gray-500 hover:text-blue-700" href="/admin/ranking-preview">ランキング確認</Link>
    </nav>
  )
}

function Metric({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return <div className="rounded-lg border bg-white p-3"><p className="text-xs font-bold text-gray-500">{label}</p><p className="mt-1 text-2xl font-black tabular-nums">{typeof value === 'number' ? value.toLocaleString('ja-JP') : value}</p>{note && <p className="mt-1 text-[10px] text-gray-400">{note}</p>}</div>
}

function Periods({ period }: { period: string }) {
  return <div className="flex flex-wrap gap-1">{[['today', '今日'], ['7d', '過去7日'], ['30d', '過去30日'], ['all', '全期間']].map(([key, label]) => <Link prefetch={false} key={key} href={`/admin/analytics?tab=makers&period=${key}`} className={`rounded border px-3 py-1.5 text-xs font-bold ${period === key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'bg-white text-gray-600'}`}>{label}</Link>)}</div>
}

function StatCell({ value, label, size = 'lg', accent, align = 'right' }: { value: number; label: string; size?: 'lg' | 'md'; accent?: boolean; align?: 'left' | 'right' }) {
  const isZero = value === 0
  const valueClass = isZero
    ? `${size === 'lg' ? 'text-lg' : 'text-sm'} font-bold text-gray-300`
    : accent
      ? `${size === 'lg' ? 'text-xl' : 'text-sm'} font-black text-blue-700`
      : `${size === 'lg' ? 'text-xl' : 'text-sm'} font-black text-gray-900`
  return (
    <div className={align === 'right' ? 'text-right' : 'text-left'}>
      <p className={`tabular-nums leading-tight ${valueClass}`}>{formatNumber(value)}</p>
      <p className="text-[10px] font-bold text-gray-400">{label}</p>
    </div>
  )
}

function computeStatus(p: ProjectSummary): { label: string; dotClass: string; textClass: string } {
  const { pv, uniqueActors, submissions } = p
  if (pv === 0 && uniqueActors === 0 && submissions === 0) return { label: 'ほぼ動きなし', dotClass: 'bg-gray-300', textClass: 'text-gray-400' }
  if (submissions === 0) return { label: 'PVはあるが未参加', dotClass: 'bg-amber-400', textClass: 'text-amber-700' }
  const conversion = uniqueActors > 0 ? submissions / uniqueActors : 0
  if (conversion >= 0.15) return { label: '好調', dotClass: 'bg-green-500', textClass: 'text-green-700' }
  return { label: '参加あり', dotClass: 'bg-blue-400', textClass: 'text-blue-700' }
}

function StatusChip({ project }: { project: ProjectSummary }) {
  const status = computeStatus(project)
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold ${status.textClass}`}><span className={`h-2 w-2 shrink-0 rounded-full ${status.dotClass}`}/>{status.label}</span>
}

type DisplayGa4PageRow = Ga4PageRow & {
  title: string
  displayPath: string
  href: string
}

const PAGE_LABELS: Record<string, string> = {
  '/': 'デュエマ掲示板 TOPページ',
  '/ranking': 'ランキング',
  '/zukan': '思い出図鑑',
  '/mypage': 'マイページ',
  '/admin': '管理画面',
  '/login': 'ログイン',
  '/thread/new': 'スレ作成',
  '/settings': '設定',
  '/favorites': 'お気に入り',
}

function formatNumber(value: number) {
  return value.toLocaleString('ja-JP')
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function normalizePagePath(rawPath: string) {
  if (!rawPath || rawPath === '(not set)') return rawPath || '/'
  try {
    const url = rawPath.startsWith('http://') || rawPath.startsWith('https://')
      ? new URL(rawPath)
      : new URL(rawPath, 'https://www.duema-bbs.com')
    const pathname = url.pathname || '/'
    return pathname !== '/' ? pathname.replace(/\/$/, '') : '/'
  } catch {
    const pathOnly = rawPath.split('?')[0]?.split('#')[0] || '/'
    return pathOnly !== '/' ? pathOnly.replace(/\/$/, '') : '/'
  }
}

function getThreadIdFromPagePath(pagePath: string) {
  const match = normalizePagePath(pagePath).match(/^\/thread\/(\d+)(?:\/p\/\d+)?$/)
  return match ? Number(match[1]) : null
}

function buildDisplayGa4Rows(rows: Ga4PageRow[], threadTitles: Map<number, string>): DisplayGa4PageRow[] {
  return rows.map(row => {
    const path = normalizePagePath(row.path)
    const threadId = getThreadIdFromPagePath(path)
    return {
      ...row,
      title: threadId ? threadTitles.get(threadId) ?? `削除済みスレッド（/thread/${threadId}）` : PAGE_LABELS[path] ?? path,
      displayPath: path,
      href: path,
    }
  })
}

function RecentRankingCard({ rows }: { rows: RecentThreadActivity[] }) {
  return <section className="rounded border border-gray-200 bg-white"><div className="border-b border-gray-100 px-3 py-2"><h3 className="text-xs font-bold text-gray-700">最近コメントが増えたスレ</h3><p className="mt-0.5 text-[10px] text-gray-400">直近24時間のコメント増加</p></div><ol className="divide-y divide-gray-100">{rows.length === 0 ? <li className="px-3 py-4 text-xs text-gray-400">直近24時間のコメント増加はありません。</li> : rows.map((row, index) => <li key={row.id} className="flex items-start gap-2 px-3 py-2 text-xs"><span className="mt-0.5 w-5 shrink-0 text-right tabular-nums text-gray-400">{index + 1}</span><div className="min-w-0 flex-1"><Link prefetch={false} href={`/thread/${row.id}`} className="line-clamp-2 font-bold text-blue-700 hover:underline">{row.title}</Link><p className="mt-0.5 text-[10px] text-gray-400">最新 {formatDateTime(row.latestCommentAt)} / 累計コメント {formatNumber(row.postCount)}</p></div><div className="shrink-0 text-right"><p className="font-bold tabular-nums text-gray-800">{formatNumber(row.recentComments)}</p><p className="text-[10px] text-gray-400">直近コメント</p></div></li>)}</ol></section>
}

function Ga4PageRankingCard({ title, rows, note }: { title: string; rows: DisplayGa4PageRow[]; note: string }) {
  return <section className="rounded border border-gray-200 bg-white"><div className="border-b border-gray-100 px-3 py-2"><h3 className="text-xs font-bold text-gray-700">{title}</h3><p className="mt-0.5 text-[10px] text-gray-400">{note}</p></div><ol className="divide-y divide-gray-100">{rows.length === 0 ? <li className="px-3 py-4 text-xs text-gray-400">GA4上の対象ページはありません。</li> : rows.map((row, index) => <li key={row.path} className="flex items-start gap-2 px-3 py-2 text-xs"><span className="mt-0.5 w-5 shrink-0 text-right tabular-nums text-gray-400">{index + 1}</span><div className="min-w-0 flex-1"><Link prefetch={false} href={row.href} className="line-clamp-2 font-bold text-blue-700 hover:underline">{row.title}</Link><p className="mt-0.5 break-all text-[10px] text-gray-400">{row.displayPath}</p></div><div className="shrink-0 text-right"><p className="font-bold tabular-nums text-gray-800">{formatNumber(row.views)}</p><p className="text-[10px] text-gray-400">表示回数</p></div></li>)}</ol></section>
}

function Ga4UnavailableCard({ title, note, message }: { title: string; note: string; message: string }) {
  return <section className="rounded border border-gray-200 bg-white"><div className="border-b border-gray-100 px-3 py-2"><h3 className="text-xs font-bold text-gray-700">{title}</h3><p className="mt-0.5 text-[10px] text-gray-400">{note}</p></div><div className="px-3 py-4 text-xs text-red-700">GA4から取得できませんでした: {message}</div></section>
}

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; period?: string }> }) {
  const sp = await searchParams
  const active = sp.tab === 'makers' ? 'makers' : 'site'
  const updatedAt = new Date().toISOString()

  if (active === 'site') {
    const adminClient = createAdminClient()
    const [ga4, internal] = await Promise.all([getGa4DashboardData(28), getInternalDashboardData(adminClient)])
    const analyticsThreadIds = ga4.ok ? Array.from(new Set([...ga4.topPages, ...ga4.risingPages].map(row => getThreadIdFromPagePath(row.path)).filter((id): id is number => typeof id === 'number'))) : []
    const threadTitleMap = new Map<number, string>()
    if (analyticsThreadIds.length > 0) {
      const { data } = await adminClient.from('threads').select('id,title').in('id', analyticsThreadIds)
      for (const thread of data ?? []) if (thread.title) threadTitleMap.set(thread.id, thread.title)
    }
    const topPageRows = ga4.ok ? buildDisplayGa4Rows(ga4.topPages, threadTitleMap) : []
    const risingPageRows = ga4.ok ? buildDisplayGa4Rows(ga4.risingPages, threadTitleMap) : []
    return <><Tabs active="site"/><div className="mb-3"><AnalyticsRefresh updatedAt={updatedAt}/></div>{ga4.ok ? <><TotalPvChart points={ga4.dailyTrend}/><section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><Metric label="今日PV" value={ga4.summary.todayViews}/><Metric label="過去7日PV" value={ga4.summary.sevenDayViews}/><Metric label="過去28日PV" value={ga4.summary.twentyEightDayViews}/><Metric label="今日のユーザー数" value={ga4.summary.todayUsers}/><Metric label="過去7日のユーザー数" value={ga4.summary.sevenDayUsers}/><Metric label="1ユーザーあたりPV（28日）" value={ga4.trendSummary.viewsPerUser.toFixed(2)}/></section><p className="mt-2 text-[11px] text-gray-500">既存GA4 Data APIと同じ集計式・JST境界・5分キャッシュを使用しています。</p></> : <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">GA4の取得に失敗しました: {ga4.error}</div>}
      <section className="mt-5"><h2 className="mb-2 font-black">掲示板内部の累計指標</h2><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Metric label="スレ総閲覧数" value={internal.totals.totalViews}/><Metric label="スレ数" value={internal.totals.threadCount}/><Metric label="コメント数" value={internal.totals.commentCount}/><Metric label="平均閲覧数" value={internal.totals.avgViews}/></div></section>
      <section className="mt-5"><h2 className="mb-2 font-black">伸びているコンテンツ</h2><div className="grid min-w-0 gap-3 xl:grid-cols-3">{ga4.ok ? <Ga4PageRankingCard title="GA4 直近7日のページ" rows={topPageRows} note="サイト全体で今週よく見られているページ"/> : <Ga4UnavailableCard title="GA4 直近7日のページ" note="サイト全体で今週よく見られているページ" message={ga4.error}/>}<RecentRankingCard rows={internal.recentCommentThreads}/>{ga4.ok ? <Ga4PageRankingCard title="直近24時間で急に伸びたページ" rows={risingPageRows} note="前日〜今日の表示回数が多いページ"/> : <Ga4UnavailableCard title="直近24時間で急に伸びたページ" note="前日〜今日の表示回数が多いページ" message={ga4.error}/>}</div></section></>
  }

  const period = normalizePeriod(sp.period)
  let projects: ProjectSummary[] = []
  let error = ''
  try { projects = await fetchProjectSummaries(period) } catch (e) { error = e instanceof Error ? e.message : '企画一覧を取得できませんでした' }

  return <><Tabs active="makers"/><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><Periods period={period}/><AnalyticsRefresh updatedAt={updatedAt}/></div>{error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error} ページを再読み込みして再試行してください。</div> : projects.length === 0 ? <div className="rounded border bg-white p-6 text-center text-sm text-gray-500">表示できる企画は0件です。</div> : <>
    <div className="hidden overflow-x-auto rounded border bg-white md:block">
      <table className="w-full min-w-[1080px] text-xs">
        <thead className="sticky top-0 z-10 bg-gray-100 text-left text-[11px] text-gray-500">
          <tr>
            <th className="w-[21%] p-3 font-bold">企画</th>
            <th className="w-[12%] p-3 font-bold">状況</th>
            <th className="w-[10%] p-3 font-bold">公開</th>
            <th className="w-[16%] border-l border-gray-200 p-3 text-right font-bold">閲覧（PV・利用者）</th>
            <th className="w-[13%] border-l border-gray-200 p-3 text-right font-bold">参加（回答）</th>
            <th className="w-[13%] border-l border-gray-200 p-3 text-right font-bold">定着（開始→保存）</th>
            <th className="w-[13%] border-l border-gray-200 p-3 text-right font-bold">拡散（共有・集計閲覧）</th>
            <th className="w-[7%] border-l border-gray-200 p-3 text-right font-bold">登録</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {projects.map((p, i) => <tr key={p.id} className={`align-middle transition-colors hover:bg-blue-50/40 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
            <td className="p-3">
              <Link prefetch={false} href={`/admin/analytics/makers/${p.slug}?period=${period}`} className="font-bold text-blue-700 hover:underline">{p.title}</Link>
              <div className="mt-0.5 text-[10px] text-gray-400">{p.slug}</div>
            </td>
            <td className="p-3"><StatusChip project={p}/></td>
            <td className="p-3"><MakerPublishToggle slug={p.slug} title={p.title} status={p.status} isPublic={p.isPublic}/></td>
            <td className="border-l border-gray-100 bg-slate-50/30 p-3">
              <div className="flex items-baseline justify-end gap-1.5">
                {period !== 'today' && p.todayPv > 0 && <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-600">今日+{formatNumber(p.todayPv)}</span>}
                <StatCell value={p.pv} label="期間PV"/>
              </div>
              <div className="mt-1 text-right text-[11px] text-gray-400">利用者 <span className="font-bold tabular-nums text-gray-600">{formatNumber(p.uniqueActors)}</span></div>
            </td>
            <td className="border-l border-gray-100 p-3">
              <StatCell value={p.submissions} label="回答数"/>
              <div className="mt-1 text-right text-[11px] text-gray-400">回答者 <span className="font-bold tabular-nums text-gray-600">{formatNumber(p.registrants)}</span></div>
            </td>
            <td className="border-l border-gray-100 bg-slate-50/30 p-3">
              <StatCell value={p.events.image_saved} label="保存" accent={p.events.image_saved > 0}/>
              <div className="mt-1 text-right text-[11px] text-gray-400">開始 <span className="font-bold tabular-nums text-gray-600">{formatNumber(p.events.tier_created)}</span>{p.events.tier_created > 0 && <span className="ml-1 text-gray-300">({Math.round(p.events.image_saved / p.events.tier_created * 100)}%)</span>}</div>
            </td>
            <td className="border-l border-gray-100 p-3">
              <StatCell value={p.events.x_shared} label="X共有" accent={p.events.x_shared > 0}/>
              <div className="mt-1 text-right text-[11px] text-gray-400">集計閲覧 <span className="font-bold tabular-nums text-gray-600">{formatNumber(p.events.aggregate_viewed)}</span></div>
            </td>
            <td className="border-l border-gray-100 p-3 text-right text-base font-black tabular-nums text-gray-900">{formatNumber(p.events.signup_completed)}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <div className="space-y-2 md:hidden">{projects.map(p => <div key={p.id} className="rounded-lg border bg-white p-3"><div className="flex items-start justify-between gap-2"><Link prefetch={false} href={`/admin/analytics/makers/${p.slug}?period=${period}`} className="block min-w-0"><p className="font-bold text-blue-700">{p.title}</p><StatusChip project={p}/></Link><MakerPublishToggle slug={p.slug} title={p.title} status={p.status} isPublic={p.isPublic}/></div><Link prefetch={false} href={`/admin/analytics/makers/${p.slug}?period=${period}`} className="mt-2 grid grid-cols-3 gap-2 text-xs"><span>今日PV <b>{p.todayPv}</b></span><span>期間PV <b>{p.pv}</b></span><span>利用者 <b>{p.uniqueActors}</b></span><span>回答 <b>{p.submissions}</b></span><span>保存 <b>{p.events.image_saved}</b></span><span>X共有 <b>{p.events.x_shared}</b></span></Link></div>)}</div>
  </>}</>
}
