'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

type Period = 'month' | 'all'

/**
 * 投稿者ランキングの「今月／総合」切り替えタブ。
 *
 * 今月・総合のランキングデータは親（サーバーコンポーネント）で一度に取得済みのため、
 * ここではURL遷移せずクライアントstateで表示だけを切り替える。
 * これによりタブ切り替え時にページ最上部へスクロールが戻らない。
 * （集計・順位・ポイント計算には一切関与しない。表示の出し分けのみ）
 */
export function AuthorRankingTabs({
  initialPeriod,
  monthly,
  total,
  note,
}: {
  initialPeriod: Period
  monthly: ReactNode
  total: ReactNode
  note?: ReactNode
}) {
  const [period, setPeriod] = useState<Period>(initialPeriod)

  return (
    <section className="mb-4 mt-4">
      {/* 期間サブタブ（クライアントstateで切り替え・遷移なし） */}
      <div className="mb-3 flex overflow-hidden border border-gray-300 bg-white">
        <button
          type="button"
          onClick={() => setPeriod('month')}
          aria-pressed={period === 'month'}
          className={`flex-1 border-r border-gray-300 py-2 text-center text-sm font-bold transition-colors ${
            period === 'month'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          今月
        </button>
        <button
          type="button"
          onClick={() => setPeriod('all')}
          aria-pressed={period === 'all'}
          className={`flex-1 py-2 text-center text-sm font-bold transition-colors ${
            period === 'all'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          総合
        </button>
      </div>

      {note}

      {/* 両リストともDOMに保持し、display切り替えで再マウントを避ける */}
      <div className={period === 'month' ? '' : 'hidden'}>{monthly}</div>
      <div className={period === 'all' ? '' : 'hidden'}>{total}</div>
    </section>
  )
}
