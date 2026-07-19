import type { ReactNode } from 'react'

export default function DeckMakerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        [aria-labelledby="card-dialog-title"] .mt-5 > p:first-child {
          display: none;
        }

        [aria-labelledby="card-dialog-title"] .mt-5 > p:nth-child(2) {
          font-size: 0;
        }

        [aria-labelledby="card-dialog-title"] .mt-5 > p:nth-child(2)::after {
          content: '読み込み中…';
          font-size: 0.75rem;
        }

        [aria-labelledby="card-dialog-title"] .mt-5 > div > button > span {
          display: none;
        }
      `}</style>
      {children}
    </>
  )
}
