import { ThreadSortPage } from '@/components/ThreadSortPage'

export const metadata = { title: '更新順一覧 | デュエマ掲示板' }

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function UpdatePage({ searchParams }: Props) {
  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1') || 1)
  return <ThreadSortPage sort="recent" title="更新順一覧" icon="↺" page={page} />
}
