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
  },
  twitter: {
    card: 'summary' as const,
    title: '更新順一覧 | デュエマ掲示板',
    description: 'デュエマ（デュエルマスターズ）掲示板のスレッド更新順一覧。最近レスが付いたスレッドを新しい順に確認できます。',
  },
}

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function UpdatePage({ searchParams }: Props) {
  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1') || 1)
  return <ThreadSortPage sort="recent" title="更新順一覧" icon="↺" page={page} />
}
