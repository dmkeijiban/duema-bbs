import { AdminHubPage } from '@/components/admin/AdminHubPage'

export default function Page() { return <AdminHubPage title="サイト管理" description="サイトの構成、案内、検索表示を管理します。" sections={[{ links: [
  { href: '/admin/categories', title: 'カテゴリ', description: '掲示板カテゴリを管理' },
  { href: '/admin/pages', title: '固定ページ', description: '固定ページの内容を管理' },
  { href: '/admin/notices', title: 'お知らせ', description: 'サイト内のお知らせを管理' },
  { href: '/admin/seo', title: 'SEO', description: '検索向けの設定を管理' },
  { href: '/admin/post-guidance', title: '投稿案内', description: '投稿時に表示する案内を設定' },
] }, { title: '補助確認', links: [
  { href: '/admin/ranking-preview', title: 'ランキングプレビュー', description: '公開前のランキング表示を確認' },
] }]} /> }
