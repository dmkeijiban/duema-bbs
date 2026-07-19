import type { ReactNode } from 'react'

export default function DeckMakerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        [aria-labelledby="card-dialog-title"] .mt-5 > p:first-child {
          display: none;
        }

        [aria-labelledby="card-dialog-title"] .mt-5 > div > button > span {
          display: none;
        }
      `}</style>
      {children}
    </>
  )
}
