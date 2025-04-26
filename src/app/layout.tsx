import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link'; // Імпортуємо Link для навігації
import './globals.css';
import Sidebar from '@/components/Sidebar';

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
      <body className={`${inter.className} flex h-screen overflow-hidden bg-white`}> {/* Змінив фон на білий */}
        {/* Бічна панель */}
        <Sidebar />

        {/* Основний контент з хедером для навігації */}
        <div className="flex-1 flex flex-col overflow-hidden"> {/* Обгортка для хедера і контенту */}
          {/* Хедер з Навігацією */}
          <header className="bg-white border-b border-gray-200 px-6 py-3">
            <nav className="flex space-x-4">
              {/* Додаємо посилання на Головну (Огляд), Транзакції та Звіти */}
              {/* (Головна '/ ' поки показує заглушку, потім можна змінити) */}
               {/* <Link href="/" className="text-gray-600 hover:text-gray-900">Огляд</Link> */}
              <Link href="/transactions" className="text-gray-600 hover:text-gray-900 font-medium">Транзакції</Link>
            </nav>
          </header>

          {/* Основний контент сторінки */}
          <main className="flex-1 overflow-y-auto p-6 bg-gray-50"> {/* Додав фон для основної зони */}
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
