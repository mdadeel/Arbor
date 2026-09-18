import { getToken } from 'next-auth/jwt'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const token = await getToken({ req })

  if (!token && req.nextUrl.pathname.startsWith('/admin')) {
    const url = req.nextUrl.clone()
    url.pathname = '/admin-login'
    url.search = `callbackUrl=${encodeURIComponent(req.nextUrl.pathname)}`
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}