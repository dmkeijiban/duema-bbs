import Link from 'next/link'
import type { ZukanPack } from '@/lib/zukan'
import { getZukanProduct, getZukanProductImagePath } from '@/lib/zukan-products'

export function ZukanPackListCard({ pack }: { pack: ZukanPack }) {
  const product = getZukanProduct(pack.slug)
  const imageUrl = pack.image_url ?? getZukanProductImagePath(pack.slug)

  return (
    <div className="flex h-full overflow-hidden border border-gray-300 bg-white transition-colors hover:border-blue-400 hover:shadow-sm">
      <Link
        href={`/zukan/${pack.slug}`}
        className="flex min-w-0 flex-1 cursor-pointer transition-all duration-100 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 [-webkit-tap-highlight-color:transparent]"
      >
        <div className="w-20 shrink-0 bg-orange-50 sm:w-24">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={`${pack.code} ${pack.name} パック画像`}
              width={96}
              height={128}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain p-1.5"
            />
          ) : (
            <div className="flex h-full min-h-[72px] items-center justify-center text-[10px] font-bold text-orange-300">準備中</div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col px-3 py-2">
          <div className="font-mono text-xs font-bold text-blue-700">{pack.code}</div>
          <div className="mt-0.5 text-sm font-bold leading-snug text-gray-800">{pack.name}</div>
          <dl className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-gray-600">
            {pack.released_year && <div><dt className="inline font-bold">発売：</dt><dd className="inline">{pack.released_year}</dd></div>}
            {pack.card_count && <div><dt className="inline font-bold">収録：</dt><dd className="inline">全{pack.card_count}種</dd></div>}
          </dl>
        </div>
      </Link>
      {product && (
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center border-l border-gray-200 px-2 text-[10px] font-bold text-blue-600 hover:bg-blue-50 sm:px-3 sm:text-xs"
          aria-label={`${pack.code}の公式商品情報を開く`}
        >
          公式↗
        </a>
      )}
    </div>
  )
}
