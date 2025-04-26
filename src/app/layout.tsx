import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar'; // Імпортуємо наш Sidebar

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Finance Tracker',
  description: 'Minimalist finance tracking',
};

export default function RootLayout({
  children, // 'children' - це вміст поточної сторінки (Транзакції або Звіти)
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk">
      <body className={`${inter.className} flex h-screen overflow-hidden`}> {/* Додаємо flex та h-screen */}
        {/* Бічна панель */}
        <Sidebar />

        {/* Основний контент сторінки */}
        <main className="flex-1 overflow-y-auto p-6"> {/* flex-1 займає решту місця, додаємо скрол та відступи */}
          {children}
        </main>
      </body>
    </html>
  );
}
