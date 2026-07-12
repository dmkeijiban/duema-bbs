import type { ReactNode } from 'react'

export default function TierMakerLayout({ children }: { children: ReactNode }) {
  return (
    <div id="dm26-ex2-tier-maker-page">
      {children}
      <style>{`
        #dm26-ex2-tier-maker-page main > div > div.mt-5 > section > div.flex.flex-wrap.gap-2 > button:nth-of-type(3) {
          font-size: 0;
        }

        #dm26-ex2-tier-maker-page main > div > div.mt-5 > section > div.flex.flex-wrap.gap-2 > button:nth-of-type(3)::after {
          content: '画像保存';
          font-size: 0.875rem;
        }

        #dm26-ex2-tier-maker-page main > div > div.mt-5 > aside > h2:first-child,
        #dm26-ex2-tier-maker-page main > div > div.mt-5 > aside > input + div {
          display: none;
        }
      `}</style>
    </div>
  )
}
