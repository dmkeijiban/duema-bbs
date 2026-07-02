import { redirect } from 'next/navigation'

export const metadata = {
  title: '過去ログ一覧 | デュエマ掲示板',
  robots: { index: false, follow: false },
}

export default function ArchivedPage() {
  redirect('/kakolog')
}
