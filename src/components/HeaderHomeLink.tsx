'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode, MouseEvent } from 'react'

export function HeaderHomeLink({ children, className }: { children: ReactNode; className?: string }) {
  const pathname = usePathname()

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (pathname !== '/') return

    event.preventDefault()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (window.location.pathname !== '/' || window.location.search || window.location.hash) {
      window.history.replaceState(null, '', '/')
    }
  }

  return (
    <Link href="/" onClick={handleClick} className={className}>
      {children}
    </Link>
  )
}
