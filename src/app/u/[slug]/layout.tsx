import type { ReactNode } from 'react'

export default function PublicUserProfileLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            dl.grid.flex-1 > div > dd {
              text-align: center;
            }
          `,
        }}
      />
      {children}
    </>
  )
}
