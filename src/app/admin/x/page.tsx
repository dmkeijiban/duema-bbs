import { AdminHubPage } from '@/components/admin/AdminHubPage'

export default function Page() { return <AdminHubPage title="X運用" description="投稿、予約、話題URLをまとめて管理します。" sections={[{ links: [
  { href: '/admin/x-posts', title: '投稿管理', description: 'X投稿の下書き作成・編集・送信を管理' },
  { href: '/admin/x-schedule', title: 'スケジュール', description: '予約投稿と送信予定を確認' },
  { href: '/admin/x-buzz', title: '話題URLストック', description: '投稿候補に使う話題URLを保存・整理' },
] }]} /> }
