import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { HallOfFamePredictionBuilder } from './HallOfFamePredictionBuilder'

export const metadata: Metadata = {
  title: '殿堂・プレ殿予想（非公開） | デュエマ掲示板',
  robots: { index: false, follow: false },
}

const ADMIN_COOKIE = 'admin_auth'

const CANDIDATE_NAMES = [
  '我竜塔第一層 セイント・キャッスル',
  '緊急再誕',
  'ゾンビポンの助',
  'エンドレス・フローズン・カーニバル',
  '楯教の求道者 ザゼ・ゼーン',
  '烈しき切札 ドギラゴン逆',
  '心転地と透幻郷の決断',
  'PP-「P」',
  'ウィリデ・ゴル・ゲルス',
  'ピザスターのアンティハムト',
  'レヴィヤの地図',
  '観覧！ホールインランド・ヘラクレス',
  '単騎連射 マグナム',
  '二角の超人',
  '超神羅星アポロヌス・ドラゲリオン',
  '絶望と反魂と滅殺の決断',
  '水上第九院 シャコガイル',
  'カット・丙-二式',
  '超神羅ギュンター・ペガサス',
  'ボルシャック・ドギラゴン',
  '流星のガイアッシュ・カイザー',
  '蒼き団長 ドギラゴン剣',
  '勝利のアパッチ・ウララー',
  '生命と大地と轟破の決断',
  'ヘブンズ・フォース',
  '絶望神サガ',
  '超次元バイス・ホール',
  '龍装鬼 オブザ08号／終焉の開闢',
  '“轟轟轟”ブランド',
  'BAKUOOON・ミッツァイル',
  '天命龍装 ホーリーエンド／ナウ・オア・ネバー',
  '禁断竜王 Vol-Val-8',
  '時の法皇 ミラダンテXII',
  '音精 ラフルル',
  '奇天烈 シャッフ',
  'ドンドン火噴くナウ',
  '闘争類拳嘩目 ステゴロ・カイザー／お清めシャラップ',
  'CRYMAX ジャオウガ',
  '若き大長老 アプル',
  '同期の妖精／ド浮きの動悸',
] as const

type ZukanCandidateRow = {
  name: string
  official_image_url: string | null
}

async function fetchCandidateImages() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('zukan_cards')
      .select('name, official_image_url')
      .in('name', [...CANDIDATE_NAMES])

    if (error) return new Map<string, string | null>()

    return new Map(
      ((data ?? []) as ZukanCandidateRow[]).map(card => [card.name, card.official_image_url]),
    )
  } catch {
    return new Map<string, string | null>()
  }
}

export default async function PrivateHallOfFamePredictionsPage() {
  const isPreview = process.env.VERCEL_ENV === 'preview'

  if (!isPreview) {
    const cookieStore = await cookies()
    const isAdmin = verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)
    if (!isAdmin) redirect('/admin')
  }

  const imageByName = await fetchCandidateImages()
  const candidates = CANDIDATE_NAMES.map(name => ({
    name,
    imageUrl: imageByName.get(name) ?? null,
  }))

  return (
    <main className="min-h-screen bg-gray-50 px-3 py-5 sm:px-5 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/admin" className="text-xs font-bold text-blue-700 hover:underline">← 管理画面へ戻る</Link>
            <h1 className="mt-3 text-2xl font-black text-gray-950">殿堂・プレ殿予想</h1>
            <p className="mt-1 text-sm text-gray-500">候補カードを検索し、プレミアム殿堂・殿堂入り・殿堂解除へ振り分ける試作ページ</p>
          </div>
          <span className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-bold text-gray-600">
            {isPreview ? 'Preview限定・非公開' : '管理者限定・非公開'}
          </span>
        </div>

        <HallOfFamePredictionBuilder candidates={candidates} />
      </div>
    </main>
  )
}
