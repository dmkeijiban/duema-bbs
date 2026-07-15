import { HALL_RELEASE_LABEL_LINES } from '@/lib/hall-release-design'

export default function HallReleaseLabel() {
  return (
    <span className="flex flex-col items-center justify-center whitespace-nowrap text-center font-black leading-tight [word-break:keep-all]">
      {HALL_RELEASE_LABEL_LINES.map(line => <span key={line} className="block">{line}</span>)}
    </span>
  )
}
