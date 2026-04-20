'use server'

import { revalidateTag } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import type { Block } from '@/types/fixed-pages'

const ADMIN_COOKIE = 'admin_auth'
const OPT = { expire: 0 } as const

async function requireAdmin() {
  const cookieStore = await cookies()
  if (cookieStore.get(ADMIN_COOKIE)?.value !== process.env.ADMIN_PASSWORD) {
    redirect('/admin')
  }
}

export interface PageInput {
  id?: number
  title: string
  slug: string
  nav_label: string
  content: Block[]
  is_published: boolean
  show_in_nav: boolean
  sort_order: number
  external_url: string
}

export async function savePage(input: PageInput): Promise<{ error?: string }> {
  await requireAdmin()
  const supabase = await createClient()

  const { title, slug, nav_label, content, is_published, show_in_nav, sort_order, external_url } = input

  if (!title.trim()) return { error: 'タイトルは必須です' }
  if (!slug.trim()) return { error: 'スラッグは必須です' }
  if (!/^[a-z0-9-]+$/.test(slug)) return { error: 'スラッグは英小文字・数字・ハイフンのみ使用できます' }

  const payload = {
    title: title.trim(),
    slug: slug.trim(),
    nav_label: nav_label.trim() || title.trim(),
    content: content as unknown as Record<string, unknown>[],
    is_published,
    show_in_nav,
    sort_order: Number(sort_order) || 10,
    external_url: external_url.trim() || null,
  }

  if (input.id) {
    const { error } = await supabase.from('fixed_pages').update(payload).eq('id', input.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('fixed_pages').insert(payload)
    if (error) return { error: error.message }
  }

  revalidateTag('fixed_pages', OPT)
  revalidateTag(`fixed-page-${slug}`, OPT)
  revalidateTag('nav-pages', OPT)
  return {}
}

export async function deletePage(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()
  const id = parseInt(formData.get('id') as string)
  await supabase.from('fixed_pages').delete().eq('id', id)
  revalidateTag('fixed_pages', OPT)
  revalidateTag('nav-pages', OPT)
  redirect('/admin/pages')
}

export async function togglePublished(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()
  const id = parseInt(formData.get('id') as string)
  const current = formData.get('current') === 'true'
  await supabase.from('fixed_pages').update({ is_published: !current }).eq('id', id)
  revalidateTag('fixed_pages', OPT)
  revalidateTag('nav-pages', OPT)
  redirect('/admin/pages')
}

export async function movePage(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()
  const id = parseInt(formData.get('id') as string)
  const direction = formData.get('direction') as 'up' | 'down'

  const { data: all } = await supabase.from('fixed_pages').select('id, sort_order').order('sort_order')
  if (!all) redirect('/admin/pages')

  const idx = all.findIndex(p => p.id === id)
  if (idx < 0) redirect('/admin/pages')
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= all.length) redirect('/admin/pages')

  await Promise.all([
    supabase.from('fixed_pages').update({ sort_order: all[swapIdx].sort_order }).eq('id', all[idx].id),
    supabase.from('fixed_pages').update({ sort_order: all[idx].sort_order }).eq('id', all[swapIdx].id),
  ])

  revalidateTag('fixed_pages', OPT)
  revalidateTag('nav-pages', OPT)
  redirect('/admin/pages')
}

const STATIC_PAGE_DEFAULTS = [
  {
    slug: 'terms',
    title: '利用規約',
    nav_label: '利用規約',
    content: `1. はじめに
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
本規約に関するお問い合わせは、専用フォームよりご連絡ください。`,
  },
  {
    slug: 'privacy',
    title: 'プライバシーポリシー',
    nav_label: 'プライバシー',
    content: `1. 収集する情報
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
プライバシーに関するお問い合わせはお問い合わせフォームよりご連絡ください。`,
  },
  {
    slug: 'guide',
    title: '使い方',
    nav_label: '使い方',
    content: `🧵 スレッドを立てる
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
詳細は[利用規約](/terms)をご確認ください。荒らし・誹謗中傷・スパム投稿は禁止です。`,
  },
] as const

export async function createDefaultStaticPages() {
  await requireAdmin()
  const supabase = await createClient()

  const created: string[] = []
  const skipped: string[] = []

  for (const def of STATIC_PAGE_DEFAULTS) {
    const { data: existing } = await supabase
      .from('fixed_pages').select('id, content').eq('slug', def.slug).maybeSingle()

    const blocks: Block[] = [{ type: 'text', content: def.content }]

    if (existing) {
      // コンテンツが空の場合のみデフォルト内容で上書き
      const hasContent = Array.isArray(existing.content) && existing.content.length > 0
      if (hasContent) {
        skipped.push(def.title)
        continue
      }
      await supabase.from('fixed_pages')
        .update({ content: blocks as unknown as Record<string, unknown>[] })
        .eq('id', existing.id)
      created.push(def.title)
    } else {
      await supabase.from('fixed_pages').insert({
        slug: def.slug,
        title: def.title,
        nav_label: def.nav_label,
        content: blocks as unknown as Record<string, unknown>[],
        is_published: true,
        show_in_nav: false,
        sort_order: 90,
        external_url: null,
      })
      created.push(def.title)
    }
  }

  revalidateTag('fixed_pages', OPT)
  revalidateTag('nav-pages', OPT)
  redirect('/admin/pages')
}
