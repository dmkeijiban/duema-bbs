import Link from 'next/link'

export function ThreadListHeader({
  title,
  icon,
  subtitle,
}: {
  title: string
  icon: string
  subtitle?: string
}) {
  return (
    <div className="max-w-screen-xl mx-auto px-2 pt-2">
      <nav className="text-xs text-gray-500 mb-2 flex items-center gap-x-1">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <span>{title}</span>
      </nav>
      <div className="mb-2 px-3 py-2 border border-gray-300 bg-white flex items-baseline gap-2">
        <h1 className="font-bold text-sm text-gray-800">{icon} {title}</h1>
        {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
      </div>
    </div>
  )
}
