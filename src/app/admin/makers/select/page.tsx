import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  MAKER_CATEGORIES,
  MAKER_CATEGORY_LABELS,
  MAKER_PUBLICATION_STATUSES,
  MAKER_PUBLICATION_STATUS_LABELS,
  makerPublicationStatus,
  parseMakerCatalogConfig,
} from '@/lib/maker-catalog'
import { saveMakerCatalogSettings, saveSelectProject } from './actions'

export const dynamic = 'force-dynamic'

type Project = {
  slug: string
  title: string
  type: string
  status: string
  is_public: boolean
  config: Record<string, unknown> | null
}

export default async function MakersAdminPage({ searchParams }: {
  searchParams: Promise<{ q?: string; category?: string; status?: string }>
}) {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) notFound()
  const sp = await searchParams
  const { data } = await createAdminClient().from('maker_projects').select('slug,title,type,status,is_public,config').order('created_at')
  const projects = ((data ?? []) as Project[]).filter(project => {
    const matchesQuery = !sp.q || `${project.title} ${project.slug}`.toLowerCase().includes(sp.q.toLowerCase())
    const matchesCategory = !sp.category || parseMakerCatalogConfig(project).category === sp.category
    const matchesStatus = !sp.status || makerPublicationStatus(project) === sp.status
    return matchesQuery && matchesCategory && matchesStatus
  })

  return <main className="min-h-screen bg-slate-50 px-3 py-6"><div className="mx-auto max-w-7xl">
    <Link href="/admin" className="text-sm font-bold text-blue-700">← 管理画面</Link>
    <h1 className="mt-3 text-2xl font-black">デュエマあそびば企画管理</h1>
    <p className="mt-1 text-sm text-gray-600">公開状態、一覧掲載、カテゴリ、並び順、期間、バッジを共通設定します。</p>

    <form className="mt-4 flex flex-wrap gap-2 rounded-xl border bg-white p-3">
      <input name="q" defaultValue={sp.q} placeholder="企画名・slugで検索" className="min-w-52 flex-1 rounded border p-2 text-sm" />
      <select name="category" defaultValue={sp.category} className="rounded border p-2 text-sm"><option value="">全カテゴリ</option>{MAKER_CATEGORIES.map(category => <option key={category} value={category}>{MAKER_CATEGORY_LABELS[category]}</option>)}</select>
      <select name="status" defaultValue={sp.status} className="rounded border p-2 text-sm"><option value="">全公開状態</option>{MAKER_PUBLICATION_STATUSES.map(status => <option key={status} value={status}>{MAKER_PUBLICATION_STATUS_LABELS[status]}</option>)}</select>
      <button className="rounded bg-slate-800 px-4 py-2 text-sm font-bold text-white">絞り込む</button>
    </form>

    <div className="mt-5 overflow-x-auto rounded-xl border bg-white" data-testid="maker-admin-summary">
      <table className="min-w-[1050px] w-full text-left text-xs">
        <thead className="bg-slate-100 text-slate-600"><tr>{['企画名', 'カテゴリ', '公開状態', '一覧表示', 'おすすめ', '表示順', '開始日時', '終了日時', 'NEW', '期間限定'].map(label => <th key={label} className="whitespace-nowrap px-3 py-2">{label}</th>)}</tr></thead>
        <tbody>{projects.map(project => { const catalog = parseMakerCatalogConfig(project); return <tr key={project.slug} className="border-t"><td className="px-3 py-2 font-bold">{project.title}<span className="block font-normal text-gray-400">{project.slug}</span></td><td className="px-3 py-2">{MAKER_CATEGORY_LABELS[catalog.category]}</td><td className="px-3 py-2">{MAKER_PUBLICATION_STATUS_LABELS[makerPublicationStatus(project)]}</td><td className="px-3 py-2">{catalog.showInCatalog ? 'ON' : 'OFF'}</td><td className="px-3 py-2">{catalog.featured ? 'ON' : 'OFF'}</td><td className="px-3 py-2">{catalog.sortOrder}</td><td className="whitespace-nowrap px-3 py-2">{catalog.startsAt ? new Date(catalog.startsAt).toLocaleString('ja-JP') : '－'}</td><td className="whitespace-nowrap px-3 py-2">{catalog.endsAt ? new Date(catalog.endsAt).toLocaleString('ja-JP') : '－'}</td><td className="px-3 py-2">{catalog.isNew ? 'ON' : 'OFF'}</td><td className="px-3 py-2">{catalog.isLimited ? 'ON' : 'OFF'}</td></tr> })}</tbody>
      </table>
    </div>

    <div className="mt-5 space-y-4">{projects.map(project => {
      const catalog = parseMakerCatalogConfig(project)
      return <form action={saveMakerCatalogSettings} key={project.slug} className="rounded-xl border bg-white p-4">
        <input type="hidden" name="slug" value={project.slug} />
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-black">{project.title}</h2><p className="text-xs text-gray-500">{project.slug} ・ {project.type}</p></div><button className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white">設定を保存</button></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm">公開状態<select name="publicationStatus" defaultValue={makerPublicationStatus(project)} className="mt-1 w-full rounded border p-2">{MAKER_PUBLICATION_STATUSES.map(status => <option key={status} value={status}>{MAKER_PUBLICATION_STATUS_LABELS[status]}</option>)}</select></label>
          <label className="text-sm">カテゴリ<select name="category" defaultValue={catalog.category} className="mt-1 w-full rounded border p-2">{MAKER_CATEGORIES.map(category => <option key={category} value={category}>{MAKER_CATEGORY_LABELS[category]}</option>)}</select></label>
          <label className="text-sm">表示順<input name="sortOrder" type="number" defaultValue={catalog.sortOrder} className="mt-1 w-full rounded border p-2" /></label>
          <label className="text-sm">開始日時<input name="startsAt" type="datetime-local" defaultValue={catalog.startsAt.slice(0, 16)} className="mt-1 w-full rounded border p-2" /></label>
          <label className="text-sm">終了日時<input name="endsAt" type="datetime-local" defaultValue={catalog.endsAt.slice(0, 16)} className="mt-1 w-full rounded border p-2" /></label>
          <label className="text-sm lg:col-span-3">短い説明<input name="shortDescription" maxLength={160} defaultValue={catalog.shortDescription} className="mt-1 w-full rounded border p-2" /></label>
          <label className="text-sm lg:col-span-2">サムネイルURL / パス<input name="thumbnailUrl" defaultValue={catalog.thumbnailUrl} className="mt-1 w-full rounded border p-2" /></label>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">{([
          ['showInCatalog', '一覧表示', catalog.showInCatalog],
          ['featured', 'おすすめ', catalog.featured],
          ['isNew', 'NEW表示', catalog.isNew],
          ['isLimited', '期間限定表示', catalog.isLimited],
          ['showInArchive', '終了後アーカイブ', catalog.showInArchive],
        ] as const).map(([name, label, checked]) => <label key={name}><input type="checkbox" name={name} defaultChecked={checked} /> {label}</label>)}</div>
      </form>
    })}</div>

    <details className="mt-6 rounded-xl border bg-white p-4"><summary className="cursor-pointer font-black">カード選択企画を新規作成</summary><form action={saveSelectProject} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">slug<input name="slug" required className="mt-1 w-full rounded border p-2" /></label><label className="text-sm">企画タイトル<input name="title" required className="mt-1 w-full rounded border p-2" /></label><label className="text-sm sm:col-span-2">説明<textarea name="description" className="mt-1 w-full rounded border p-2" /></label><label className="text-sm">最小枚数<input name="minChoices" type="number" min="1" max="12" defaultValue="1" className="mt-1 w-full rounded border p-2" /></label><label className="text-sm">最大枚数<input name="maxChoices" type="number" min="1" max="12" defaultValue="1" className="mt-1 w-full rounded border p-2" /></label><input type="hidden" name="duplicateRule" value="card_name" /><input type="hidden" name="cardPool" value="all" /><div className="sm:col-span-2"><label><input type="checkbox" name="published" /> 公開</label><button className="ml-4 rounded bg-blue-700 px-4 py-2 font-bold text-white">作成</button></div></form></details>
  </div></main>
}
