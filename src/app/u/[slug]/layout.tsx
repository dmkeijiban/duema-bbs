import type { ReactNode } from 'react'

export default function PublicUserProfileLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            dl.grid.flex-1 > div {
              display: flex;
              flex-direction: column;
            }

            dl.grid.flex-1 > div > dd {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-top: 0;
              text-align: center;
            }
          `,
        }}
      />
      {children}
    </>
  )
}
