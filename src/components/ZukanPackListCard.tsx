import Link from 'next/link'
import type { ZukanPack } from '@/lib/zukan'

export function ZukanPackListCard({ pack }: { pack: ZukanPack }) {
  return (
    <Link
      href={`/zukan/${pack.slug}`}
      className="block h-full cursor-pointer transition-all duration-100 hover:shadow-sm active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 [-webkit-tap-highlight-color:transparent]"
    >
      <div className="flex h-full overflow-hidden border border-gray-300 bg-white transition-colors hover:border-blue-400">
        <div className="w-20 shrink-0 bg-orange-50 sm:w-24">
          {pack.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pack.image_url}
              alt={`${pack.code} ${pack.name} パック画像`}
              width={96}
              height={96}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain p-1.5"
            />
          ) : (
            <div className="flex h-full min-h-[72px] items-center justify-center text-[10px] font-bold text-orange-300">
              準備中
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col px-3 py-2">
          <div className="font-mono text-xs font-bold text-blue-700">{pack.code}</div>
          <div className="mt-0.5 text-sm font-bold leading-snug text-gray-800">{pack.name}</div>
          <dl className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-gray-600">
            {pack.released_year && (
              <div><dt className="inline font-bold">発売：</dt><dd className="inline">{pack.released_year}</dd></div>
            )}
            {pack.card_count && (
              <div><dt className="inline font-bold">収録：</dt><dd className="inline">全{pack.card_count}種</dd></div>
            )}
          </dl>
        </div>
      </div>
    </Link>
  )
}
