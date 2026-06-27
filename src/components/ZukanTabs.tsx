import Link from 'next/link'

export type ZukanTab = 'memories' | 'hall-of-fame'

const TABS: { key: ZukanTab; label: string; href: string }[] = [
  { key: 'memories', label: '思い出図鑑', href: '/zukan?tab=memories' },
  { key: 'hall-of-fame', label: '殿堂・プレミアム殿堂図鑑', href: '/zukan?tab=hall-of-fame' },
]

// /zukan 内で「思い出図鑑」「殿堂・プレミアム殿堂図鑑」を切り替えるタブUI。
// 同一 /zukan ルート内の遷移なので別ページに飛んだようには見えない。派手な色は使わず白基調。
// タブ全体を1つの薄いグレー枠の白カードで囲み、選択中タブを白背景＋下線で明示する。
export function ZukanTabs({ active }: { active: ZukanTab }) {
  return (
    <div className="mb-4 flex overflow-hidden border border-gray-300 bg-white" role="tablist" aria-label="図鑑切り替え">
      {TABS.map((tab, i) => {
        const isActive = tab.key === active
        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            scroll={false}
            className={[
              'flex-1 whitespace-nowrap px-2 py-2.5 text-center text-xs font-bold transition-colors sm:px-4 sm:text-sm [-webkit-tap-highlight-color:transparent]',
              i > 0 ? 'border-l border-gray-300' : '',
              isActive
                ? 'border-b-2 border-b-gray-800 bg-white text-gray-800'
                : 'border-b-2 border-b-transparent bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-800',
            ].join(' ')}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
