import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  // ЛОГ 1: Перевіряємо запуск і змінні середовища
  console.log(`>>> MIDDLEWARE: Request for path: ${req.nextUrl.pathname}`);
  const username = process.env.SITE_USER;
  const password = process.env.SITE_PASSWORD;
  console.log(`MIDDLEWARE: Read ENV VARS - User: ${username ? 'SET' : 'NOT SET'}, Pass: ${password ? 'SET' : 'NOT SET'}`);

  // Якщо змінні не встановлені, просто виходимо (для безпеки логування)
  if (!username || !password) {
    console.warn('MIDDLEWARE: SITE_USER or SITE_PASSWORD missing. Protection disabled.');
    return NextResponse.next();
  }

  const basicAuth = req.headers.get('authorization');
  console.log(`MIDDLEWARE: Auth header: ${basicAuth ? 'Present' : 'Missing'}`);

  if (basicAuth) {
    try {
        const authValue = basicAuth.split(' ')[1];
        if (!authValue) { throw new Error('Invalid auth header value'); }
        const decodedAuthValue = Buffer.from(authValue, 'base64').toString('utf-8');
        const [user, pwd] = decodedAuthValue.split(':');

        if (user === username && pwd === password) {
          console.log(`MIDDLEWARE: Auth successful for user ${user}.`);
          return NextResponse.next();
        } else {
            console.warn(`MIDDLEWARE: Auth failed. Incorrect user/pass.`);
        }
     } catch (e) {
         console.error('MIDDLEWARE: Error decoding basic auth:', e);
     }
  }

  // Запит авторизації
  console.log(`MIDDLEWARE: Returning 401 for path: ${req.nextUrl.pathname}`);
   return new NextResponse('Authentication required.', {
       status: 401,
       headers: {
         'WWW-Authenticate': 'Basic realm="Secure Area"',
       },
   });
}

// **СПРОЩЕНИЙ MATCHER:** Застосовуємо ТІЛЬКИ до головної сторінки
export const config = {
  matcher: ['/'], // Застосовуємо тільки до кореневого шляху
}
