'use client'

import { useEffect, useState } from 'react'
import type { HonorTitle } from '@/lib/honor-title'

const STORAGE_KEY = 'honor-title-last-seen-key'

interface Props {
  title: HonorTitle
}

// 自分のプロフィールを開いたときだけ、前回表示時より称号が上がっていれば
// 軽い昇格表示を出す。DBスキーマ変更を避けるためlocalStorageのみで判定する。
export function HonorRankUpBanner({ title }: Props) {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    try {
      const lastSeenKey = window.localStorage.getItem(STORAGE_KEY)
      if (lastSeenKey && lastSeenKey !== title.key) {
        setShowBanner(true)
      }
      window.localStorage.setItem(STORAGE_KEY, title.key)
    } catch {
      // localStorage不可の環境では演出をスキップするだけ
    }
  }, [title.key])

  if (!showBanner) return null

  return (
    <div className="mt-4 rounded-sm border border-yellow-300 bg-yellow-50 px-4 py-3 text-center text-sm font-bold text-yellow-800">
      ✨ 昇格！ {title.label}になりました！
    </div>
  )
}
