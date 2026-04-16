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
}

export function NoticeBlock({ notice }: { notice: Notice }) {
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
          const inner = (
            <div className="relative overflow-hidden bg-gray-100" style={{ flex: '1' }}>
              {item.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_url} alt={item.title || ''} className="w-full block object-cover" />
              )}
              {/* タイトルオーバーレイ（画像下部に黒透過＋白テキスト）*/}
              {item.title && (
                <div
                  className="absolute bottom-0 inset-x-0 px-2 py-1.5 text-white text-xs font-bold leading-snug"
                  style={{ background: 'rgba(0,0,0,0.45)' }}
                >
                  {item.title}
                  {item.body && <span className="block text-[10px] font-normal opacity-90 mt-0.5">{item.body}</span>}
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
