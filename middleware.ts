import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Ім'я користувача та пароль беремо з змінних середовища
const username = process.env.BASIC_AUTH_USER
const password = process.env.BASIC_AUTH_PASS

export function middleware(req: NextRequest) {
  // Якщо ім'я користувача або пароль не задані в змінних середовища,
  // то захист не працює (пропускаємо всі запити).
  if (!username || !password) {
    console.warn('Basic Auth username or password is not set in environment variables. Protection is disabled.');
    return NextResponse.next();
  }

  // Перевіряємо, чи є заголовок авторизації
  const basicAuth = req.headers.get('authorization')

  if (basicAuth) {
    try {
        // Розкодовуємо дані авторизації (формат 'Basic base64(user:pass)')
        const authValue = basicAuth.split(' ')[1]
        const [user, pwd] = atob(authValue).split(':') // atob() декодує Base64

        // Перевіряємо ім'я користувача та пароль
        if (user === username && pwd === password) {
          // Якщо все вірно, пропускаємо запит далі
          return NextResponse.next()
        }
     } catch (e) {
         console.error('Error decoding basic auth:', e);
     }
  }

  // Якщо авторизація не пройдена або відсутня,
  // повертаємо відповідь 401 Unauthorized із заголовком WWW-Authenticate,
  // щоб браузер показав вікно для вводу логіну/паролю.
  const url = req.nextUrl
  url.pathname = '/api/auth-required' // Можна створити просту сторінку/api для повідомлення
  // Або просто повертаємо 401
   return new NextResponse('Authentication required', {
       status: 401,
       headers: {
         'WWW-Authenticate': 'Basic realm="Secure Area"',
       },
   })

}

// Конфігурація Middleware: вказуємо, до яких шляхів застосовувати захист
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes) - крім /api/auth-required
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    // Захищаємо весь сайт, крім системних файлів Next.js та, можливо, деяких API
     '/((?!api/auth-required|_next/static|_next/image|favicon.ico).*)',
  ],
}
