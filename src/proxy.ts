import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // /?category=xxx → /category/xxx (301リダイレクト)
  if (pathname === '/') {
    const category = searchParams.get('category')
    if (category) {
      const newUrl = request.nextUrl.clone()
      newUrl.pathname = `/category/${category}`
      newUrl.searchParams.delete('category')
      return NextResponse.redirect(newUrl, { status: 301 })
    }
  }

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
