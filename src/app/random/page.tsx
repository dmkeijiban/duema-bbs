import { ThreadSortPage } from '@/components/ThreadSortPage'

export const metadata = { title: 'ランダム | デュエマ掲示板' }

export default function RandomPage() {
  return <ThreadSortPage sort="random" title="ランダム一覧" icon="🎲" />
}
