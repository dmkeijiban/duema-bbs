import { ThreadSortPage } from '@/components/ThreadSortPage'

export const metadata = { title: '新着スレッド一覧 | デュエマ掲示板' }

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function NewPage({ searchParams }: Props) {
  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1') || 1)
  return <ThreadSortPage sort="new" title="新着スレッド一覧" icon="⏱" page={page} />
}
