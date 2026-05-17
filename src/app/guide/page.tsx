import Link from 'next/link'
import { getCachedFixedPage } from '@/lib/cached-queries'
import { renderBlock } from '@/components/FixedPageBlocks'
import { SnsCtaCard } from '@/components/SnsCtaCard'
import { SITE_URL } from '@/lib/site-config'

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
    question: 'スレッドはどうやって立てますか？',
    answer: 'トップページ右上または一覧上部の「スレッドを立てる」ボタンをクリックし、タイトル（2〜100文字）・本文（5〜5000文字）を入力して投稿します。',
  },
  {
    question: 'ハンドルネームや名前は必要ですか？',
    answer: 'ハンドルネームは任意です。入力しなくても投稿できます。',
  },
  {
    question: '画像や動画を投稿できますか？',
    answer: '画像ファイル（JPEG/PNG/GIF/WebP、最大10MB）を直接添付できます。YouTubeやX（Twitter）のURLを単独行に貼ると自動埋め込みされます。',
  },
  {
    question: '自分の投稿を削除できますか？',
    answer: '自分が投稿したレスは「削除」ボタンで削除できます。同じブラウザ・セッション内のみ有効です。ブラウザのCookieを削除すると削除権限が失われます。',
  },
  {
    question: 'お気に入り機能はありますか？',
    answer: 'スレッドタイトル横の☆ボタンでお気に入り登録できます。登録したスレッドは「個人設定」から一覧確認できます。',
  },
  {
    question: '削除依頼やバグ報告はどこにすればいいですか？',
    answer: 'ページ下部のお問い合わせフォームからご連絡ください。削除依頼の場合はURLを必ず明記してください。',
  },
]

const DEFAULT_GUIDE = `🧵 スレッドを立てる
1. トップページ右上または一覧上部の「スレッドを立てる」ボタンをクリック
2. タイトル・本文・ハンドルネーム（任意）・カテゴリ（任意）・画像（任意）を入力
3. 「スレッドを立てる」ボタンで投稿完了
※ タイトルは2〜100文字、本文は5〜5000文字。スパム対策のため日本語を含めてください。

💬 レスを付ける
1. スレッドを開いて、下部の返信フォームに入力
2. 本文・ハンドルネーム（任意）・画像（任意）を入力して送信

🔗 アンカー（引用）
・レス番号（▶1, ▶2 ...）をクリックすると、返信フォームに >>N が自動挿入されます
・本文中の >>N をクリックすると、そのレスにジャンプできます
・>>N にマウスを乗せると、レスのプレビューが表示されます

🖼 画像・動画の貼り方
・画像ファイル（JPEG/PNG/GIF/WebP、最大10MB）を直接添付できます
・YouTubeのURLを単独行に貼ると動画が自動埋め込みされます
・X（Twitter）のポストURLを単独行に貼るとツイートが自動埋め込みされます
※ URL埋め込みは行の中にURLだけが書かれている場合のみ動作します。

⭐ お気に入り
・スレッドタイトル横の☆ボタンでお気に入り登録できます
・登録したスレッドは「個人設定」から一覧確認できます

🗑 投稿の削除
・自分が投稿したレスは「削除」ボタンで削除できます（同じブラウザ・セッション内のみ）
・スレ主はスレッド内のすべてのレスを削除できます
・ブラウザのCookieを削除すると削除権限が失われます

📋 ルール
詳細は利用規約をご確認ください。荒らし・誹謗中傷・スパム投稿は禁止です。`

export default async function GuidePage() {
  const fixedPage = await getCachedFixedPage('guide')

  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "TOP", "item": SITE_URL },
              { "@type": "ListItem", "position": 2, "name": "使い方", "item": `${SITE_URL}/guide` },
            ],
          }),
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
      <nav className="text-xs text-gray-500 mb-4 flex items-center gap-2">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <span className="inline-block px-2 py-0.5 rounded text-white text-[11px]" style={{ background: '#0d6efd' }}>使い方</span>
      </nav>
      <div className="bg-white border border-gray-300 p-5 leading-relaxed text-gray-800">
        <h1 className="text-base font-bold border-b border-gray-200 pb-2 mb-4">■ 使い方ガイド（デュエマ掲示板）</h1>
        {fixedPage?.content.length ? (
          <div className="space-y-4">
            {fixedPage.content.map((block, i) => renderBlock(block, i))}
          </div>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap' }} className="text-sm text-gray-800">
            {DEFAULT_GUIDE}
          </div>
        )}
      </div>
      <SnsCtaCard />
    </div>
  )
}
