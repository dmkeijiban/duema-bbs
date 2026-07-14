'use client'

import type { MouseEvent, ReactNode } from 'react'

export default function SmoothHashLink({ targetId, className, children }: { targetId: string; className?: string; children: ReactNode }) {
  function scrollToTarget(event: MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById(targetId)
    if (!target) return
    event.preventDefault()
    history.pushState(null, '', `#${targetId}`)
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return <a href={`#${targetId}`} onClick={scrollToTarget} className={className}>{children}</a>
}
