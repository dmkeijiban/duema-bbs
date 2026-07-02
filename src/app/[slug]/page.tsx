import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCachedFixedPage } from '@/lib/cached-queries'
import { renderBlock } from '@/components/FixedPageBlocks'
import { SnsCtaCard } from '@/components/SnsCtaCard'
import { SITE_URL } from '@/lib/site-config'
import { createPublicClient } from '@/lib/supabase-public'
import { ADSENSE_REVIEW_MODE } from '@/lib/adsense-review-mode'

const HIDDEN_IN_REVIEW_MODE = ['dmsaishin']

// 固定ページはほぼ変わらないため1時間キャッシュ（guide/privacy/terms と統一）
export const revalidate = 3600

interface Props {
  params: Promise<{ slug: string }>
}

function hasPublicSupabaseEnv(): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return Boolean(supabaseUrl?.startsWith('http') && supabaseKey)
}

export async function generateStaticParams() {
  if (!hasPublicSupabaseEnv()) {
    console.warn('[fixed-page] skip generateStaticParams: missing public Supabase env')
    return []
  }

  const supabase = createPublicClient()
  const { data } = await supabase
    .from('fixed_pages')
    .select('slug')
    .eq('is_published', true)
  return (data ?? [])
    .filter(p => !(ADSENSE_REVIEW_MODE && HIDDEN_IN_REVIEW_MODE.includes(p.slug)))
    .map(p => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  if (ADSENSE_REVIEW_MODE && HIDDEN_IN_REVIEW_MODE.includes(slug)) return {}
  const page = await getCachedFixedPage(slug)
  if (!page) return {}

  const firstText = page.content.find(b => b.type === 'text')
  const rawDesc = firstText && 'content' in firstText
    ? firstText.content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120)
    : ''
  const description = rawDesc || `${page.title} - デュエマ（デュエルマスターズ）掲示板`
  const url = `${SITE_URL}/${slug}`

  return {
    title: `${page.title} | デュエマ掲示板`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${page.title} | デュエマ掲示板`,
      description,
      url,
      type: 'website' as const,
      images: [{ url: `${SITE_URL}/default-thumbnail.jpg`, width: 1200, height: 630, alt: `${page.title} | デュエマ掲示板` }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: `${page.title} | デュエマ掲示板`,
      description,
      images: [`${SITE_URL}/default-thumbnail.jpg`],
    },
  }
}

export default async function FixedPageRoute({ params }: Props) {
  const { slug } = await params
  if (ADSENSE_REVIEW_MODE && HIDDEN_IN_REVIEW_MODE.includes(slug)) redirect('/')
  const page = await getCachedFixedPage(slug)
  if (!page) notFound()

  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      {/* SEO: BreadcrumbList + WebPage 構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "TOP", "item": SITE_URL },
                { "@type": "ListItem", "position": 2, "name": page.title, "item": `${SITE_URL}/${slug}` },
              ],
            },
            {
              "@context": "https://schema.org",
              "@type": "WebPage",
              "@id": `${SITE_URL}/${slug}#webpage`,
              "url": `${SITE_URL}/${slug}`,
              "name": `${page.title} | デュエマ掲示板`,
              "isPartOf": { "@id": `${SITE_URL}/#website` },
              "publisher": { "@id": `${SITE_URL}/#organization` },
              "inLanguage": "ja",
            },
          ]),
        }}
      />
      <nav className="text-xs text-gray-500 mb-4 flex items-center gap-2">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <span className="inline-block px-2 py-0.5 text-white text-[11px]" style={{ background: '#0d6efd' }}>
          {page.title}
        </span>
      </nav>
      <div className="bg-white border border-gray-300 p-5">
        <h1 className="text-base font-bold border-b border-gray-200 pb-2 mb-4">■ {page.title}</h1>
        <div className="space-y-4">
          {page.content.length === 0 ? (
            <p className="text-xs text-gray-400">コンテンツがありません</p>
          ) : (
            page.content.map((block, i) => renderBlock(block, i))
          )}
        </div>
      </div>
      <SnsCtaCard />
    </div>
  )
}
