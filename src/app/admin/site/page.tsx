import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AdminHubPage } from '@/components/admin/AdminHubPage'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { getAllSettings } from '@/lib/settings'
import { readGoodlifeAdSettings } from '@/lib/ads'
import { normalizeTopShowcaseMode, TOP_SHOWCASE_MODE_OPTIONS } from '@/lib/top-showcase'

export default async function Page() {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) redirect('/admin')
  const [settings, noticeResult] = await Promise.all([
    getAllSettings(),
    createAdminClient().from('notices').select('*', { count: 'exact', head: true }).eq('is_active', true),
  ])
  const ads = readGoodlifeAdSettings(settings)
  const showcase = normalizeTopShowcaseMode(settings.top_showcase_mode)
  const showcaseLabel = TOP_SHOWCASE_MODE_OPTIONS.find(option => option.value === showcase)?.label ?? 'みんなのプロフィール'

  return <AdminHubPage title="サイト管理" description="サイトの構成、表示、告知、収益化を管理します。" sections={[
    { title: '基本設定', links: [
      { href: '/admin/categories', title: 'カテゴリ', description: '掲示板カテゴリを管理' },
      { href: '/admin/pages', title: '固定ページ', description: '固定ページの内容を管理' },
      { href: '/admin/site/text', title: 'サイトテキスト', description: 'ルール、バナー、SNSリンクの文言を編集' },
      { href: '/admin/post-guidance', title: '投稿案内', description: '投稿フォーム内の案内表示を切り替え' },
      { href: '/admin/seo', title: 'SEO', description: '検索向けの設定を管理' },
    ] },
    { title: '表示・告知', links: [
      { href: '/admin/notices', title: 'お知らせ', description: `表示中：${noticeResult.count ?? 0}件` },
      { href: '/admin/site/top-showcase', title: 'トップ表示設定', description: `現在：${showcaseLabel}` },
    ] },
    { title: '収益化', links: [
      { href: '/admin/site/ads', title: '広告設定', description: `Goodlifeインライン広告：${ads.enabled ? '有効' : '無効'}` },
    ] },
    { title: '補助機能', links: [
      { href: '/admin/ranking-preview', title: 'ランキングプレビュー', description: '公開前のランキング表示を確認' },
    ] },
  ]} />
}
