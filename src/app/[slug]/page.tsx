import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCachedFixedPage } from '@/lib/cached-queries'
import { renderBlock } from '@/components/FixedPageBlocks'
import { SnsCtaCard } from '@/components/SnsCtaCard'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const page = await getCachedFixedPage(slug)
  if (!page) return {}
  return { title: `${page.title} | デュエマ掲示板` }
}

export default async function FixedPageRoute({ params }: Props) {
  const { slug } = await params
  const page = await getCachedFixedPage(slug)
  if (!page) notFound()

  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      <nav className="text-xs text-gray-500 mb-4 flex items-center gap-2">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <span className="inline-block px-2 py-0.5 text-white text-[11px]" style={{ background: '#0d6efd' }}>
          {page.title}
        </span>
      </nav>
      <div className="bg-white border border-gray-300 p-5">
        <h1 className="text-base font-bold border-b border-gray-200 pb-2 mb-4">■ {page.title}</h1>
        <div className="space-y-4">
          {page.content.length === 0 ? (
            <p className="text-xs text-gray-400">コンテンツがありません</p>
          ) : (
            page.content.map((block, i) => renderBlock(block, i))
          )}
        </div>
      </div>
      <SnsCtaCard />
    </div>
  )
}
