import { ThreadSortPage } from '@/components/ThreadSortPage'
import { SITE_URL } from '@/lib/site-config'

// 1分キャッシュ（createPublicClient に切り替えたため ISR が有効）
export const revalidate = 60

export const metadata = {
  title: 'ランダム | デュエマ掲示板',
  description: 'デュエマ（デュエルマスターズ）掲示板のスレッドをランダムに表示します。思わぬ話題のスレッドに出会えるかも。',
  alternates: { canonical: `${SITE_URL}/random` },
  openGraph: {
    title: 'ランダム | デュエマ掲示板',
    description: 'デュエマ（デュエルマスターズ）掲示板のスレッドをランダムに表示します。思わぬ話題のスレッドに出会えるかも。',
    url: `${SITE_URL}/random`,
    type: 'website' as const,
    images: [{ url: `${SITE_URL}/default-thumbnail.jpg`, width: 1200, height: 630, alt: 'ランダム | デュエマ掲示板' }],
  },
  twitter: {
    card: 'summary_large_image' as const,
    title: 'ランダム | デュエマ掲示板',
    description: 'デュエマ（デュエルマスターズ）掲示板のスレッドをランダムに表示します。思わぬ話題のスレッドに出会えるかも。',
    images: [`${SITE_URL}/default-thumbnail.jpg`],
  },
}

export default function RandomPage() {
  return (
    <>
      {/* SEO: BreadcrumbList構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "TOP", "item": SITE_URL },
              { "@type": "ListItem", "position": 2, "name": "ランダム", "item": `${SITE_URL}/random` },
            ],
          }),
        }}
      />
      <ThreadSortPage sort="random" title="ランダム一覧" icon="🎲" />
    </>
  )
}
