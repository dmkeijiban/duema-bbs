import Link from 'next/link'

export const metadata = {
  title: '使い方 | デュエマ掲示板',
}

export default function GuidePage() {
  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      <nav className="text-xs text-gray-500 mb-4 flex items-center gap-2">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <span className="inline-block px-2 py-0.5 rounded text-white text-[11px]" style={{ background: '#0d6efd' }}>使い方</span>
      </nav>

      <div className="bg-white border border-gray-300 p-5 leading-relaxed text-gray-800">
        <h1 className="text-base font-bold border-b border-gray-200 pb-2 mb-4">■ 使い方ガイド（デュエマ掲示板）</h1>
        <div className="text-sm text-gray-800 space-y-6">

          <section>
            <h2 className="font-bold text-blue-700 mb-2">🧵 スレッドを立てる</h2>
            <ol className="list-decimal list-inside space-y-1 text-gray-700">
              <li>トップページ右上または一覧上部の「スレッドを立てる」ボタンをクリック</li>
              <li>タイトル・本文・ハンドルネーム（任意）・カテゴリ（任意）・画像（任意）を入力</li>
              <li>「スレッドを立てる」ボタンで投稿完了</li>
            </ol>
            <p className="mt-1 text-gray-500 text-xs">※ タイトルは2〜100文字、本文は5〜5000文字。スパム対策のため日本語を含めてください。</p>
          </section>

          <section>
            <h2 className="font-bold text-blue-700 mb-2">💬 レスを付ける</h2>
            <ol className="list-decimal list-inside space-y-1 text-gray-700">
              <li>スレッドを開いて、下部の返信フォームに入力</li>
              <li>本文・ハンドルネーム（任意）・画像（任意）を入力して送信</li>
            </ol>
          </section>

          <section>
            <h2 className="font-bold text-blue-700 mb-2">🔗 アンカー（引用）</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>レス番号（▶1, ▶2 ...）をクリックすると、返信フォームに {'>>N'} が自動挿入されます</li>
              <li>本文中の {'>>N'} をクリックすると、そのレスにジャンプできます</li>
              <li>{'>>N'} にマウスを乗せると、レスのプレビューが表示されます</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-blue-700 mb-2">🖼 画像・動画の貼り方</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>画像ファイル（JPEG/PNG/GIF/WebP、最大10MB）を直接添付できます</li>
              <li>YouTubeのURLを単独行に貼ると動画が自動埋め込みされます</li>
              <li>X（Twitter）のポストURLを単独行に貼るとツイートが自動埋め込みされます</li>
            </ul>
            <p className="mt-1 text-gray-500 text-xs">※ URL埋め込みは行の中にURLだけが書かれている場合のみ動作します。</p>
          </section>

          <section>
            <h2 className="font-bold text-blue-700 mb-2">⭐ お気に入り</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>スレッドタイトル横の☆ボタンでお気に入り登録できます</li>
              <li>登録したスレッドは「個人設定」から一覧確認できます</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-blue-700 mb-2">🗑 投稿の削除</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>自分が投稿したレスは「削除」ボタンで削除できます（同じブラウザ・セッション内のみ）</li>
              <li>スレ主はスレッド内のすべてのレスを削除できます</li>
              <li>ブラウザのCookieを削除すると削除権限が失われます</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-blue-700 mb-2">🚨 報告</h2>
            <p className="text-gray-700">ルール違反の投稿は各レスの「報告」ボタンからご連絡ください。確認後、対応いたします。</p>
          </section>

          <section>
            <h2 className="font-bold text-blue-700 mb-2">📋 ルール</h2>
            <p className="text-gray-700">詳細は<Link href="/terms" className="text-blue-600 hover:underline">利用規約</Link>をご確認ください。荒らし・誹謗中傷・スパム投稿は禁止です。</p>
          </section>

        </div>
      </div>
    </div>
  )
}
