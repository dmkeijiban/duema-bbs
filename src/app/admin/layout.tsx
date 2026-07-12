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
      <Script id="admin-tier-maker-menu-link" strategy="afterInteractive">
        {`(() => {
          const label = [...document.querySelectorAll('p')].find((node) => node.textContent?.trim() === '生成・取り込み')
          const group = label?.nextElementSibling
          if (!group || group.querySelector('a[href="/admin/tier-maker"]')) return

          const template = group.querySelector('a')
          const link = document.createElement('a')
          link.href = '/admin/tier-maker'
          link.textContent = '📊 新弾Tier表メーカー'
          if (template) link.className = template.className
          group.appendChild(link)
        })()`}
      </Script>
    </>
  )
}
