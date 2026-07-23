'use client'

import type { ResumeLayoutType } from '@/lib/maker-resume'

const OPTIONS: { value: ResumeLayoutType; title: string; description: string }[] = [
  { value: 'visual', title: '見やすさ重視レイアウト', description: '名前・世代・使用デッキ・好きなカードなどを大きく表示。スマホやXで縮小されても内容が伝わりやすい。' },
  { value: 'classic', title: '標準レイアウト', description: '現在使用している履歴書デザイン。細かい項目まで一覧で確認できる。' },
]

export function ResumeLayoutToggle({
  value,
  onChange,
  heading = '履歴書のデザインを選ぶ',
  compact = false,
}: {
  value: ResumeLayoutType
  onChange: (next: ResumeLayoutType) => void
  heading?: string | null
  compact?: boolean
}) {
  return <div>
    {heading && <h2 className="font-black text-slate-900">{heading}</h2>}
    <div className={`mt-2 grid gap-2 ${compact ? 'grid-cols-2' : 'sm:grid-cols-2'}`}>
      {OPTIONS.map(option => <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        aria-pressed={value === option.value}
        className={`min-h-11 rounded-xl border p-3 text-left transition-colors ${value === option.value ? 'border-emerald-700 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
      >
        <p className={`text-sm font-bold ${value === option.value ? 'text-emerald-800' : 'text-slate-800'}`}>{option.title}</p>
        {!compact && <p className="mt-1 text-xs text-slate-500">{option.description}</p>}
      </button>)}
    </div>
  </div>
}
