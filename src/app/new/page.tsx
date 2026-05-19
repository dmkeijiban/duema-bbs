import { ThreadSortPage } from '@/components/ThreadSortPage'
import { SITE_URL } from '@/lib/site-config'

// 1分キャッシュ（createPublicClient に切り替えたため ISR が有効）
export const revalidate = 60

export const metadata = {
  title: '新着スレッド一覧 | デュエマ掲示板',
  description: 'デュエマ（デュエルマスターズ）掲示板の新着スレッド一覧。新しく立てられたスレッドをまとめて確認できます。',
  alternates: { canonical: `${SITE_URL}/new` },
  openGraph: {
    title: '新着スレッド一覧 | デュエマ掲示板',
    description: 'デュエマ（デュエルマスターズ）掲示板の新着スレッド一覧。新しく立てられたスレッドをまとめて確認できます。',
    url: `${SITE_URL}/new`,
    type: 'website' as const,
    images: [{ url: `${SITE_URL}/default-thumbnail.jpg`, width: 1200, height: 630, alt: '新着スレッド一覧 | デュエマ掲示板' }],
  },
  twitter: {
    card: 'summary_large_image' as const,
    title: '新着スレッド一覧 | デュエマ掲示板',
    description: 'デュエマ（デュエルマスターズ）掲示板の新着スレッド一覧。新しく立てられたスレッドをまとめて確認できます。',
    images: [`${SITE_URL}/default-thumbnail.jpg`],
  },
}

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function NewPage({ searchParams }: Props) {
  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1') || 1)
  return (
    <>
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
                { "@type": "ListItem", "position": 2, "name": "新着スレッド一覧", "item": `${SITE_URL}/new` },
              ],
            },
            {
              "@context": "https://schema.org",
              "@type": "WebPage",
              "@id": `${SITE_URL}/new#webpage`,
              "url": `${SITE_URL}/new`,
              "name": "新着スレッド一覧 | デュエマ掲示板",
              "isPartOf": { "@id": `${SITE_URL}/#website` },
              "publisher": { "@id": `${SITE_URL}/#organization` },
              "inLanguage": "ja",
            },
          ]),
        }}
      />
      <ThreadSortPage sort="new" title="新着スレッド一覧" icon="⏱" page={page} />
    </>
  )
}
