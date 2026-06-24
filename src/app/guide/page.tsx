import Link from 'next/link'
import { SnsCtaCard } from '@/components/SnsCtaCard'
import { SITE_URL } from '@/lib/site-config'
import { HONOR_TITLE_ENABLED } from '@/lib/honor-title'

// 固定ページはほぼ変わらないため1時間キャッシュ
export const revalidate = 3600

export const metadata = {
  title: '使い方 | デュエマ掲示板',
  description: 'デュエマ掲示板の使い方ガイド。スレッドの立て方・レスの付け方・画像投稿・お気に入り登録など基本操作を解説します。',
  alternates: { canonical: `${SITE_URL}/guide` },
  openGraph: {
    title: '使い方 | デュエマ掲示板',
    description: 'デュエマ掲示板の使い方ガイド。スレッドの立て方・レスの付け方・画像投稿・お気に入り登録など基本操作を解説します。',
    url: `${SITE_URL}/guide`,
    type: 'website' as const,
    images: [{ url: `${SITE_URL}/default-thumbnail.jpg`, width: 1200, height: 630, alt: 'デュエマ掲示板 使い方' }],
  },
  twitter: {
    card: 'summary_large_image' as const,
    title: '使い方 | デュエマ掲示板',
    description: 'デュエマ掲示板の使い方ガイド。スレッドの立て方・レスの付け方・画像投稿・お気に入り登録など基本操作を解説します。',
    images: [`${SITE_URL}/default-thumbnail.jpg`],
  },
}

const FAQ_ITEMS = [
  {
    question: 'ログインしないと投稿できませんか？',
    answer: 'ログインは不要です。ハンドルネームも任意なので、何も入力せずにすぐ投稿できます。',
  },
  {
    question: '投稿を削除できません',
    answer: '同じブラウザ・セッションからのみ削除できます。ブラウザのCookieを削除すると削除権限が失われます。',
  },
  {
    question: 'Cookieを削除したらどうなりますか？',
    answer: 'お気に入りや削除権限などの情報が失われます。ログインユーザーのお気に入りはサーバーに保存されているため影響を受けません。',
  },
  {
    question: 'ランキングに載りたくありません',
    answer: 'マイページの設定からランキング辞退が可能です。辞退するとランキングページに表示されなくなります。',
  },
  {
    question: 'プロフィールを非公開にできますか？',
    answer: 'はい。マイページの設定から非公開にできます。非公開にすると投稿者名などの情報が一般ページで表示されなくなります。',
  },
  {
    question: '退会すると投稿も消えますか？',
    answer: '退会後も投稿・レビューなどのデータは残りますが、投稿者情報は匿名化されます。',
  },
]

export default async function GuidePage() {
  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "TOP", "item": SITE_URL },
                { "@type": "ListItem", "position": 2, "name": "使い方", "item": `${SITE_URL}/guide` },
              ],
            },
            {
              "@context": "https://schema.org",
              "@type": "WebPage",
              "@id": `${SITE_URL}/guide#webpage`,
              "url": `${SITE_URL}/guide`,
              "name": "使い方 | デュエマ掲示板",
              "isPartOf": { "@id": `${SITE_URL}/#website` },
              "publisher": { "@id": `${SITE_URL}/#organization` },
              "inLanguage": "ja",
            },
          ]),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ_ITEMS.map(item => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: { '@type': 'Answer', text: item.answer },
            })),
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: 'デュエマ掲示板の使い方',
            description: 'デュエマ掲示板でスレッドを立てる・レスを付ける・お気に入り登録する手順を解説します。',
            url: `${SITE_URL}/guide`,
            step: [
              {
                '@type': 'HowToStep',
                name: 'スレッドを立てる',
                text: 'トップページ右上または一覧上部の「スレッドを立てる」ボタンをクリックし、タイトル（2〜100文字）・本文（5〜5000文字）・カテゴリ（任意）・画像（任意）を入力して投稿します。',
                url: `${SITE_URL}/guide#create-thread`,
              },
              {
                '@type': 'HowToStep',
                name: 'レスを付ける',
                text: 'スレッドを開いて、下部の返信フォームに本文・ハンドルネーム（任意）・画像（任意）を入力して送信します。',
                url: `${SITE_URL}/guide#reply`,
              },
              {
                '@type': 'HowToStep',
                name: 'アンカー（引用）を使う',
                text: 'レス番号（▶1, ▶2 ...）をクリックすると返信フォームに >>N が自動挿入されます。本文中の >>N をクリックするとそのレスにジャンプできます。',
                url: `${SITE_URL}/guide#anchor`,
              },
              {
                '@type': 'HowToStep',
                name: '画像・動画を貼る',
                text: '画像ファイル（JPEG/PNG/GIF/WebP、最大10MB）を直接添付できます。YouTubeやX（Twitter）のURLを単独行に貼ると自動埋め込みされます。',
                url: `${SITE_URL}/guide#media`,
              },
              {
                '@type': 'HowToStep',
                name: 'お気に入り登録する',
                text: 'スレッドタイトル横の☆ボタンでお気に入り登録できます。登録したスレッドは「個人設定」から一覧確認できます。',
                url: `${SITE_URL}/guide#favorite`,
              },
            ],
          }),
        }}
      />
      <nav className="text-xs text-gray-500 mb-4 flex items-center gap-2">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <span className="inline-block px-2 py-0.5 rounded text-white text-[11px]" style={{ background: '#0d6efd' }}>使い方</span>
      </nav>

      <div className="bg-white border border-gray-300 p-5 leading-relaxed text-gray-800">
        <h1 className="text-base font-bold border-b border-gray-200 pb-2 mb-4">デュエマ掲示板の使い方</h1>
        <p className="mb-6 text-sm text-gray-700">
          ログインなしでもすぐ利用できます。投稿者登録（無料）をするとお気に入り保存・ランキング参加・プロフィール公開などの追加機能が使えます。
        </p>

        {/* Section 1 */}
        <section id="intro" className="mb-6">
          <h2 className="text-sm font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-3">1. 初めての方へ</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            <li>会員登録なし・ログインなしで投稿できます。</li>
            <li>ハンドルネームは任意です。入力しなくても投稿できます。</li>
            <li>投稿者登録（Google または メール/パスワード）をするとお気に入り永続保存・ランキング参加・マイページ・プロフィール公開などの機能が追加されます。</li>
            <li>登録後もログインせずに投稿することは引き続き可能です。</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section id="create-thread" className="mb-6">
          <h2 className="text-sm font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-3">2. スレッドの作成</h2>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700">
            <li>トップページ右上または一覧上部の「スレッドを立てる」ボタンをクリック</li>
            <li>タイトル（2〜100文字）・本文（5〜5000文字）・ハンドルネーム（任意）・カテゴリ（任意）・画像（任意）を入力</li>
            <li>「スレッドを立てる」ボタンで投稿完了</li>
          </ol>
          <p className="mt-2 text-xs text-gray-500">※ スパム対策のため日本語を含めてください。</p>
        </section>

        {/* Section 3 */}
        <section id="reply" className="mb-6">
          <h2 className="text-sm font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-3">3. レスの投稿</h2>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700">
            <li>スレッドを開いて、下部の返信フォームに移動</li>
            <li>本文・ハンドルネーム（任意）・画像（任意）を入力して送信</li>
          </ol>
        </section>

        {/* Section 4 */}
        <section id="anchor" className="mb-6">
          <h2 className="text-sm font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-3">4. アンカー機能</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            <li>レス番号（▶1, ▶2 ...）をクリックすると、返信フォームに <code className="text-xs bg-gray-100 px-1 rounded">{'>>'}{'>'}N</code> が自動挿入されます</li>
            <li>本文中の <code className="text-xs bg-gray-100 px-1 rounded">{'>>'}{'>'}N</code> をクリックすると、そのレスにジャンプできます</li>
            <li><code className="text-xs bg-gray-100 px-1 rounded">{'>>'}{'>'}N</code> にマウスを乗せると、レスのプレビューが表示されます</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section id="media" className="mb-6">
          <h2 className="text-sm font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-3">5. 画像・動画・X投稿</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            <li>画像ファイル（JPEG/PNG/GIF/WebP、最大10MB）を直接添付できます</li>
            <li>YouTubeのURLを単独行に貼ると動画が自動埋め込みされます</li>
            <li>X（Twitter）の投稿URLを単独行に貼るとポストが自動埋め込みされます</li>
          </ul>
          <p className="mt-2 text-xs text-gray-500">※ URL埋め込みは行の中にURLだけが書かれている場合のみ動作します。</p>
        </section>

        {/* Section 6 */}
        <section id="login" className="mb-6">
          <h2 className="text-sm font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-3">6. ログイン・新規登録</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            <li>Google アカウントまたはメール/パスワードで登録・ログインできます</li>
            <li>パスワードを忘れた場合はログイン画面の「パスワードを忘れた方」からリセットできます</li>
            <li>登録後もログインせずに匿名投稿することは引き続き可能です</li>
          </ul>
        </section>

        {/* Section 7 */}
        <section id="mypage" className="mb-6">
          <h2 className="text-sm font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-3">7. マイページ・投稿者ページ</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            <li>マイページでは自分のスレッド・レス一覧を確認できます</li>
            <li>プロフィールページ（/u/ユーザー名）を公開でき、アイコン・表示名・自己紹介・X/YouTubeリンクを設定できます</li>
            <li>SNSリンクを設定すると投稿者ページからあなたのSNSへ誘導できます</li>
          </ul>
        </section>

        {/* Section 8 */}
        <section id="ranking" className="mb-6">
          <h2 className="text-sm font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-3">8. 投稿者ランキング</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            <li>スレッド投稿・レス・図鑑レビューなどの活動によってポイントが貯まります</li>
            <li>月間ランキングと通算ランキングがあります</li>
            <li>プロフィール非公開のユーザーはランキングに表示されません</li>
            <li>マイページの設定からランキング辞退も可能です</li>
            <li>ランキングは活動量の参考であり、デュエマのスキルランキングではありません</li>
          </ul>
          <p className="mt-2">
            <Link href="/ranking" className="text-xs text-blue-600 hover:underline">ランキングページへ →</Link>
          </p>
        </section>

        {/* Section 9 */}
        <section id="zukan" className="mb-6">
          <h2 className="text-sm font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-3">9. 思い出図鑑</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            <li>DM-01の全120枚のカードを収録しています（今後のパックも順次追加予定）</li>
            <li>各カードに「思い出評価」（5段階×5項目）と「思い出レビュー」を投稿できます</li>
            <li>パック一覧・カード個別ページから閲覧・投稿が可能です</li>
            <li>ログインユーザーとして投稿することも、匿名で投稿することもできます</li>
          </ul>
          <p className="mt-2">
            <Link href="/zukan" className="text-xs text-blue-600 hover:underline">思い出図鑑へ →</Link>
          </p>
        </section>

        {/* Section 10 */}
        <section id="favorite" className="mb-6">
          <h2 className="text-sm font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-3">10. お気に入り・個人設定</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            <li>スレッドタイトル横の☆ボタンでお気に入り登録できます</li>
            <li>登録したスレッドは「個人設定」から一覧確認できます</li>
            <li>ログインしていない場合はブラウザのCookieに保存されます（同じブラウザ内のみ有効）</li>
            <li>Cookieを削除するとお気に入り情報が失われます（ログインユーザーはサーバー保存のため影響なし）</li>
          </ul>
        </section>

        {/* Section 11 */}
        <section id="delete" className="mb-6">
          <h2 className="text-sm font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-3">11. 投稿の削除</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            <li>自分が投稿したレスは「削除」ボタンで削除できます</li>
            <li>匿名投稿の場合は同じブラウザ・セッション内のみ削除可能です</li>
            <li>ブラウザのCookieを削除すると削除権限が失われます</li>
            <li>スレ主はスレッド内のすべてのレスを削除できます</li>
            <li>削除した投稿は表示上消えますが、システム上は記録が残ります（物理削除は行いません）</li>
          </ul>
        </section>

        {/* Section 12 */}
        <section id="private" className="mb-6">
          <h2 className="text-sm font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-3">12. プロフィール非公開・ランキング辞退</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            <li>マイページの設定からプロフィールを非公開にできます</li>
            <li>非公開にすると、投稿者ページやランキングなどの一般ページで投稿者情報が表示されなくなります</li>
            <li>ランキング辞退の設定をするとランキングページに表示されなくなります</li>
          </ul>
        </section>

        {/* Section 13 */}
        <section id="withdraw" className="mb-6">
          <h2 className="text-sm font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-3">13. 退会</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            <li>退会するとアカウントが利用できなくなります</li>
            <li>退会後も過去のスレッド・レス・図鑑レビューのデータは削除されません</li>
            <li>退会後は投稿者情報が匿名化されます</li>
          </ul>
        </section>

        {/* Section 14 */}
        <section id="faq" className="mb-6">
          <h2 className="text-sm font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-3">14. よくある質問</h2>
          <dl className="space-y-4">
            {FAQ_ITEMS.map(item => (
              <div key={item.question} className="border border-gray-200 rounded p-3">
                <dt className="font-bold text-sm text-gray-800 mb-1">Q. {item.question}</dt>
                <dd className="text-sm text-gray-700">A. {item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Section 15: 称号について (HONOR_TITLE_ENABLED=true で表示) */}
        {HONOR_TITLE_ENABLED && (
          <section id="honor-title" className="mb-6">
            <h2 className="text-sm font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-3">15. 称号について</h2>
            <p className="mb-3 text-sm text-gray-700">
              登録ユーザーには、累計ポイントに応じて称号が自動で付与されます。称号は毎日1回、ランキング更新時に自動更新されます。
            </p>
            <div className="border border-gray-200 rounded divide-y divide-gray-100 text-sm">
              <div className="grid grid-cols-[6rem_1fr] items-center px-3 py-2">
                <span className="font-bold text-gray-600">10pt〜</span>
                <span className="text-gray-700">🟤 ブロンズ</span>
              </div>
              <div className="grid grid-cols-[6rem_1fr] items-center px-3 py-2">
                <span className="font-bold text-gray-600">50pt〜</span>
                <span className="text-gray-700">⚪ シルバー</span>
              </div>
              <div className="grid grid-cols-[6rem_1fr] items-center px-3 py-2">
                <span className="font-bold text-gray-600">150pt〜</span>
                <span className="text-gray-700">🟡 ゴールド</span>
              </div>
              <div className="grid grid-cols-[6rem_1fr] items-center px-3 py-2">
                <span className="font-bold text-gray-600">400pt〜</span>
                <span className="text-gray-700">💎 プラチナ</span>
              </div>
              <div className="grid grid-cols-[6rem_1fr] items-center px-3 py-2">
                <span className="font-bold text-gray-600">800pt〜</span>
                <span className="text-gray-700">🔷 ダイヤモンド</span>
              </div>
              <div className="grid grid-cols-[6rem_1fr] items-center px-3 py-2">
                <span className="font-bold text-gray-600">1500pt〜</span>
                <span className="text-gray-700">👑 レジェンド</span>
              </div>
              <div className="grid grid-cols-[6rem_1fr] items-center px-3 py-2">
                <span className="font-bold text-gray-600">3000pt〜</span>
                <span className="text-gray-700">🌟 殿堂入り</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              称号はプロフィールページ（/u/ユーザー名）と投稿者ランキングの通算タブに表示されます。
            </p>
          </section>
        )}

        {/* Section 16 */}
        <section id="contact" className="mb-2">
          <h2 className="text-sm font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-3">16. 注意事項・お問い合わせ</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 mb-3">
            <li>荒らし・スパム・不適切な投稿は禁止です。違反投稿は削除する場合があります。</li>
            <li>詳細は<Link href="/terms" className="text-blue-600 hover:underline">利用規約</Link>・<Link href="/privacy" className="text-blue-600 hover:underline">プライバシーポリシー</Link>をご確認ください。</li>
            <li>削除依頼・バグ報告は<Link href="/contact" className="text-blue-600 hover:underline">お問い合わせ</Link>フォームからご連絡ください（URLを必ず明記してください）。</li>
          </ul>
        </section>
      </div>

      <SnsCtaCard />
    </div>
  )
}
