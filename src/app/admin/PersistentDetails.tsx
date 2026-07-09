'use client'

import { useEffect, useRef } from 'react'

const STORAGE_PREFIX = 'duema-admin-details-'

interface Props {
  storageKey: string
  defaultOpen: boolean
  className?: string
  children: React.ReactNode
}

// 管理画面内の<details>開閉状態をlocalStorageに保存し、次回表示時に復元する。
// サーバー保存やDBは使わず、管理画面だけで完結する。
export function PersistentDetails({ storageKey, defaultOpen, className, children }: Props) {
  const ref = useRef<HTMLDetailsElement>(null)
  const fullKey = `${STORAGE_PREFIX}${storageKey}`

  useEffect(() => {
    const el = ref.current
    if (!el) return

    try {
      const saved = window.localStorage.getItem(fullKey)
      if (saved === 'open') el.open = true
      else if (saved === 'closed') el.open = false
    } catch {
      // localStorageが使えない環境ではデフォルトの開閉状態のまま
    }

    const handleToggle = () => {
      try {
        window.localStorage.setItem(fullKey, el.open ? 'open' : 'closed')
      } catch {
        // 保存できなくても表示自体は問題なく動作する
      }
    }

    el.addEventListener('toggle', handleToggle)
    return () => el.removeEventListener('toggle', handleToggle)
  }, [fullKey])

  return (
    <details ref={ref} open={defaultOpen} className={className}>
      {children}
    </details>
  )
}
