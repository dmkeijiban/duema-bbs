import Link from 'next/link'
import { getCachedTopGreenBannerButtons } from '@/lib/cached-queries'
import type { ResolvedTopGreenBannerButton } from '@/lib/top-green-banner'

function CtaButton({ button }: { button: ResolvedTopGreenBannerButton }) {
  return (
    <Link
      href={button.href}
      target={button.openInNewTab ? '_blank' : undefined}
      rel={button.openInNewTab ? 'noopener noreferrer' : undefined}
      className={`inline-flex min-h-8 min-w-0 items-center justify-center rounded border px-1.5 py-1 text-center text-[11px] font-bold leading-tight whitespace-nowrap transition-colors md:min-h-0 md:px-2.5 md:text-xs ${
        button.emphasis
          ? 'border-green-700 bg-green-700 text-white hover:bg-green-800'
          : 'border-green-700 bg-white text-green-800 hover:bg-green-50'
      }`}
    >
      {button.icon}{button.label}
    </Link>
  )
}

export async function GreenCtaBanner() {
  const buttons = await getCachedTopGreenBannerButtons()

  return (
    <div
      data-top-green-banner
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
      {buttons.length > 0 && (
        <div
          className="grid w-full shrink-0 gap-1 md:flex md:w-auto md:flex-wrap md:gap-1.5"
          style={{ gridTemplateColumns: `repeat(${buttons.length}, minmax(0, 1fr))` }}
        >
          {buttons.map(button => (
            <CtaButton key={`${button.label}-${button.href}`} button={button} />
          ))}
        </div>
      )}
    </div>
  )
}
