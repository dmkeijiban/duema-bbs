import type { ReactNode } from 'react'

export default function MyPageLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (min-width: 640px) {
              main.mx-auto > div.w-full > div.border-b.border-gray-300.bg-gray-100:first-child > h1::after {
                content: '（このブラウザから投稿したスレッドとコメントを確認できます。）';
                font-size: 0.875rem;
                font-weight: 400;
                color: #4b5563;
              }

              main.mx-auto > div.w-full > div.border-b.border-gray-300.bg-gray-100:first-child > p {
                display: none;
              }
            }
          `,
        }}
      />
    </>
  )
}
