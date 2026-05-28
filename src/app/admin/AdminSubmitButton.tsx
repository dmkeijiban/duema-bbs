'use client'

import { useFormStatus } from 'react-dom'

type Props = {
  children: React.ReactNode
  pendingText: string
  className?: string
  style?: React.CSSProperties
}

export function AdminSubmitButton({ children, pendingText, className, style }: Props) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={className}
      style={style}
    >
      {pending ? pendingText : children}
    </button>
  )
}
