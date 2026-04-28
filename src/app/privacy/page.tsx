import Link from 'next/link'
import { getCachedFixedPage } from '@/lib/cached-queries'
import { renderBlock } from '@/components/FixedPageBlocks'
import { SnsCtaCard } from '@/components/SnsCtaCard'

export const metadata = {
  title: 'プライバシーポリシー | デュエマ掲示板',
}

const DEFAULT_PRIVACY = `1. 収集する情報
当サイトでは、以下の情報を収集することがあります。
・投稿内容（文章・画像・ハンドルネーム）
・アクセスログ（IPアドレス・ブラウザ情報・アクセス日時）
・Cookie（セッション管理・ユーザー設定の保持）
・Google Analytics・Microsoft Clarityによる利用状況データ

2. 情報の利用目的
・サービスの提供・運営・改善
・スパム・荒らし対策
・利用規約違反への対応
・アクセス解析によるサービス品質向上

3. 第三者への提供
当サイトは、法令に基づく場合を除き、収集した個人情報を第三者に提供しません。ただし、以下のサービスを利用しており、それぞれのプライバシーポリシーに従って情報が処理されます。
・Google Analytics（アクセス解析）
・Microsoft Clarity（ヒートマップ解析）
・Supabase（データベース・ストレージ）
・Vercel（ホスティング）

4. Cookieについて
当サイトはCookieを使用します。Cookieはお使いのブラウザ設定から無効にできますが、一部機能が正常に動作しなくなる場合があります。

5. アクセス解析ツールについて
Google Analytics・Microsoft Clarityを利用しており、トラフィックデータを収集しています。これらのデータは匿名で収集され、個人を特定するものではありません。

6. 投稿データについて
投稿した文章・画像・ハンドルネームは、当サイトのデータベースに保存されます。削除依頼はお問い合わせフォームよりご連絡ください。

7. ポリシーの変更
本ポリシーは必要に応じて変更される場合があります。変更後のポリシーは当ページに掲載した時点で効力を生じます。

8. お問い合わせ
プライバシーに関するお問い合わせはお問い合わせフォームよりご連絡ください。`

export default async function PrivacyPage() {
  const fixedPage = await getCachedFixedPage('privacy')

  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      <nav className="text-xs text-gray-500 mb-4 flex items-center gap-2">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <span className="inline-block px-2 py-0.5 rounded text-white text-[11px]" style={{ background: '#0d6efd' }}>プライバシーポリシー</span>
      </nav>
      <div className="bg-white border border-gray-300 p-5 leading-relaxed text-gray-800">
        <h1 className="text-base font-bold border-b border-gray-200 pb-2 mb-4">■ プライバシーポリシー（デュエマ掲示板）</h1>
        {fixedPage?.content.length ? (
          <div className="space-y-4">
            {fixedPage.content.map((block, i) => renderBlock(block, i))}
          </div>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap' }} className="text-sm text-gray-800">
            {DEFAULT_PRIVACY}
          </div>
        )}
      </div>
      <SnsCtaCard />
    </div>
  )
}
