import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link'; // Залишаємо Link, хоча посилання зараз одне
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Finance Tracker',
  description: 'Minimalist finance tracking',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk">
      {/* Прибрали flex з body */}
      <body className={`${inter.className} bg-gray-100`}> {/* Змінив фон для контрасту */}
        {/* Простий Хедер (можна стилізувати краще) */}
        <header className="bg-white shadow sticky top-0 z-10">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
             {/* Назва або лого */}
             <div className="flex-shrink-0">
                <Link href="/transactions" className="text-lg font-bold text-gray-800">
                    Finance Tracker
                </Link>
             </div>
             {/* Можна додати інші елементи хедера праворуч пізніше */}
          </nav>
        </header>

        {/* Основний контент сторінки */}
        {/* Додаємо контейнер з максимальной шириною та відступами */}
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
