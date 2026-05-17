import { ThreadSortPage } from '@/components/ThreadSortPage'
import { SITE_URL } from '@/lib/site-config'

export const metadata = {
  title: '更新順一覧 | デュエマ掲示板',
  description: 'デュエマ（デュエルマスターズ）掲示板のスレッド更新順一覧。最近レスが付いたスレッドを新しい順に確認できます。',
  alternates: { canonical: `${SITE_URL}/update` },
  openGraph: {
    title: '更新順一覧 | デュエマ掲示板',
    description: 'デュエマ（デュエルマスターズ）掲示板のスレッド更新順一覧。最近レスが付いたスレッドを新しい順に確認できます。',
    url: `${SITE_URL}/update`,
    type: 'website' as const,
    images: [{ url: `${SITE_URL}/default-thumbnail.jpg`, width: 1200, height: 630, alt: '更新順一覧 | デュエマ掲示板' }],
  },
  twitter: {
    card: 'summary_large_image' as const,
    title: '更新順一覧 | デュエマ掲示板',
    description: 'デュエマ（デュエルマスターズ）掲示板のスレッド更新順一覧。最近レスが付いたスレッドを新しい順に確認できます。',
    images: [`${SITE_URL}/default-thumbnail.jpg`],
  },
}

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function UpdatePage({ searchParams }: Props) {
  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1') || 1)
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
              { "@type": "ListItem", "position": 2, "name": "更新順一覧", "item": `${SITE_URL}/update` },
            ],
          }),
        }}
      />
      <ThreadSortPage sort="recent" title="更新順一覧" icon="↺" page={page} />
    </>
  )
}
