import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCachedFixedPage } from '@/lib/cached-queries'
import type { Block } from '@/types/fixed-pages'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const page = await getCachedFixedPage(slug)
  if (!page) return {}
  return { title: `${page.title} | デュエマ掲示板` }
}

function renderBlock(block: Block, i: number) {
  if (block.type === 'text') {
    return (
      <div key={i} className="text-sm text-gray-800 leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
        {block.content}
      </div>
    )
  }
  if (block.type === 'image') {
    const img = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={i}
        src={block.url}
        alt={block.alt ?? ''}
        loading="lazy"
        style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
        className="border border-gray-100"
      />
    )
    if (block.link) {
      return (
        <a key={i} href={block.link} target="_blank" rel="noopener noreferrer" className="inline-block">
          {img}
        </a>
      )
    }
    return img
  }
  if (block.type === 'button') {
    return (
      <div key={i}>
        <a
          href={block.url}
          target={block.url.startsWith('http') ? '_blank' : undefined}
          rel={block.url.startsWith('http') ? 'noopener noreferrer' : undefined}
          className="inline-block px-5 py-2 text-sm font-medium text-white hover:opacity-90"
          style={{ background: '#0d6efd' }}
        >
          {block.label}
        </a>
      </div>
    )
  }
  return null
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
    </div>
  )
}
