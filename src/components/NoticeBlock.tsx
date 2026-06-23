import Image from 'next/image'

export interface NoticeItem {
  image_url: string
  title: string
  body: string
  link_url: string
}

export interface Notice {
  id: number
  position: string
  sort_order: number
  is_active: boolean
  header_text: string
  columns: number
  items: NoticeItem[]
  created_at: string
  show_in_thread: boolean
}

export function NoticeBlock({ notice, priority }: { notice: Notice; priority?: boolean }) {
  const items = (notice.items as NoticeItem[]) || []
  if (items.length === 0 && !notice.header_text) return null

  return (
    <div className="mb-3 border border-gray-200 bg-white px-2 py-2 md:mb-2 md:border-0 md:bg-transparent md:px-0 md:py-0">
      {notice.header_text && (
        <p className="mb-2 px-1 text-sm font-bold text-gray-800 md:mb-1">{notice.header_text}</p>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] md:gap-1 md:overflow-visible md:pb-0">
        {items.map((item, i) => {
          const inner = (
            <div className="relative h-14 overflow-hidden bg-gray-100 md:h-20">
              {item.image_url && (
                <Image
                  src={item.image_url}
                  alt={item.title || ''}
                  fill
                  className="object-cover"
                  loading="eager"
                  priority={priority && i === 0}
                  sizes="(max-width: 768px) 120px, 25vw"
                />
              )}
              {item.title && (
                <div
                  className="hidden md:block absolute bottom-0 inset-x-0 px-2 py-1.5 text-white text-xs font-light leading-snug text-center"
                  style={{ background: 'rgba(0,0,0,0.65)' }}
                >
                  {item.title}
                  {item.body && <span className="block text-[10px] font-light opacity-90 mt-0.5">{item.body}</span>}
                </div>
              )}
            </div>
          )
          return item.link_url ? (
            <a
              key={i}
              href={item.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-[31vw] max-w-[135px] shrink-0 md:min-w-0 md:max-w-none md:flex-1"
            >
              {inner}
            </a>
          ) : (
            <div key={i} className="w-[31vw] max-w-[135px] shrink-0 md:min-w-0 md:max-w-none md:flex-1">
              {inner}
            </div>
          )
        })}
      </div>
      {notice.position === 'top' && (
        <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-gray-500 md:hidden">
          <span className="h-px flex-1 bg-gray-200" />
          <span>ここからスレ一覧</span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>
      )}
    </div>
  )
}
