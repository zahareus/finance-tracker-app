import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Просто логуємо і одразу повертаємо 401
  console.log('>>> MINIMAL MIDDLEWARE EXECUTED! Path:', request.nextUrl.pathname);

  return new NextResponse('Minimal Auth Required Test', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Minimal Test"' },
  });
}

// Залишаємо найпростіший matcher
export const config = {
  matcher: ['/'],
}
