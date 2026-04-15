import Link from 'next/link'

export const metadata = {
  title: '利用規約 | デュエマ掲示板',
}

export default function TermsPage() {
  return (
    <div className="max-w-5xl mx-auto px-3 py-4 text-sm">
      {/* パンくず */}
      <nav className="text-xs text-gray-500 mb-4">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span className="mx-1">{'>'}</span>
        <span className="inline-block px-2 py-0.5 rounded text-white text-[11px]" style={{ background: '#0d6efd' }}>利用規約</span>
      </nav>

      <div className="bg-white border border-gray-300 p-5 space-y-5 leading-relaxed text-gray-800">
        <h1 className="text-base font-bold border-b border-gray-200 pb-2">掲示板を利用するにあたって</h1>
        <p>
          このデュエマ掲示板（以下「当掲示板」）は、管理人により開設・運営されています。<br />
          当掲示板を利用する人（以下「ユーザー」）は、以下の利用内容をご承諾いただいたものとみなし、本サービスを利用してなされた一切の行為及びその結果について一切の責任を負います。<br />
          なお、本規約の内容は、必要に応じて変更することがあります。<br />
          <span className="font-bold">意図的かつ悪質な荒らし行為はユーザーへの連絡なしに関係機関への通報及び必要な対応を行う場合があります。予めご了承ください。</span>
        </p>

        <Section title="○ユーザー利用規約">
          <p>他人を不快にさせるような攻撃的な書き込みは避けてください。</p>
          <p>不適切な書き込みや画像だと判断された場合は削除されることがあります。</p>
          <p>また悪質だと判断された場合はユーザーを規制することがあります。</p>
          <p>削除された云々に関わらず画像やレス情報のログを保管しています。</p>
          <p>ユーザーが投稿した書き込み内容及びこれに含まれる知的財産権（著作権法第21条ないし第28条に規定される権利も含む）その他の権利につき（第三者に対して再許諾する権利を含みます）、掲示板運営者に対し無償で譲渡することを承諾します。</p>
          <p>また、当掲示板のコンテンツを使用、複製、改変、修正、公表、送信、表示に関して本規約で認められている場合は無償で許諾することになります。</p>
          <p>ユーザーが投稿した画像等の情報に関する責任や所有権（著作権）は、全て投稿したユーザー自身に帰属します。</p>
          <p>当掲示板はユーザーが本サービスを利用して投稿した画像等の情報の内容について、一切責任を負いません。</p>
          <p>ユーザーは、当掲示板から権利を承諾されたものに対し著作者人格権を行使しないものとします。</p>
          <p>当掲示板は特定地域向けのサービス提供を目的としません。</p>
        </Section>

        <Section title="■スレ建てやレス書き込みに関するユーザーの禁止事項">
          <ul className="list-none space-y-0.5 text-gray-700">
            {[
              '18禁内容（性器・性行・性的接触などの直接描写）',
              '現代の政治・宗教・社会・海外時事・ジェンダー問題',
              '対立煽り、荒らし、スパムなどの迷惑行為',
              '差別、誹謗中傷、ヘイトスピーチ、特定個人や作品への過度な攻撃',
              'ネタバレ、リーク情報（公式発表準拠）',
              '売上や順位などを用いた叩き行為',
              '著作権侵害',
              '脅迫及び犯罪予告',
              '個人情報及びプライバシー侵害',
              '宣伝や外部サイトへの誘導行為',
              '他掲示板やまとめサイトの話題（攻略系除く）',
              '特定の内輪ネタや荒れやすいコンテンツ',
              '実在人物のスキャンダルやゴシップ',
              '過度なコピペ連投',
              '過去の歴史ネタ（一定時代以降）',
              '歌詞全文掲載',
              '残酷な行為の詳細描写',
              '削除されたスレの再投稿',
              '暴言',
              'タイトル空白スレッド',
              '動物虐待',
              '同一内容スレの乱立',
            ].map(item => <li key={item}>・{item}</li>)}
          </ul>
        </Section>

        <Section title="■画像投稿に関するユーザーの禁止事項">
          <ul className="list-none space-y-0.5 text-gray-700">
            {[
              'グロ画像',
              'エロ画像（露出・性的行為など）',
              '猥褻画像',
              '児童に関する不適切画像',
              '非公式の二次創作画像（URL共有のみ可）',
              '他者制作の一次創作画像（URL共有のみ可）',
              '漫画や雑誌の無断転載',
              'ホラー画像',
              '不快感を与える画像（虫・集合体など）',
            ].map(item => <li key={item}>・{item}</li>)}
          </ul>
        </Section>

        <Section title="■スレッド・レス削除基準">
          <p>通報により削除対応を行います。</p>
          <p>不正な報告は対象外となります。</p>
          <p>違反とまではいかない場合は非表示措置を行うことがあります。</p>
          <p>連投は規制対象となる場合があります。</p>
          <p>規制時は過去投稿が削除される場合があります。</p>
          <p>放置されたスレッドは削除対象となります。</p>
          <p>異議申し立ては問い合わせフォームより対応します。</p>
        </Section>

        <Section title="■当掲示板のコンテンツ使用について">
          <p>以下の条件を満たす場合に限り、コンテンツ使用（転載・切り抜き等）を認めます。<br />
          違反が続く場合、特定チャンネル等の使用を禁止することがあります。</p>

          <p className="font-semibold mt-2">禁止事項</p>
          <ul className="list-none space-y-0.5 text-gray-700">
            {['現行スレッドや削除済みスレの使用', 'ステルスマーケティング', '創作イラストの転載', '規約違反内容の使用', '意図的な改変・誤解誘導'].map(i => <li key={i}>・{i}</li>)}
          </ul>

          <p className="font-semibold mt-2">媒体別ルール</p>
          <ul className="list-none space-y-0.5 text-gray-700">
            <li>・動画サイトへの使用厳禁（見つけた際は早急に対処します）</li>
            <li>・SNS：自由（スクショ可）</li>
            <li>・ブログ等：転載禁止（引用は可）</li>
            <li>・テレビ等：掲示板名の記載</li>
          </ul>

          <p className="mt-2">コンテンツ使用によるトラブルについて当掲示板は責任を負いません。<br />
          また管理人は外部サイト・動画等には関与していません。<br />
          問題が発生した場合、規約変更を行うことがあります。<br />
          使用に関する事前連絡は不要です。</p>
        </Section>

        <p className="text-gray-600">
          お問い合わせは<Link href="/contact" className="text-blue-600 hover:underline">専用フォーム</Link>までお願いいたします。
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-bold text-gray-900 mb-2">{title}</h2>
      <div className="space-y-1 text-gray-800">{children}</div>
    </div>
  )
}
