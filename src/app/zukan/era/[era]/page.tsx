import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ZukanPackListCard } from '@/components/ZukanPackListCard'
import { SITE_URL } from '@/lib/site-config'
import { fetchPublishedPacks } from '@/lib/zukan'
import { findZukanEra, isPackInZukanEra, ZUKAN_ERAS } from '@/lib/zukan-eras'

type Props = {
  params: Promise<{ era: string }>
}

export function generateStaticParams() {
  return ZUKAN_ERAS.map(era => ({ era: era.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { era: eraSlug } = await params
  const era = findZukanEra(eraSlug)
  if (!era) return {}

  const title = `${era.name}（${era.years}）の商品一覧 | デュエマ思い出図鑑`
  const description = `${era.name}に該当するデュエル・マスターズのパック・商品一覧です。見たい商品を選んで収録カードや思い出を確認できます。`
  const url = `${SITE_URL}/zukan/era/${era.slug}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
  }
}

export default async function ZukanEraPage({ params }: Props) {
  const { era: eraSlug } = await params
  const era = findZukanEra(eraSlug)
  if (!era) notFound()

  const allPacks = await fetchPublishedPacks()
  const packs = (allPacks ?? []).filter(pack => isPackInZukanEra(pack.sort_order, era))

  return (
    <div className="mx-auto max-w-screen-xl px-2 pb-0 pt-2">
      <nav className="mb-2 flex items-center gap-x-1 text-xs text-gray-500" aria-label="パンくず">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <Link href="/zukan" className="text-blue-600 hover:underline">思い出図鑑</Link>
        <span>{'>'}</span>
        <span>{era.name}</span>
      </nav>

      <header className="mb-4 border border-gray-300 bg-white px-4 py-4">
        <h1 className="text-lg font-bold text-gray-800">{era.name}の商品一覧</h1>
        <p className="mt-2 text-sm text-gray-600">{era.years}に展開されたパック・商品から選べます。</p>
      </header>

      {packs.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {packs.map(pack => <ZukanPackListCard key={pack.slug} pack={pack} />)}
        </div>
      ) : (
        <div className="border border-gray-300 bg-white px-4 py-8 text-center">
          <p className="text-sm text-gray-600">この時代の商品は現在準備中です。</p>
          <Link href="/zukan" className="mt-4 inline-block text-sm font-bold text-blue-600 hover:underline">
            思い出図鑑へ戻る
          </Link>
        </div>
      )}
    </div>
  )
}
