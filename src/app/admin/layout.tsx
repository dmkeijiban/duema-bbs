import type { Metadata } from 'next'
import Script from 'next/script'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Script id="admin-profile-stats-label-fix" strategy="afterInteractive">
        {`document.querySelectorAll('a').forEach((link) => {
          if (link.textContent?.trim() === '📊 デュエマプロフィール統計') {
            link.textContent = '📊 プロフィール統計'
          }
        })`}
      </Script>
    </>
  )
}
