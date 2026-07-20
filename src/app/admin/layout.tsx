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
      <Script id="admin-thread-category-consolidation" strategy="afterInteractive">
        {`(() => {
          const categoryGroups = [
            ['雑談', ['雑談']],
            ['新カード・新商品', ['新カード・新商品', '新カード・新商品情報']],
            ['デッキ・ルール相談', ['デッキ相談・コンボ等', 'デッキ・ルール相談', '初心者・復帰勢', 'ルール・裁定関連']],
            ['大会・環境', ['CS大会・環境関係', '大会・環境']],
            ['高騰・殿堂関連', ['高騰・下落情報', '殿堂・プレミアム殿堂関連', '高騰・殿堂関連']],
            ['デュエプレ・特殊ルール', ['デュエプレ', 'デュエパ等の特殊ルール', 'デュエプレ・特殊ルール']],
            ['思い出・アニメ・漫画', ['思い出・昔話・過去商品', '背景ストーリー', 'アニメ・漫画', '思い出・アニメ・漫画']],
            ['デュエチューバー・炎上', ['デュエチューバー', '炎上・物議', 'デュエチューバー・炎上']],
            ['オリカ・創作', ['オリカ', 'オリカ・創作']],
          ]

          const normalizeCategorySelect = (select) => {
            if (!(select instanceof HTMLSelectElement) || select.dataset.consolidatedCategories === '1') return

            const options = [...select.options]
            const emptyOption = options.find((option) => option.value === '')
            const selectedOption = options.find((option) => option.selected)
            const orderedOptions = []

            categoryGroups.forEach(([label, aliases]) => {
              const matches = options.filter((option) => aliases.includes(option.textContent?.trim() || ''))
              if (matches.length === 0) return

              const representative = matches.includes(selectedOption) ? selectedOption : matches[0]
              representative.textContent = label
              orderedOptions.push(representative)
            })

            if (emptyOption) select.appendChild(emptyOption)
            orderedOptions.forEach((option) => select.appendChild(option))
            options.forEach((option) => {
              if (option !== emptyOption && !orderedOptions.includes(option)) option.remove()
            })

            select.dataset.consolidatedCategories = '1'
          }

          const normalizeAll = () => {
            document.querySelectorAll('select[name="category_id"]').forEach(normalizeCategorySelect)
          }

          normalizeAll()
          new MutationObserver(normalizeAll).observe(document.body, { childList: true, subtree: true })
        })()`}
      </Script>
    </>
  )
}
