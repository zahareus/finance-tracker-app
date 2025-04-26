import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Ім'я користувача та пароль беремо з змінних середовища
const username = process.env.SITE_USER; // Змінив назву змінної для ясності
const password = process.env.SITE_PASSWORD; // Змінив назву змінної для ясності

export function middleware(req: NextRequest) {
  // Перевіряємо, чи встановлені логін і пароль в змінних середовища
  if (!username || !password) {
    console.warn('SITE_USER or SITE_PASSWORD environment variables are not set. Protection is disabled.');
    // Якщо ні, пропускаємо захист (можливо, для локальної розробки)
    return NextResponse.next();
  }

  // Перевіряємо заголовок авторизації
  const basicAuth = req.headers.get('authorization');

  if (basicAuth) {
    try {
        // Витягуємо дані з 'Basic base64(user:pass)'
        const authValue = basicAuth.split(' ')[1];
        // Декодуємо Base64. У Edge Runtime (де працює Middleware) може не бути atob
        // Використовуємо Buffer
        const decodedAuthValue = Buffer.from(authValue, 'base64').toString('utf-8');
        const [user, pwd] = decodedAuthValue.split(':');

        // Порівнюємо з еталонними значеннями
        if (user === username && pwd === password) {
          // Якщо все вірно, дозволяємо доступ
          return NextResponse.next();
        }
     } catch (e) {
         console.error('Error decoding basic auth header:', e);
         // Якщо помилка декодування, вважаємо авторизацію недійсною
     }
  }

  // Якщо авторизація не пройдена або відсутня, запитуємо її
  // Повертаємо статус 401 та заголовок WWW-Authenticate
   return new NextResponse('Authentication required.', {
       status: 401,
       headers: {
         'WWW-Authenticate': 'Basic realm="Secure Area"', // Це змусить браузер показати вікно вводу
       },
   });
}

// Конфігурація: Застосовуємо Middleware до всіх шляхів,
// крім системних файлів Next.js та API роутів (якщо вони є)
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
