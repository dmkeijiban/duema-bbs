import { ThreadSortPage } from '@/components/ThreadSortPage'

export const metadata = { title: '更新順一覧 | デュエマ掲示板' }

export default function UpdatePage() {
  return <ThreadSortPage sort="recent" title="更新順一覧" icon="↺" />
}
