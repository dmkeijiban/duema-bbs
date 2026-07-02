import { createBrowserClient } from '@supabase/ssr'
import type { UserResponse } from '@supabase/auth-js'

type BrowserClient = ReturnType<typeof createBrowserClient>

let browserClient: BrowserClient | null = null
let currentUserRequest: Promise<UserResponse> | null = null

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return browserClient
}

export function getCurrentUser(): Promise<UserResponse> {
  if (currentUserRequest) {
    return currentUserRequest
  }

  const request = createClient().auth.getUser().finally(() => {
    currentUserRequest = null
  })
  currentUserRequest = request
  return request
}
