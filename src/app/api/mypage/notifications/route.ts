import { NextResponse } from 'next/server'
import { getViewerActivityNotifications } from '@/lib/activity-notifications'

export async function GET() {
  const notifications = await getViewerActivityNotifications(1)

  return NextResponse.json(
    { hasNotifications: notifications.length > 0 },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
