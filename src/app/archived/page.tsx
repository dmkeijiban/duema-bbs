import { ThreadSortPage } from '@/components/ThreadSortPage'

export const metadata = { title: '過去ログ一覧 | デュエマ掲示板' }

export default function ArchivedPage() {
  return <ThreadSortPage sort="archived" title="過去ログ一覧" icon="📂" />
}
