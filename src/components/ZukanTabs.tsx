import Link from 'next/link'

export type ZukanTab = 'memories' | 'hall-of-fame'

const TABS: { key: ZukanTab; label: string; href: string }[] = [
  { key: 'memories', label: '思い出図鑑', href: '/zukan?tab=memories' },
  { key: 'hall-of-fame', label: '殿堂・プレミアム殿堂図鑑', href: '/zukan?tab=hall-of-fame' },
]

// /zukan 内で「思い出図鑑」「殿堂・プレミアム殿堂図鑑」を切り替えるタブUI。
// 同一 /zukan ルート内の遷移なので別ページに飛んだようには見えない。派手な色は使わず白基調。
export function ZukanTabs({ active }: { active: ZukanTab }) {
  return (
    <div className="mb-4 flex border-b border-gray-300" role="tablist" aria-label="図鑑切り替え">
      {TABS.map(tab => {
        const isActive = tab.key === active
        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            scroll={false}
            className={[
              'flex-1 -mb-px whitespace-nowrap border border-b-0 px-2 py-2.5 text-center text-xs font-bold transition-colors sm:px-4 sm:text-sm [-webkit-tap-highlight-color:transparent]',
              isActive
                ? 'border-gray-300 bg-white text-gray-800'
                : 'border-transparent bg-gray-50 text-gray-500 hover:text-gray-800',
            ].join(' ')}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
