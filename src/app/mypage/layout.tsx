import type { ReactNode } from 'react'

export default function MyPageLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (min-width: 640px) {
              main.mx-auto > div.w-full > div.border-b.border-gray-300.bg-gray-100:first-child {
                display: flex;
                align-items: baseline;
                gap: 0.75rem;
              }

              main.mx-auto > div.w-full > div.border-b.border-gray-300.bg-gray-100:first-child > p {
                margin-top: 0;
                white-space: nowrap;
              }
            }
          `,
        }}
      />
    </>
  )
}
