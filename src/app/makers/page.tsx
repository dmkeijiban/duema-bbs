import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'
import { isMakerProjectArchived, isMakerProjectVisible, MAKER_CATEGORIES, MAKER_CATEGORY_LABELS, parseMakerCatalogConfig, STATIC_MAKER_ENTRIES, type MakerCategory } from '@/lib/maker-catalog'
import { getAllSettings } from '@/lib/settings'
import { parseTopFeaturedCampaignSettings } from '@/lib/top-featured-campaign'
import { parsePlaygroundRecommendSettings, resolvePlaygroundRecommendedSlug } from '@/lib/playground-recommend'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'デュエマあそびば｜デュエマ掲示板',
  description: 'カードを選んだり、診断したり、投票したり、みんなで遊べるデュエマコンテンツ集。',
}

type MakerProject = {
  slug: string
  title: string
  type: string
  status: string
  is_public: boolean
  config: Record<string, unknown> | null
}
type CatalogEntry = { id: string; title: string; href: string; category: MakerCategory; sortOrder: number; description: string; featured?: boolean; isNew?: boolean; isLimited?: boolean; thumbnailUrl?: string }

const MAKER_DESCRIPTION_OVERRIDES: Record<string, string> = {
  'my-duema-9': '自分を象徴するカード9枚で、3×3画像を作れます。',
  'dm26-ex2-charisma-best-tier': '全カードをS〜Dで評価してTier表を作れます。',
  'hall-of-fame-release': '殿堂・プレミアム殿堂から、解除予想カードを選べます。',
}

const MAKER_DESCRIPTION_FALLBACKS: Record<string, string> = {
  'dm26-ex2-charisma-best-tier': '全カードをS〜Dで評価してTier表を作れます。',
  'hall-of-fame-release': '殿堂・プレミアム殿堂から、解除予想カードを選べます。',
}

export default async function MakersPage() {
  const [{ data }, settings] = await Promise.all([
    createAdminClient()
      .from('maker_projects')
      .select('slug,title,type,status,is_public,config')
      .order('created_at', { ascending: false }),
    getAllSettings(),
  ])

  const projects = (data ?? []) as MakerProject[]
  const entries: CatalogEntry[] = [
    ...(STATIC_MAKER_ENTRIES as readonly CatalogEntry[]),
    ...projects.filter(project => isMakerProjectVisible(project)).map((project): CatalogEntry => {
      const config = parseMakerCatalogConfig(project)
      const ended = isMakerProjectArchived(project)
      const category = project.slug === 'resume-maker' ? 'create' as const : config.category
      return { id: project.slug, title: project.title, href: `/makers/${project.slug}`, category: ended ? 'archive' as const : category, sortOrder: config.sortOrder, description: MAKER_DESCRIPTION_OVERRIDES[project.slug] || config.shortDescription || MAKER_DESCRIPTION_FALLBACKS[project.slug] || '', featured: config.featured, isNew: config.isNew, isLimited: config.isLimited, thumbnailUrl: config.thumbnailUrl }
    }),
  ].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'ja'))

  const topFeaturedProjectSlug = parseTopFeaturedCampaignSettings(settings.top_featured_campaign).projectSlug
  const playgroundRecommendedSlug = resolvePlaygroundRecommendedSlug(
    parsePlaygroundRecommendSettings(settings.playground_recommended_campaign),
    topFeaturedProjectSlug
  )
  const featuredEntries = entries.filter(entry =>
    entry.category !== 'archive' && (entry.featured || entry.id === playgroundRecommendedSlug)
  )

  const ProjectCard = ({ entry }: { entry: typeof entries[number] }) => (
    <Link href={entry.href} className="block overflow-hidden rounded-xl border bg-white transition hover:border-blue-400 hover:shadow-sm">
      {'thumbnailUrl' in entry && entry.thumbnailUrl && <img src={entry.thumbnailUrl} alt="" className="aspect-[16/7] w-full object-cover" />}
      <div className="p-4"><div className="flex flex-wrap gap-1">{'featured' in entry && entry.featured && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">おすすめ</span>}{'isNew' in entry && entry.isNew && <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">NEW</span>}{'isLimited' in entry && entry.isLimited && <span className="rounded bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-800">期間限定</span>}</div>
      <h3 className="mt-1 font-black text-blue-800">{entry.title}</h3>
      {entry.description && <p className="mt-1 text-sm leading-6 text-gray-600">{entry.description}</p>}</div>
    </Link>
  )

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-black sm:text-3xl">デュエマあそびば</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">カードを選んだり、診断したり、投票したり、<br className="sm:hidden" />みんなで遊べるデュエマコンテンツ集。</p>
        {featuredEntries.length > 0 && <section data-testid="featured-makers" className="mt-7 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 sm:p-4"><h2 className="text-lg font-black">おすすめ</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{featuredEntries.map(entry => <ProjectCard key={entry.id} entry={entry} />)}</div></section>}
        {MAKER_CATEGORIES.map(category => { const categoryEntries = entries.filter(entry => entry.category === category && !entry.featured); return categoryEntries.length > 0 && <section data-category={category} key={category} className="mt-7"><h2 className="text-lg font-black">{MAKER_CATEGORY_LABELS[category as MakerCategory]}</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{categoryEntries.map(entry => <ProjectCard key={entry.id} entry={entry} />)}</div></section> })}
      </div>
    </main>
  )
}
