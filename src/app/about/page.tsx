import Link from 'next/link'
import { SnsCtaCard } from '@/components/SnsCtaCard'
import { SITE_URL } from '@/lib/site-config'

export const revalidate = 3600

export const metadata = {
  title: '運営者情報 | デュエマ掲示板',
  description: 'デュエマ掲示板の運営者情報。サイト概要・運営方針・お問い合わせ先などをご確認いただけます。',
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: '運営者情報 | デュエマ掲示板',
    description: 'デュエマ掲示板の運営者情報。サイト概要・運営方針・お問い合わせ先などをご確認いただけます。',
    url: `${SITE_URL}/about`,
    type: 'website' as const,
    images: [{ url: `${SITE_URL}/default-thumbnail.jpg`, width: 1200, height: 630, alt: '運営者情報 | デュエマ掲示板' }],
  },
  twitter: {
    card: 'summary_large_image' as const,
    title: '運営者情報 | デュエマ掲示板',
    description: 'デュエマ掲示板の運営者情報。サイト概要・運営方針・お問い合わせ先などをご確認いただけます。',
    images: [`${SITE_URL}/default-thumbnail.jpg`],
  },
}

export default function AboutPage() {
  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      {/* SEO: BreadcrumbList + AboutPage 構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "TOP", "item": SITE_URL },
                { "@type": "ListItem", "position": 2, "name": "運営者情報", "item": `${SITE_URL}/about` },
              ],
            },
            {
              "@context": "https://schema.org",
              "@type": "AboutPage",
              "@id": `${SITE_URL}/about#webpage`,
              "url": `${SITE_URL}/about`,
              "name": "運営者情報 | デュエマ掲示板",
              "isPartOf": { "@id": `${SITE_URL}/#website` },
              "publisher": { "@id": `${SITE_URL}/#organization` },
              "about": { "@id": `${SITE_URL}/#organization` },
              "inLanguage": "ja",
            },
          ]),
        }}
      />
      <nav className="text-xs text-gray-500 mb-4 flex items-center gap-2">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <span className="inline-block px-2 py-0.5 rounded text-white text-[11px]" style={{ background: '#0d6efd' }}>運営者情報</span>
      </nav>
      <div className="bg-white border border-gray-300 p-5 leading-relaxed text-gray-800">
        <h1 className="text-base font-bold border-b border-gray-200 pb-2 mb-4">■ 運営者情報（デュエマ掲示板）</h1>

        <div className="space-y-5 text-sm text-gray-800">

          <section>
            <h2 className="font-semibold mb-1">サイト名</h2>
            <p>デュエマ掲示板（duema-bbs.com）</p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">サービス概要</h2>
            <p>
              デュエルマスターズ（デュエマ）をテーマにした専門掲示板です。デッキ相談・カード評価・大会情報・環境考察など、デュエマに関するあらゆる話題を自由に投稿・議論できます。
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">運営者</h2>
            <p>個人（日本国内在住）</p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">運営方針</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>デュエルマスターズを楽しむユーザーが安心して使えるコミュニティを目指します</li>
              <li>スパム・荒らし・誹謗中傷などの不適切な投稿は削除・制限の対象とします</li>
              <li>ユーザーの報告を参考にしながら、適切なコンテンツ管理を行います</li>
              <li>サービス品質の向上を目的として、Google Analytics・Microsoft Clarity等のアクセス解析ツールを利用しています</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold mb-1">広告について</h2>
            <p>
              当サイトでは、第三者配信の広告サービス（Google AdSense等）を利用する場合があります。
              広告配信事業者は、ユーザーの興味に応じた広告を表示するために Cookie を使用することがあります。
              Cookie を無効にする方法や Google による広告 Cookie の使用方法については、
              <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">Google の広告ポリシー</a>
              をご覧ください。
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">免責事項</h2>
            <p>
              当サイトは、ユーザーが投稿した内容の正確性・完全性・有用性について保証しません。
              掲載情報の利用によって生じたいかなる損害についても、運営者は責任を負いかねます。
              また、当サイトのリンク先の外部サービスに関するトラブルについても、同様に責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">著作権</h2>
            <p>
              「デュエル・マスターズ」は宝島社・小学館・タカラトミーの登録商標です。
              当サイトは非公式のファンサイトであり、各権利者とは一切関係ありません。
              ユーザーが投稿したコンテンツの著作権は投稿者に帰属します。
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">お問い合わせ</h2>
            <p>
              ご意見・削除依頼・不具合報告などは、
              <Link href="/contact" className="text-blue-600 hover:underline mx-1">お問い合わせフォーム</Link>
              よりご連絡ください。
            </p>
          </section>

        </div>
      </div>
      <SnsCtaCard />
    </div>
  )
}
