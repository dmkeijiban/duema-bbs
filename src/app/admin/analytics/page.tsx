import Link from 'next/link'
import { AnalyticsRefresh } from '@/components/admin/AnalyticsRefresh'
import {
  getGa4DashboardData,
  getInternalDashboardData,
  type Ga4PageRow,
  type RecentThreadActivity,
} from '@/lib/admin-dashboard'
import { createAdminClient } from '@/lib/supabase-admin'
import { fetchProjectSummaries, normalizePeriod, type ProjectSummary } from '@/lib/admin-maker-analytics'

function Tabs({ active }: { active: 'site' | 'makers' }) { return <nav className="mb-4 flex gap-1 overflow-x-auto border-b"><Link prefetch={false} className={`shrink-0 px-3 py-2 text-sm font-bold ${active==='site'?'border-b-2 border-blue-600 text-blue-700':'text-gray-500'}`} href="/admin/analytics?tab=site">サイト全体</Link><Link prefetch={false} className={`shrink-0 px-3 py-2 text-sm font-bold ${active==='makers'?'border-b-2 border-blue-600 text-blue-700':'text-gray-500'}`} href="/admin/analytics?tab=makers">メーカー企画</Link><Link className="shrink-0 px-3 py-2 text-sm font-bold text-gray-500 hover:text-blue-700" href="/admin/campaign-ranking">キャンペーン</Link><Link className="shrink-0 px-3 py-2 text-sm font-bold text-gray-500 hover:text-blue-700" href="/admin/duema-stats">ユーザー・プロフィール</Link><Link className="shrink-0 px-3 py-2 text-sm font-bold text-gray-500 hover:text-blue-700" href="/admin/ranking-preview">ランキング確認</Link></nav> }
function Metric({ label, value, note }: { label:string; value:number|string; note?:string }) { return <div className="rounded-lg border bg-white p-3"><p className="text-xs font-bold text-gray-500">{label}</p><p className="mt-1 text-2xl font-black tabular-nums">{typeof value==='number'?value.toLocaleString('ja-JP'):value}</p>{note&&<p className="mt-1 text-[10px] text-gray-400">{note}</p>}</div> }
function TotalPvChart({ points }: { points: Array<{ date: string; views: number }> }) {
  const width = 1000
  const height = 240
  const padding = { top: 24, right: 24, bottom: 42, left: 58 }
  const maxViews = Math.max(...points.map(point => point.views), 1)
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const coordinates = points.map((point, index) => ({
    ...point,
    x: padding.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth),
    y: padding.top + plotHeight - (point.views / maxViews) * plotHeight,
  }))
  const line = coordinates.map(point => `${point.x},${point.y}`).join(' ')
  const area = coordinates.length > 0
    ? `${padding.left},${padding.top + plotHeight} ${line} ${padding.left + plotWidth},${padding.top + plotHeight}`
    : ''
  const dateLabels = coordinates.filter((_, index) => index === 0 || index === coordinates.length - 1 || index % 7 === 0)
  const total = points.reduce((sum, point) => sum + point.views, 0)

  return <section className="mb-3 rounded-lg border bg-white p-3">
    <div className="mb-2 flex flex-wrap items-end justify-between gap-1">
      <div>
        <h2 className="text-xs font-bold text-gray-700">過去28日のPV推移</h2>
        <p className="text-[10px] text-gray-400">サイト全体の日別PV合計</p>
      </div>
      <p className="text-sm font-black tabular-nums text-gray-800">合計 {formatNumber(total)} PV</p>
    </div>
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="過去28日の日別PV推移" className="h-auto w-full">
        {[0, 0.5, 1].map(rate => {
          const y = padding.top + plotHeight * rate
          const value = Math.round(maxViews * (1 - rate))
          return <g key={rate}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e5e7eb" strokeWidth="1" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#9ca3af">{formatNumber(value)}</text>
          </g>
        })}
        {area && <polygon points={area} fill="#dbeafe" opacity="0.7" />}
        {line && <polyline points={line} fill="none" stroke="#0284c7" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
        {dateLabels.map(point => <text key={point.date} x={point.x} y={height - 12} textAnchor="middle" fontSize="11" fill="#6b7280">{point.date.slice(5).replace('-', '/')}</text>)}
      </svg>
    </div>
  </section>
}

function Periods({ period }: { period: string }) { return <div className="flex flex-wrap gap-1">{[['today','今日'],['7d','過去7日'],['30d','過去30日'],['all','全期間']].map(([key,label])=><Link prefetch={false} key={key} href={`/admin/analytics?tab=makers&period=${key}`} className={`rounded border px-3 py-1.5 text-xs font-bold ${period===key?'border-blue-500 bg-blue-50 text-blue-700':'bg-white text-gray-600'}`}>{label}</Link>)}</div> }

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
  return <section className="rounded border border-gray-200 bg-white"><div className="border-b border-gray-100 px-3 py-2"><h3 className="text-xs font-bold text-gray-700">最近コメントが増えたスレ</h3><p className="mt-0.5 text-[10px] text-gray-400">直近24時間のコメント増加</p></div><ol className="divide-y divide-gray-100">{rows.length===0?<li className="px-3 py-4 text-xs text-gray-400">直近24時間のコメント増加はありません。</li>:rows.map((row,index)=><li key={row.id} className="flex items-start gap-2 px-3 py-2 text-xs"><span className="mt-0.5 w-5 shrink-0 text-right tabular-nums text-gray-400">{index+1}</span><div className="min-w-0 flex-1"><Link prefetch={false} href={`/thread/${row.id}`} className="line-clamp-2 font-bold text-blue-700 hover:underline">{row.title}</Link><p className="mt-0.5 text-[10px] text-gray-400">最新 {formatDateTime(row.latestCommentAt)} / 累計コメント {formatNumber(row.postCount)}</p></div><div className="shrink-0 text-right"><p className="font-bold tabular-nums text-gray-800">{formatNumber(row.recentComments)}</p><p className="text-[10px] text-gray-400">直近コメント</p></div></li>)}</ol></section>
}

function Ga4PageRankingCard({ title, rows, note }: { title: string; rows: DisplayGa4PageRow[]; note: string }) {
  return <section className="rounded border border-gray-200 bg-white"><div className="border-b border-gray-100 px-3 py-2"><h3 className="text-xs font-bold text-gray-700">{title}</h3><p className="mt-0.5 text-[10px] text-gray-400">{note}</p></div><ol className="divide-y divide-gray-100">{rows.length===0?<li className="px-3 py-4 text-xs text-gray-400">GA4上の対象ページはありません。</li>:rows.map((row,index)=><li key={row.path} className="flex items-start gap-2 px-3 py-2 text-xs"><span className="mt-0.5 w-5 shrink-0 text-right tabular-nums text-gray-400">{index+1}</span><div className="min-w-0 flex-1"><Link prefetch={false} href={row.href} className="line-clamp-2 font-bold text-blue-700 hover:underline">{row.title}</Link><p className="mt-0.5 break-all text-[10px] text-gray-400">{row.displayPath}</p></div><div className="shrink-0 text-right"><p className="font-bold tabular-nums text-gray-800">{formatNumber(row.views)}</p><p className="text-[10px] text-gray-400">表示回数</p></div></li>)}</ol></section>
}

function Ga4UnavailableCard({ title, note, message }: { title: string; note: string; message: string }) {
  return <section className="rounded border border-gray-200 bg-white"><div className="border-b border-gray-100 px-3 py-2"><h3 className="text-xs font-bold text-gray-700">{title}</h3><p className="mt-0.5 text-[10px] text-gray-400">{note}</p></div><div className="px-3 py-4 text-xs text-red-700">GA4から取得できませんでした: {message}</div></section>
}

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; period?: string }> }) {
  const sp=await searchParams; const active=sp.tab==='makers'?'makers':'site'; const updatedAt=new Date().toISOString()
  if(active==='site') {
    const adminClient=createAdminClient()
    const [ga4,internal]=await Promise.all([getGa4DashboardData(28),getInternalDashboardData(adminClient)])
    const analyticsThreadIds=ga4.ok?Array.from(new Set([...ga4.topPages,...ga4.risingPages].map(row=>getThreadIdFromPagePath(row.path)).filter((id): id is number=>typeof id==='number'))):[]
    const threadTitleMap=new Map<number,string>()
    if(analyticsThreadIds.length>0){const {data}=await adminClient.from('threads').select('id,title').in('id',analyticsThreadIds); for(const thread of data??[]){if(thread.title)threadTitleMap.set(thread.id,thread.title)}}
    const topPageRows=ga4.ok?buildDisplayGa4Rows(ga4.topPages,threadTitleMap):[]
    const risingPageRows=ga4.ok?buildDisplayGa4Rows(ga4.risingPages,threadTitleMap):[]
    return <><Tabs active="site"/><div className="mb-3"><AnalyticsRefresh updatedAt={updatedAt}/></div>{ga4.ok?<><TotalPvChart points={ga4.dailyTrend}/><section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><Metric label="今日PV" value={ga4.summary.todayViews}/><Metric label="過去7日PV" value={ga4.summary.sevenDayViews}/><Metric label="過去28日PV" value={ga4.summary.twentyEightDayViews}/><Metric label="今日のユーザー数" value={ga4.summary.todayUsers}/><Metric label="過去7日のユーザー数" value={ga4.summary.sevenDayUsers}/><Metric label="1ユーザーあたりPV（28日）" value={ga4.trendSummary.viewsPerUser.toFixed(2)}/></section><p className="mt-2 text-[11px] text-gray-500">既存GA4 Data APIと同じ集計式・JST境界・5分キャッシュを使用しています。</p></>:<div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">GA4の取得に失敗しました: {ga4.error}</div>}
      <section className="mt-5"><h2 className="mb-2 font-black">掲示板内部の累計指標</h2><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Metric label="スレ総閲覧数" value={internal.totals.totalViews}/><Metric label="スレ数" value={internal.totals.threadCount}/><Metric label="コメント数" value={internal.totals.commentCount}/><Metric label="平均閲覧数" value={internal.totals.avgViews}/></div></section>
      <section className="mt-5"><h2 className="mb-2 font-black">伸びているコンテンツ</h2><div className="grid min-w-0 gap-3 xl:grid-cols-3">{ga4.ok?<Ga4PageRankingCard title="GA4 直近7日のページ" rows={topPageRows} note="サイト全体で今週よく見られているページ"/>:<Ga4UnavailableCard title="GA4 直近7日のページ" note="サイト全体で今週よく見られているページ" message={ga4.error}/>}<RecentRankingCard rows={internal.recentCommentThreads}/>{ga4.ok?<Ga4PageRankingCard title="直近24時間で急に伸びたページ" rows={risingPageRows} note="前日〜今日の表示回数が多いページ"/>:<Ga4UnavailableCard title="直近24時間で急に伸びたページ" note="前日〜今日の表示回数が多いページ" message={ga4.error}/>}</div></section></>
  }
  const period=normalizePeriod(sp.period); let projects: ProjectSummary[] = []; let error=''; try { projects=await fetchProjectSummaries(period) } catch(e){ error=e instanceof Error?e.message:'企画一覧を取得できませんでした' }
  return <><Tabs active="makers"/><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><Periods period={period}/><AnalyticsRefresh updatedAt={updatedAt}/></div>{error?<div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error} ページを再読み込みして再試行してください。</div>:projects.length===0?<div className="rounded border bg-white p-6 text-center text-sm text-gray-500">表示できる企画は0件です。</div>:<><div className="hidden overflow-hidden rounded border bg-white md:block"><table className="w-full text-xs"><thead className="bg-gray-100 text-left"><tr>{['企画','公開','PV / 利用者','回答','操作','共有・閲覧','登録'].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{projects.map(p=><tr key={p.id} className="border-t align-top"><td className="p-3"><Link prefetch={false} href={`/admin/analytics/makers/${p.slug}?period=${period}`} className="font-bold text-blue-700 hover:underline">{p.title}</Link><div className="text-[10px] text-gray-400">{p.slug}</div></td><td className="p-3">{p.isPublic&&p.status==='published'?'公開':'非公開'}</td><td className="p-3">今日 {p.todayPv} PV<br/>期間 {p.pv} PV<br/>{p.uniqueActors} 利用者</td><td className="p-3">{p.registrants} 人<br/>{p.submissions} 件</td><td className="p-3">開始 {p.events.tier_created}<br/>保存 {p.events.image_saved}</td><td className="p-3">X {p.events.x_shared}<br/>集計 {p.events.aggregate_viewed}</td><td className="p-3">{p.events.signup_completed}</td></tr>)}</tbody></table></div><div className="space-y-2 md:hidden">{projects.map(p=><Link prefetch={false} key={p.id} href={`/admin/analytics/makers/${p.slug}?period=${period}`} className="block rounded-lg border bg-white p-3"><div className="flex justify-between gap-2"><p className="font-bold text-blue-700">{p.title}</p><span className="text-xs">{p.isPublic?'公開':'非公開'}</span></div><div className="mt-2 grid grid-cols-3 gap-2 text-xs"><span>今日PV <b>{p.todayPv}</b></span><span>期間PV <b>{p.pv}</b></span><span>利用者 <b>{p.uniqueActors}</b></span><span>回答 <b>{p.submissions}</b></span><span>保存 <b>{p.events.image_saved}</b></span><span>X共有 <b>{p.events.x_shared}</b></span></div></Link>)}</div></>}</>
}
