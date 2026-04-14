import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export function proxy(request: NextRequest) {
  const response = NextResponse.next()

  // セッションCookieの自動付与
  if (!request.cookies.get('bbs_session')) {
    response.cookies.set('bbs_session', uuidv4(), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
      sameSite: 'lax',
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
