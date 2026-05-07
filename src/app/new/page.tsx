import { ThreadSortPage } from '@/components/ThreadSortPage'
import { SITE_URL } from '@/lib/site-config'

export const metadata = {
  title: '新着スレッド一覧 | デュエマ掲示板',
  description: 'デュエマ（デュエルマスターズ）掲示板の新着スレッド一覧。新しく立てられたスレッドをまとめて確認できます。',
  alternates: { canonical: `${SITE_URL}/new` },
  openGraph: {
    title: '新着スレッド一覧 | デュエマ掲示板',
    description: 'デュエマ（デュエルマスターズ）掲示板の新着スレッド一覧。新しく立てられたスレッドをまとめて確認できます。',
    url: `${SITE_URL}/new`,
    type: 'website' as const,
  },
  twitter: {
    card: 'summary' as const,
    title: '新着スレッド一覧 | デュエマ掲示板',
    description: 'デュエマ（デュエルマスターズ）掲示板の新着スレッド一覧。新しく立てられたスレッドをまとめて確認できます。',
  },
}

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function NewPage({ searchParams }: Props) {
  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1') || 1)
  return <ThreadSortPage sort="new" title="新着スレッド一覧" icon="⏱" page={page} />
}
