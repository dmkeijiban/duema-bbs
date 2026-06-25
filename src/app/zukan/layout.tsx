export default function ZukanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="[&>div]:pb-0 [&_section:last-child]:mb-0">
      {children}
    </div>
  )
}
