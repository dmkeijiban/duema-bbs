import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'

// Server-side session ID取得
export async function getSessionId(): Promise<string> {
  const cookieStore = await cookies()
  const existing = cookieStore.get('bbs_session')?.value
  if (existing) return existing
  return uuidv4()
}
