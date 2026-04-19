import Link from 'next/link'
import { cookies } from 'next/headers'
import { getCachedSetting } from '@/lib/cached-queries'
import { SettingEditButton } from '@/components/SettingEditButton'

export const metadata = {
  title: '利用規約 | デュエマ掲示板',
}

const DEFAULT_TERMS = `1. はじめに
本掲示板（以下「当サイト」）は、管理人により運営されるデュエル・マスターズ関連のコミュニティサービスです。
当サイトを利用した時点で、本規約に同意したものとみなします。
本規約は必要に応じて変更される場合があります。

2. サービス内容
当サイトは、ユーザー同士が自由にスレッド作成・投稿・閲覧を行える掲示板サービスです。
運営は、事前の通知なくサービス内容の変更・停止を行うことがあります。

3. 投稿内容の取り扱い
ユーザーが投稿した文章・画像・その他の情報（以下「投稿データ」）について、以下の内容に同意するものとします。
・投稿データの著作権は投稿者に帰属します
・ただし当サイトは、運営・掲載・編集・再利用のために無償で利用できるものとします
・ユーザーは投稿データに関して著作者人格権を行使しないものとします
・投稿内容に関する責任は、すべて投稿者本人が負うものとします

4. 禁止事項
以下の内容を含む投稿は禁止します。

■ コミュニティ秩序に関するもの
・誹謗中傷、差別的表現、過度な攻撃行為
・対立を煽る行為、荒らし、スパム投稿
・同一内容の連続投稿やスレッド乱立

■ 法令・権利侵害に関するもの
・著作権・商標権などの侵害
・個人情報の掲載やプライバシー侵害
・犯罪予告、脅迫、違法行為の助長

■ コンテンツ制限
・性的な表現や18歳未満に不適切な内容
・極端に暴力的・残虐な描写
・非公式情報（リーク）や誤解を招く情報の拡散

■ 運営方針に関するもの
・過度な宣伝や外部サイトへの誘導
・本掲示板の趣旨から逸脱した投稿
・その他、運営が不適切と判断する内容

5. 画像投稿に関するルール
画像投稿については以下を禁止します。
・わいせつ・過激・グロテスクな画像
・無断転載された画像（公式・非公式問わず）
・他者の権利を侵害する画像
必要に応じて、画像の削除や非表示措置を行う場合があります。

6. 投稿の削除・制限
運営は以下の場合に、投稿の削除・非表示・ユーザー制限を行うことがあります。
・本規約に違反した場合
・通報があり、内容が不適切と判断された場合
・掲示板の健全な運営に支障があると判断した場合
また、長期間利用されていないスレッドは整理のため削除されることがあります。

7. 免責事項
当サイトは、ユーザーが投稿した内容の正確性・安全性について保証しません。
投稿によって生じたトラブル・損害について、当サイトは一切の責任を負いません。

8. 外部サービス・広告
当サイトでは、広告や外部リンクを掲載する場合があります。
これらのサービス利用に関するトラブルについて、当サイトは責任を負いません。

9. コンテンツの利用について
当サイト内の投稿データについては、以下の範囲で利用可能です。
・SNSでの引用・共有（出典明記推奨）
・個人利用の範囲での閲覧・保存
無断での転載・商用利用・改変は原則として禁止します。

10. お問い合わせ
本規約に関するお問い合わせは、専用フォームよりご連絡ください。`

export default async function TermsPage() {
  const [cookieStore, terms] = await Promise.all([
    cookies(),
    getCachedSetting('terms', DEFAULT_TERMS),
  ])
  const isAdmin = cookieStore.get('admin_auth')?.value === process.env.ADMIN_PASSWORD

  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      {/* パンくず */}
      <nav className="text-xs text-gray-500 mb-4 flex items-center gap-2">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <span className="inline-block px-2 py-0.5 rounded text-white text-[11px]" style={{ background: '#0d6efd' }}>利用規約</span>
        {isAdmin && (
          <SettingEditButton settingKey="terms" initialValue={terms} label="利用規約" rows={20} />
        )}
      </nav>

      <div className="bg-white border border-gray-300 p-5 leading-relaxed text-gray-800">
        <h1 className="text-base font-bold border-b border-gray-200 pb-2 mb-4">■ 利用規約（デュエマ掲示板）</h1>
        <div style={{ whiteSpace: 'pre-wrap' }} className="text-sm text-gray-800">
          {terms}
        </div>
      </div>
    </div>
  )
}
