import { ThreadSortPage } from '@/components/ThreadSortPage'

export const metadata = {
  title: '過去ログ一覧 | デュエマ掲示板',
  robots: { index: false, follow: false },
}

export default function ArchivedPage() {
  return <ThreadSortPage sort="archived" title="過去ログ一覧" icon="📂" />
}
