import Link from 'next/link'

export const metadata = {
  title: 'プライバシーポリシー | デュエマ掲示板',
}

export default function PrivacyPage() {
  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      <nav className="text-xs text-gray-500 mb-4 flex items-center gap-2">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <span className="inline-block px-2 py-0.5 rounded text-white text-[11px]" style={{ background: '#0d6efd' }}>プライバシーポリシー</span>
      </nav>

      <div className="bg-white border border-gray-300 p-5 leading-relaxed text-gray-800">
        <h1 className="text-base font-bold border-b border-gray-200 pb-2 mb-4">■ プライバシーポリシー（デュエマ掲示板）</h1>
        <div className="text-sm text-gray-800 space-y-5">

          <section>
            <h2 className="font-bold mb-1">1. 収集する情報</h2>
            <p>当サイトでは、以下の情報を収集することがあります。</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-gray-700">
              <li>投稿内容（文章・画像・ハンドルネーム）</li>
              <li>アクセスログ（IPアドレス・ブラウザ情報・アクセス日時）</li>
              <li>Cookie（セッション管理・ユーザー設定の保持）</li>
              <li>Google Analytics・Microsoft Clarityによる利用状況データ</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold mb-1">2. 情報の利用目的</h2>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-gray-700">
              <li>サービスの提供・運営・改善</li>
              <li>スパム・荒らし対策</li>
              <li>利用規約違反への対応</li>
              <li>アクセス解析によるサービス品質向上</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold mb-1">3. 第三者への提供</h2>
            <p>当サイトは、法令に基づく場合を除き、収集した個人情報を第三者に提供しません。ただし、以下のサービスを利用しており、それぞれのプライバシーポリシーに従って情報が処理されます。</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-gray-700">
              <li>Google Analytics（アクセス解析）</li>
              <li>Microsoft Clarity（ヒートマップ解析）</li>
              <li>Supabase（データベース・ストレージ）</li>
              <li>Vercel（ホスティング）</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold mb-1">4. Cookieについて</h2>
            <p>当サイトはCookieを使用します。Cookieはお使いのブラウザ設定から無効にできますが、一部機能が正常に動作しなくなる場合があります。</p>
          </section>

          <section>
            <h2 className="font-bold mb-1">5. アクセス解析ツールについて</h2>
            <p>Google Analytics・Microsoft Clarityを利用しており、トラフィックデータを収集しています。これらのデータは匿名で収集され、個人を特定するものではありません。詳細は各サービスのプライバシーポリシーをご確認ください。</p>
          </section>

          <section>
            <h2 className="font-bold mb-1">6. 投稿データについて</h2>
            <p>投稿した文章・画像・ハンドルネームは、当サイトのデータベースに保存されます。削除依頼は<Link href="/contact" className="text-blue-600 hover:underline">お問い合わせフォーム</Link>よりご連絡ください。</p>
          </section>

          <section>
            <h2 className="font-bold mb-1">7. ポリシーの変更</h2>
            <p>本ポリシーは必要に応じて変更される場合があります。変更後のポリシーは当ページに掲載した時点で効力を生じます。</p>
          </section>

          <section>
            <h2 className="font-bold mb-1">8. お問い合わせ</h2>
            <p>プライバシーに関するお問い合わせは<Link href="/contact" className="text-blue-600 hover:underline">お問い合わせフォーム</Link>よりご連絡ください。</p>
          </section>

        </div>
      </div>
    </div>
  )
}
