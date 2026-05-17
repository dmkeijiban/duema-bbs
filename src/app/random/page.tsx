import { ThreadSortPage } from '@/components/ThreadSortPage'
import { SITE_URL } from '@/lib/site-config'

export const metadata = {
  title: 'ランダム | デュエマ掲示板',
  description: 'デュエマ（デュエルマスターズ）掲示板のスレッドをランダムに表示します。思わぬ話題のスレッドに出会えるかも。',
  alternates: { canonical: `${SITE_URL}/random` },
  openGraph: {
    title: 'ランダム | デュエマ掲示板',
    description: 'デュエマ（デュエルマスターズ）掲示板のスレッドをランダムに表示します。思わぬ話題のスレッドに出会えるかも。',
    url: `${SITE_URL}/random`,
    type: 'website' as const,
  },
  twitter: {
    card: 'summary' as const,
    title: 'ランダム | デュエマ掲示板',
    description: 'デュエマ（デュエルマスターズ）掲示板のスレッドをランダムに表示します。思わぬ話題のスレッドに出会えるかも。',
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
