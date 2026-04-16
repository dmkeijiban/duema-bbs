export interface Notice {
  id: number
  title: string
  body: string
  image_url: string
  link_url: string
  display_type: string // 'banner' | 'text' | 'image' | 'card'
  position: string
  sort_order: number
  is_active: boolean
}

function NoticeInner({ notice }: { notice: Notice }) {
  const { display_type, title, body, image_url } = notice

  if (display_type === 'banner') {
    return (
      <div className="flex items-center gap-2 border border-gray-300 bg-white px-3 py-2">
        {image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image_url} alt={title} style={{ width: 64, height: 64, objectFit: 'cover', flexShrink: 0 }} />
        )}
        <div className="min-w-0">
          {title && <div className="font-bold text-sm text-gray-800 line-clamp-1">{title}</div>}
          {body && <div className="text-xs text-gray-600 line-clamp-2 mt-0.5">{body}</div>}
        </div>
      </div>
    )
  }

  if (display_type === 'text') {
    return (
      <div className="border border-gray-300 bg-white px-3 py-2">
        {title && <div className="font-bold text-sm text-gray-800">{title}</div>}
        {body && <div className="text-xs text-gray-600 mt-0.5">{body}</div>}
      </div>
    )
  }

  if (display_type === 'image') {
    if (!image_url) return null
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image_url} alt={title} className="w-full" />
    )
  }

  if (display_type === 'card') {
    return (
      <div className="border border-gray-300 bg-white">
        {image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image_url} alt={title} className="w-full object-cover" style={{ maxHeight: 160 }} />
        )}
        <div className="px-3 py-2">
          {title && <div className="font-bold text-sm text-gray-800">{title}</div>}
          {body && <div className="text-xs text-gray-600 mt-0.5">{body}</div>}
        </div>
      </div>
    )
  }

  return null
}

export function NoticeBlock({ notice }: { notice: Notice }) {
  const inner = <NoticeInner notice={notice} />
  if (!inner) return null

  if (notice.link_url) {
    return (
      <a href={notice.link_url} target="_blank" rel="noopener noreferrer" className="block mb-2">
        {inner}
      </a>
    )
  }

  return <div className="mb-2">{inner}</div>
}
