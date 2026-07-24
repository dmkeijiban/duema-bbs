import { ZukanImageFallbackHydrator } from '@/components/ZukanImageFallbackHydrator'

export default function ZukanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-0">
      {children}
      <ZukanImageFallbackHydrator />
    </div>
  )
}
