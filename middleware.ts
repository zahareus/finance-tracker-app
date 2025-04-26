import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const username = process.env.SITE_USER;
const password = process.env.SITE_PASSWORD;

export function middleware(req: NextRequest) {
  // ЛОГ 1: Перевіряємо, чи middleware взагалі запустився для цього запиту
  console.log(`>>> MIDDLEWARE: Request received for path: ${req.nextUrl.pathname}`);

  if (!username || !password) {
    console.warn('MIDDLEWARE: SITE_USER or SITE_PASSWORD missing. Protection disabled.');
    return NextResponse.next();
  }

  const basicAuth = req.headers.get('authorization');
  console.log(`MIDDLEWARE: Authorization header: ${basicAuth ? 'Present' : 'Missing'}`); // ЛОГ 2

  if (basicAuth) {
    try {
        const authValue = basicAuth.split(' ')[1];
        if (!authValue) { throw new Error('Invalid auth header value'); }
        const decodedAuthValue = Buffer.from(authValue, 'base64').toString('utf-8');
        const [user, pwd] = decodedAuthValue.split(':');

        if (user === username && pwd === password) {
          console.log(`MIDDLEWARE: Auth successful for user ${user}. Allowing access.`); // ЛОГ 3
          return NextResponse.next(); // Доступ дозволено
        } else {
            console.warn(`MIDDLEWARE: Auth failed. Incorrect user/pass provided.`); // ЛОГ 4
        }
     } catch (e) {
         console.error('MIDDLEWARE: Error decoding basic auth header:', e);
     }
  }

  // Якщо дійшли сюди - авторизація не пройдена або відсутня
  console.log(`MIDDLEWARE: Auth failed or missing. Returning 401 for path: ${req.nextUrl.pathname}`); // ЛОГ 5
   return new NextResponse('Authentication required.', {
       status: 401,
       headers: {
         'WWW-Authenticate': 'Basic realm="Secure Area"',
       },
   });
}

// Конфігурація matcher залишається без змін
export const config = {
  matcher: [
     '/((?!api|_next/static|_next/image|favicon.ico|logo.png).*)',
  ],
}
