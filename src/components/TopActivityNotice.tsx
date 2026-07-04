import Link from 'next/link'

export function TopActivityNotice() {
  return (
    <Link
      href="/mypage"
      className="inline-flex min-h-8 min-w-0 items-center justify-center rounded border border-green-700 bg-white px-1.5 py-1 text-center text-[11px] font-bold leading-tight whitespace-nowrap text-green-800 transition-colors hover:bg-green-50 md:min-h-0 md:px-2.5 md:text-xs"
    >
      🔔新しいお知らせ
    </Link>
  )
}
