import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { getCachedPostGuidanceSettings } from '@/lib/cached-queries'
import { PostGuidanceToggleButton } from './PostGuidanceToggleButton'

const ADMIN_COOKIE = 'admin_auth'

async function isAdmin() {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)
}

export default async function PostGuidanceAdminPage() {
  if (!(await isAdmin())) redirect('/admin')

  const settings = await getCachedPostGuidanceSettings()

  return (
    <div className="max-w-4xl mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">💬 投稿案内設定</h1>
        <Link href="/admin" className="text-xs text-gray-500 hover:underline">← 管理画面に戻る</Link>
      </div>

      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-xs text-blue-700 space-y-1">
        <p><strong>使い方：</strong>各案内文の表示・非表示を切り替えられます。文言自体はここでは編集できません。</p>
        <p>初期値はすべて表示（ON）です。非表示にしても投稿・コメント処理には影響しません。</p>
      </div>

      <div className="space-y-3">
        <div className="bg-white border border-gray-200 p-3">
          <p className="font-bold text-gray-800 mb-1">スレッド投稿フォーム内の案内文</p>
          <p className="text-xs text-gray-500 mb-2">
            「今のデュエマの話でも、昔の思い出でも大歓迎です！質問・相談・予想など、気軽にスレッドを立ててください！」
          </p>
          <PostGuidanceToggleButton
            settingKey="show_thread_form_hint"
            enabled={settings.showThreadFormHint}
          />
        </div>

        <div className="bg-white border border-gray-200 p-3">
          <p className="font-bold text-gray-800 mb-1">コメント投稿後の案内文</p>
          <p className="text-xs text-gray-500 mb-2">
            「コメントありがとうございます！次はあなたの好きな話題でスレッド投稿してみよう！」
          </p>
          <PostGuidanceToggleButton
            settingKey="show_after_comment_thread_prompt"
            enabled={settings.showAfterCommentThreadPrompt}
          />
        </div>

        <div className="bg-white border border-gray-200 p-3">
          <p className="font-bold text-gray-800 mb-1">コメント投稿フォーム内の案内文</p>
          <p className="text-xs text-gray-500 mb-2">
            「一言だけでもコメント大歓迎です！あなたのコメントでスレを盛り上げましょう！」
          </p>
          <PostGuidanceToggleButton
            settingKey="show_comment_form_hint"
            enabled={settings.showCommentFormHint}
          />
        </div>
      </div>
    </div>
  )
}
