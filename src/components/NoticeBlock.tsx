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
    <div className="mb-2">
      {/* セクションタイトル */}
      {notice.header_text && (
        <p className="text-sm font-bold text-gray-800 mb-1 px-1">{notice.header_text}</p>
      )}
      {/* グリッド */}
      <div className="flex gap-1">
        {items.map((item, i) => {
          // height固定でCLS防止（バナー画像が未ロードでも高さが確保される）
          const inner = (
            <div className="relative overflow-hidden bg-gray-100" style={{ flex: '1', height: 80 }}>
              {item.image_url && (
                <Image
                  src={item.image_url}
                  alt={item.title || ''}
                  fill
                  className="object-cover"
                  loading="eager"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
              )}
              {/* タイトルオーバーレイ（PC表示のみ）*/}
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
            <a key={i} href={item.link_url} target="_blank" rel="noopener noreferrer" className="block min-w-0" style={{ flex: 1 }}>
              {inner}
            </a>
          ) : (
            <div key={i} className="min-w-0" style={{ flex: 1 }}>{inner}</div>
          )
        })}
      </div>
    </div>
  )
}
