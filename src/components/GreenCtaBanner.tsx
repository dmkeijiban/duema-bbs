import Link from 'next/link'
import type { ReactNode } from 'react'
import { TopActivityNotice } from '@/components/TopActivityNotice'

function CtaButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-8 min-w-0 items-center justify-center rounded border border-green-700 bg-white px-1.5 py-1 text-center text-[11px] font-bold leading-tight whitespace-nowrap text-green-800 transition-colors hover:bg-green-50 md:min-h-0 md:px-2.5 md:text-xs"
    >
      {children}
    </Link>
  )
}

export function GreenCtaBanner() {
  return (
    <div
      className="mb-1.5 flex flex-col gap-1.5 border px-3 py-1.5 text-sm text-green-900 md:flex-row md:items-center md:justify-between"
      style={{ color: '#155724', background: '#d4edda', borderColor: '#c3e6cb' }}
    >
      <p className="font-bold leading-relaxed">
        初めての方は
        <Link href="/guide" className="underline underline-offset-2 hover:opacity-80">
          スレッドの立て方
        </Link>
        をご確認ください。
      </p>
      <div className="grid w-full shrink-0 grid-cols-3 gap-1 md:flex md:w-auto md:flex-wrap md:gap-1.5">
        <CtaButton href="/login?mode=signup">アカウント作成</CtaButton>
        <CtaButton href="/zukan">思い出図鑑を見る</CtaButton>
        <TopActivityNotice />
      </div>
    </div>
  )
}
