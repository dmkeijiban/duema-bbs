'use client'

import { useFormStatus } from 'react-dom'

type Props = {
  children: React.ReactNode
  pendingText: string
  className?: string
  style?: React.CSSProperties
  confirmMessage?: string
}

export function AdminSubmitButton({ children, pendingText, className, style, confirmMessage }: Props) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={className}
      style={style}
      onClick={confirmMessage ? (e) => { if (!window.confirm(confirmMessage)) e.preventDefault() } : undefined}
    >
      {pending ? pendingText : children}
    </button>
  )
}
