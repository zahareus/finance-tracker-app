import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import Image from 'next/image'; // Імпортуємо компонент Image
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Finance Tracker', // Можна змінити на назву твого бізнесу
  description: 'Minimalist finance tracking',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk">
      <body className={`${inter.className} bg-gray-100`}>
        {/* Хедер з логотипом */}
        <header className="bg-white shadow sticky top-0 z-10">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between"> {/* Трохи збільшив висоту хедера */}
             {/* Логотип (посилається на сторінку транзакцій) */}
             <div className="flex-shrink-0">
                <Link href="/transactions" className="flex items-center"> {/* Додав flex для вертикального центрування */}
                    {/* Використовуємо next/image для оптимізації */}
                    <Image
                       src="/logo.png" // Шлях до твого логотипу в папці public
                       alt="Finance Tracker Logo" // Важливий атрибут для доступності
                       width={200} // Задай бажану ширину лого (в пікселях)
                       height={50} // Задай бажану висоту лого (в пікселях)
                       priority // Завантажувати пріоритетно (бо в хедері)
                       className="h-8 w-auto" // Tailwind класи для висоти, ширина авто
                    />
                     {/* Можна додати назву поруч з лого, якщо треба */}
                     {/* <span className="ml-3 text-lg font-bold text-gray-800">Назва</span> */}
                </Link>
             </div>
             {/* Навігація (якщо потрібна в майбутньому) */}
             {/* <div className="flex space-x-4">
                <Link href="/transactions" className="text-gray-600 hover:text-gray-900 font-medium">Транзакції</Link>
             </div> */}
          </nav>
        </header>

        {/* Основний контент сторінки */}
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
