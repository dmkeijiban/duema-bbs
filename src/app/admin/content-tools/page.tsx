import { AdminHubPage } from '@/components/admin/AdminHubPage'

export default function Page() { return <AdminHubPage title="コンテンツ作成・取り込み" description="スレやまとめの作成、外部原稿・コメントの取り込みを行います。" sections={[
  { title: '作成', links: [
    { href: '/admin/thread-bulk-create', title: 'スレ・コメント一括作成', description: 'スレと初期コメントをまとめて作成' },
    { href: '/admin/summary', title: 'まとめ生成', description: '既存スレからまとめコンテンツを生成' },
  ] },
  { title: '取り込み', links: [
    { href: '/admin/comment-import', title: 'コメント一括取り込み', description: 'コメントデータをまとめて取り込み' },
    { href: '/admin/article-drafts', title: '記事下書き取り込み', description: '記事下書きを管理画面へ取り込み' },
  ] },
  { title: 'カードデータ準備', links: [
    { href: '/admin/cards', title: '共通カード管理', description: '未完成カードを自動抽出し、後から情報を補完' },
    { href: '/admin/cards/import', title: '共通カード取り込み', description: '企画用の最低限カード情報をJSONから検証' },
  ] },
]} /> }
