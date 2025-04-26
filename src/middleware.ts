// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  // Отримуємо логін та пароль з process.env
  const username = process.env.SITE_USER;
  const password = process.env.SITE_PASSWORD;

  // Перевіряємо, чи змінні середовища встановлені
  if (!username || !password) {
    console.error('Error: SITE_USER and SITE_PASSWORD environment variables must be set.');
    // Можна повернути помилку або дозволити доступ, залежно від бажаної поведінки
    // У цьому випадку повернемо помилку, щоб вказати на проблему конфігурації
    return new NextResponse('Internal Server Error: Missing authentication credentials configuration.', { status: 500 });
  }

  // Отримуємо заголовок Authorization з запиту
  const basicAuth = req.headers.get('authorization');

  if (basicAuth) {
    // Розбираємо заголовок Basic Auth
    const authValue = basicAuth.split(' ')[1]; // Отримуємо частину 'dXNlcjpwYXNz'
    let decodedAuthValue: string;
    try {
      // Декодуємо з Base64
       decodedAuthValue = atob(authValue); // atob доступний у Edge Runtime
    } catch (e) {
        console.error("Failed to decode base64 auth value:", e);
        return new NextResponse('Malformed authentication credentials', { status: 400 });
    }

    const [user, pwd] = decodedAuthValue.split(':');

    // Порівнюємо отримані дані зі змінними середовища
    if (user === username && pwd === password) {
      // Якщо все вірно - дозволяємо доступ до сторінки
      return NextResponse.next();
    }
  }

  // Якщо заголовок відсутній або дані невірні - запитуємо автентифікацію
  return new NextResponse('Authentication required.', {
    status: 401,
    headers: {
      // Цей заголовок змусить браузер показати вікно для вводу логіна/пароля
      'WWW-Authenticate': 'Basic realm="Restricted Area"',
    },
  });
}

// Конфігурація Middleware
export const config = {
  /*
   * Застосовуємо middleware до всіх шляхів, ОКРІМ:
   * - /api/ (API маршрути)
   * - /_next/static (Статичні файли Next.js)
   * - /_next/image (Файли оптимізації зображень Next.js)
   * - /favicon.ico (Іконка сайту)
   * - /authrequired (Можливий спеціальний шлях, якщо потрібен)
   * Якщо ти хочеш захистити ВСЕ, включаючи API, можеш використати: matcher: '/:path*'
   */
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|authrequired).*)'],
};
