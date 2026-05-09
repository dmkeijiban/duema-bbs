import { NextRequest, NextResponse } from 'next/server'

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

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
