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
  return <ThreadSortPage sort="random" title="ランダム一覧" icon="🎲" />
}
