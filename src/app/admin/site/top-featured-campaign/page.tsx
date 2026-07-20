import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { getAllSettings } from '@/lib/settings'
import { createAdminClient } from '@/lib/supabase-admin'
import { isMakerProjectVisible, parseMakerCatalogConfig } from '@/lib/maker-catalog'
import { parseTopFeaturedCampaignSettings } from '@/lib/top-featured-campaign'
import { parseTopGreenBannerButtons, TOP_GREEN_BANNER_SLOT_COUNT } from '@/lib/top-green-banner'
import { parsePlaygroundRecommendSettings } from '@/lib/playground-recommend'
import { TopFeaturedCampaignForm, type SelectableProject } from '@/components/admin/TopFeaturedCampaignForm'
import { updateTopGreenBannerButtonsAction, updatePlaygroundRecommendAction } from '../../actions'

type Project = {
  slug: string
  title: string
  type: string
  status: string
  is_public: boolean
  config: Record<string, unknown> | null
}

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) redirect('/admin')
  const sp = await searchParams

  const [settings, { data: projectRows }] = await Promise.all([
    getAllSettings(),
    createAdminClient().from('maker_projects').select('slug,title,type,status,is_public,config').order('created_at'),
  ])

  const projects = (projectRows ?? []) as Project[]
  const publicProjects: SelectableProject[] = projects
    .filter(project => isMakerProjectVisible(project))
    .map(project => {
      const catalog = parseMakerCatalogConfig(project)
      return {
        slug: project.slug,
        title: project.title,
        description: catalog.shortDescription,
        mainHref: `/makers/${project.slug}`,
        subHref: `/makers/${project.slug}/submissions`,
        publicVisible: true,
      }
    })

  const featuredCampaign = parseTopFeaturedCampaignSettings(settings.top_featured_campaign)
  const greenButtons = parseTopGreenBannerButtons(settings.top_green_banner_buttons)
  const playgroundRecommend = parsePlaygroundRecommendSettings(settings.playground_recommended_campaign)

  const errorMessage = sp.error === 'invalid_url'
    ? 'リンク・画像URLの形式が不正です（/から始まる内部リンク、またはhttp(s)のURLのみ使用できます）'
    : sp.error === 'save_failed'
      ? '保存に失敗しました'
      : null

  return (
    <main className="mx-auto max-w-4xl px-3 py-5">
      <Link href="/admin/site" className="text-xs text-blue-700 hover:underline">← サイト管理</Link>
      <h1 className="mt-2 text-2xl font-black">TOP注目企画</h1>
      <p className="mt-1 text-sm text-gray-600">
        TOPページ最上部のPOPと、その下の緑帯ボタンを設定します。
        表示モードを「TOP注目企画」にすると、ここで設定した内容がTOPに表示されます。
        表示モードの切り替えは<Link href="/admin/site/top-showcase" className="text-blue-700 underline">トップ表示設定</Link>から行えます。
      </p>
      {sp.saved && <p className="mt-3 text-xs font-bold text-green-700">保存しました</p>}
      {errorMessage && <p className="mt-3 text-xs font-bold text-red-700">{errorMessage}</p>}

      <section className="mt-5">
        <h2 className="font-black">注目企画POP</h2>
        <div className="mt-2">
          <TopFeaturedCampaignForm initial={featuredCampaign} projects={publicProjects} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-black">緑帯3ボタン</h2>
        <form action={updateTopGreenBannerButtonsAction} className="mt-2 space-y-3 rounded-lg border bg-white p-4">
          {Array.from({ length: TOP_GREEN_BANNER_SLOT_COUNT }, (_, i) => greenButtons[i]).map((button, i) => (
            <div key={i} className="grid gap-2 rounded border bg-gray-50 p-3 sm:grid-cols-6">
              <label className="text-sm sm:col-span-1"><input type="checkbox" name={`btn${i}_enabled`} defaultChecked={button.enabled} /> 表示ON</label>
              <label className="text-sm sm:col-span-2">ボタン名<input name={`btn${i}_label`} defaultValue={button.label} maxLength={20} className="mt-1 w-full rounded border p-1.5" /></label>
              <label className="text-sm sm:col-span-2">リンク先<input name={`btn${i}_href`} defaultValue={button.href} className="mt-1 w-full rounded border p-1.5" /></label>
              <label className="text-sm sm:col-span-1">アイコン<input name={`btn${i}_icon`} defaultValue={button.icon} maxLength={4} className="mt-1 w-full rounded border p-1.5" /></label>
              <label className="text-sm"><input type="checkbox" name={`btn${i}_openInNewTab`} defaultChecked={button.openInNewTab} /> 新しいタブ</label>
              <label className="text-sm"><input type="checkbox" name={`btn${i}_emphasis`} defaultChecked={button.emphasis} /> 強調表示</label>
            </div>
          ))}
          <button className="rounded bg-blue-800 px-4 py-2 text-xs font-bold text-white">保存</button>
        </form>
      </section>

      <section className="mt-6">
        <h2 className="font-black">あそびばおすすめ企画</h2>
        <form action={updatePlaygroundRecommendAction} className="mt-2 space-y-3 rounded-lg border bg-white p-4">
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" name="useTopFeatured" defaultChecked={playgroundRecommend.useTopFeatured} />
            TOP注目企画と同じ企画を使用
          </label>
          <label className="block text-sm">個別に指定する企画（上のチェックがOFFのときに使用）
            <select name="projectSlug" defaultValue={playgroundRecommend.projectSlug} className="mt-1 w-full rounded border p-2">
              <option value="">選択なし</option>
              {publicProjects.map(p => <option key={p.slug} value={p.slug}>{p.title}（{p.slug}）</option>)}
            </select>
          </label>
          <p className="text-xs text-gray-500">
            あそびば（/makers）の「おすすめ」枠は、企画ごとの「おすすめ」チェックに加えて、ここで指定した企画も表示されます。
          </p>
          <button className="rounded bg-blue-800 px-4 py-2 text-xs font-bold text-white">保存</button>
        </form>
      </section>
    </main>
  )
}
