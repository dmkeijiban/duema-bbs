import { ThreadSortPage } from '@/components/ThreadSortPage'

export const metadata = { title: '新着スレッド一覧 | デュエマ掲示板' }

export default function NewPage() {
  return <ThreadSortPage sort="new" title="新着スレッド一覧" icon="⏱" />
}
