import Link from 'next/link'

export type SelectSubmissionTab = 'ranking' | 'all' | 'mine'

export function parseSelectSubmissionTab(value: string | undefined): SelectSubmissionTab {
  return value === 'ranking' || value === 'mine' ? value : 'all'
}

// SELECT型企画の投稿一覧タブ。企画設定（maxChoices）からラベルを生成し、slug個別分岐はしない
export default function SelectMakerSubmissionTabs({
  slug,
  active,
  choiceLabel,
  className = '',
}: {
  slug: string
  active: SelectSubmissionTab
  choiceLabel: string
  className?: string
}) {
  const tabs: { key: SelectSubmissionTab; label: string }[] = [
    { key: 'ranking', label: '集計結果' },
    { key: 'all', label: `みんなの${choiceLabel}` },
    { key: 'mine', label: `自分の${choiceLabel}` },
  ]
  return (
    <nav role="tablist" aria-label="投稿一覧の表示切替" className={`items-center gap-1.5 ${className}`}>
      {tabs.map(tab => {
        const isActive = tab.key === active
        return (
          <Link
            key={tab.key}
            href={`/makers/${slug}/submissions?tab=${tab.key}`}
            role="tab"
            aria-selected={isActive}
            className={
              isActive
                ? 'flex min-h-9 shrink-0 items-center justify-center whitespace-nowrap rounded border border-blue-600 bg-blue-600 px-3 text-xs font-bold text-white shadow-sm sm:text-sm'
                : 'flex min-h-9 shrink-0 items-center justify-center whitespace-nowrap rounded border border-blue-100 bg-white px-3 text-xs font-medium text-blue-700 hover:bg-blue-50 sm:text-sm'
            }
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
