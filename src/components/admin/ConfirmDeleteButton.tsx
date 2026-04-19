'use client'

interface Props {
  message?: string
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

export function ConfirmDeleteButton({ message = '削除しますか？', className, style, children }: Props) {
  return (
    <button
      type="submit"
      className={className}
      style={style}
      onClick={e => {
        if (!confirm(message)) e.preventDefault()
      }}
    >
      {children}
    </button>
  )
}
